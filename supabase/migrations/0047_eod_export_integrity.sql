-- 0047: deletion-safe, commit-safe month revisions and stable exported employee identities.
-- Counters contain no report text. Only token-gated export RPCs can read them.
create table if not exists public.eod_export_revisions (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.eod_export_revisions enable row level security;
revoke all on public.eod_export_revisions from public, anon, authenticated;

create or replace function public.touch_eod_export_month(p_day date)
returns void language sql security definer set search_path = public as $$
  insert into public.eod_export_revisions(month) values (to_char(p_day, 'YYYY-MM'))
  on conflict (month) do update set revision = eod_export_revisions.revision + 1, updated_at = clock_timestamp();
$$;
create or replace function public.track_eod_export_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform public.touch_eod_export_month(old.day); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.day is distinct from old.day) then perform public.touch_eod_export_month(new.day); end if;
  return null;
end;
$$;
drop trigger if exists eod_export_revision on public.eod_reports;
create trigger eod_export_revision after insert or update or delete on public.eod_reports
for each row execute function public.track_eod_export_change();

-- Names/departments are joined into exports, so directory edits invalidate their report months too.
create or replace function public.track_eod_export_employee()
returns trigger language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if new.name is distinct from old.name or new.department is distinct from old.department or new.job_title is distinct from old.job_title then
    for d in select min(day) from public.eod_reports where employee_id = new.id group by to_char(day, 'YYYY-MM') order by min(day) loop
      perform public.touch_eod_export_month(d);
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists eod_export_employee_revision on public.employees;
create trigger eod_export_employee_revision after update on public.employees
for each row execute function public.track_eod_export_employee();
insert into public.eod_export_revisions(month)
select distinct to_char(day, 'YYYY-MM') from public.eod_reports on conflict (month) do nothing;
revoke all on function public.touch_eod_export_month(date), public.track_eod_export_change(), public.track_eod_export_employee() from public, anon, authenticated;

create or replace function public.eod_export_changes(p_token text, p_since timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eod_export_ok(p_token) then raise exception 'Not allowed'; end if;
  return jsonb_build_object('now', now(),
    'months', coalesce((select jsonb_agg(month order by month desc) from public.eod_export_revisions where p_since is null or updated_at > p_since), '[]'::jsonb),
    'versions', coalesce((select jsonb_object_agg(month, revision::text) from public.eod_export_revisions), '{}'::jsonb));
end;
$$;

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
      'employee_id', l.employee_id::text, 'day', l.day, 'name', e.name, 'dept', e.department, 'title', e.job_title, 'project', coalesce(l.project, ''), 'sub', l.sub, 'note', coalesce(l.note, ''),
      'hours', l.hours, 'kind', l.kind, 'submitted', l.submitted_at, 'updated', l.updated_at,
      'day_total', case when l.rn = 1 then l.total_hours else null end)
    order by l.day, e.name, l.employee_id, l.o1, l.o2), '[]'::jsonb)
  into out from numbered l join public.employees e on e.id = l.employee_id;
  return out;
end;
$$;

revoke all on function public.eod_export_changes(text, timestamptz), public.eod_export_month(text, text) from public, anon, authenticated;
grant execute on function public.eod_export_changes(text, timestamptz), public.eod_export_month(text, text) to anon, authenticated;
