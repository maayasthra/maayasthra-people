-- 0045: lets the Google Sheet "Employee EOD Updates" read every end-of-day report, one tab per month.
-- The sheet's script calls three read-only functions with a secret token. The token is set once in the Supabase SQL editor (see
-- SETUP-SHEET.md); only its hash is stored, so the database never keeps the token itself. Without the right token the functions refuse.
-- They never change anything. Run after 0044.
create table if not exists public.eod_export_config (
  id         int primary key default 1 check (id = 1),
  token_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.eod_export_config enable row level security;   -- no policies: the app can never read it
revoke all on public.eod_export_config from public, anon, authenticated;

create or replace function public.eod_export_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_token is not null and exists (select 1 from public.eod_export_config where id = 1 and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')), false)
$$;

-- Months (like '2026-11') that have any report, newest first
create or replace function public.eod_export_months(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eod_export_ok(p_token) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(m order by m desc) from (select distinct to_char(day, 'YYYY-MM') m from public.eod_reports) x), '[]'::jsonb);
end;
$$;

-- Months with a report sent or changed since a moment (null means all), and the database clock to remember for next time
create or replace function public.eod_export_changes(p_token text, p_since timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eod_export_ok(p_token) then raise exception 'Not allowed'; end if;
  return jsonb_build_object('now', now(), 'months', coalesce((select jsonb_agg(m order by m desc) from (
    select distinct to_char(day, 'YYYY-MM') m from public.eod_reports where p_since is null or updated_at > p_since) x), '[]'::jsonb));
end;
$$;

-- Every line of every report in a month, one row per project line or subtask, in reading order.
-- A project with subtasks has no hours of its own (its subtasks carry them), so adding up the hours never counts anything twice.
-- day_total is filled only on the first line of each report.
create or replace function public.eod_export_month(p_token text, p_month text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d0 date; out jsonb;
begin
  if not public.eod_export_ok(p_token) then raise exception 'Not allowed'; end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Not a month'; end if;
  d0 := (p_month || '-01')::date;
  with lines as (
    select r.employee_id, r.day, r.total_hours, r.submitted_at, r.updated_at, x.ord as o1, 0 as o2, 'main'::text as kind,
           x.item ->> 'project' as project, null::text as sub, x.item ->> 'desc' as note,
           case when jsonb_typeof(x.item -> 'subs') = 'array' and jsonb_array_length(x.item -> 'subs') > 0 then null else nullif(x.item ->> 'hours', '')::numeric end as hours
    from public.eod_reports r, jsonb_array_elements(r.rows) with ordinality as x(item, ord)
    where r.day >= d0 and r.day < d0 + interval '1 month'
    union all
    select r.employee_id, r.day, r.total_hours, r.submitted_at, r.updated_at, x.ord, s.ord, 'sub',
           x.item ->> 'project', s.item ->> 'title', s.item ->> 'desc', nullif(s.item ->> 'hours', '')::numeric
    from public.eod_reports r, jsonb_array_elements(r.rows) with ordinality as x(item, ord),
         jsonb_array_elements(case when jsonb_typeof(x.item -> 'subs') = 'array' then x.item -> 'subs' else '[]'::jsonb end) with ordinality as s(item, ord)
    where r.day >= d0 and r.day < d0 + interval '1 month'
  )
  , numbered as (select l.*, row_number() over (partition by l.employee_id, l.day order by l.o1, l.o2) as rn from lines l)
  select coalesce(jsonb_agg(jsonb_build_object(
      'day', l.day, 'name', e.name, 'dept', e.department, 'title', e.job_title, 'project', coalesce(l.project, ''), 'sub', l.sub, 'note', coalesce(l.note, ''),
      'hours', l.hours, 'kind', l.kind, 'submitted', l.submitted_at, 'updated', l.updated_at,
      'day_total', case when l.rn = 1 then l.total_hours else null end)
    order by l.day, e.name, l.employee_id, l.o1, l.o2), '[]'::jsonb)
  into out from numbered l join public.employees e on e.id = l.employee_id;
  return out;
end;
$$;

revoke all on function public.eod_export_ok(text), public.eod_export_months(text), public.eod_export_changes(text, timestamptz), public.eod_export_month(text, text) from public, anon, authenticated;
grant execute on function public.eod_export_months(text), public.eod_export_changes(text, timestamptz), public.eod_export_month(text, text) to anon, authenticated;
