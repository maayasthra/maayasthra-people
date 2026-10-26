-- 0018: End-of-day (EOD) reports. Nobody can check out without one for the day. Run after 0017.

create table if not exists public.eod_reports (
  employee_id bigint not null references public.employees(id) on delete cascade,
  day date not null,
  rows jsonb not null default '[]'::jsonb,
  total_hours numeric(5,2) not null default 0,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (employee_id, day)
);
alter table public.eod_reports enable row level security;

-- People read their own reports; admins and project managers read everyone's. Nobody writes directly: submit_eod does.
drop policy if exists "own or manager read eod" on public.eod_reports;
create policy "own or manager read eod" on public.eod_reports for select
  using (public.is_staff() and (public.is_pm() or employee_id = public.my_employee_id()));
revoke insert, update, delete on public.eod_reports from anon, authenticated;
grant select on public.eod_reports to authenticated;

-- rows = [{ project, task, desc, hours, subs: [{ title, desc, hours }] }]
-- A project with subtasks counts the hours of its subtasks; one without counts its own.
create or replace function public.submit_eod(p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); r jsonb; s jsonb; total numeric := 0; sub_total numeric; h numeric; n int := 0;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Add at least one line to your report'; end if;
  if jsonb_array_length(p_rows) > 40 then raise exception 'That report has too many lines'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    if length(trim(coalesce(r ->> 'project', ''))) = 0 then raise exception 'Line %: add the project name', n; end if;
    if length(r ->> 'project') > 200 or length(coalesce(r ->> 'desc', '')) > 1000 then raise exception 'Line %: that is too long', n; end if;
    if jsonb_typeof(r -> 'subs') = 'array' and jsonb_array_length(r -> 'subs') > 0 then
      if jsonb_array_length(r -> 'subs') > 40 then raise exception 'Line %: too many subtasks', n; end if;
      sub_total := 0;
      for s in select * from jsonb_array_elements(r -> 'subs') loop
        if length(trim(coalesce(s ->> 'title', ''))) = 0 then raise exception 'Line %: name each subtask', n; end if;
        if length(s ->> 'title') > 200 or length(coalesce(s ->> 'desc', '')) > 1000 then raise exception 'Line %: that is too long', n; end if;
        h := coalesce(nullif(s ->> 'hours', '')::numeric, 0);
        if h <= 0 or h > 24 then raise exception 'Line %: enter the hours for every subtask', n; end if;
        sub_total := sub_total + h;
      end loop;
      total := total + sub_total;
    else
      if length(trim(coalesce(r ->> 'desc', ''))) = 0 then raise exception 'Line %: describe what you did', n; end if;
      h := coalesce(nullif(r ->> 'hours', '')::numeric, 0);
      if h <= 0 or h > 24 then raise exception 'Line %: enter the hours (up to 24)', n; end if;
      total := total + h;
    end if;
  end loop;
  if total > 24 then raise exception 'That adds up to more than 24 hours'; end if;
  insert into public.eod_reports (employee_id, day, rows, total_hours) values (me, public.today_ist(), p_rows, total)
  on conflict (employee_id, day) do update set rows = excluded.rows, total_hours = excluded.total_hours, updated_at = now();
end;
$$;
revoke all on function public.submit_eod(jsonb) from public, anon;
grant execute on function public.submit_eod(jsonb) to authenticated;

-- Check-out needs today's report
create or replace function public.check_out(p_at bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); cur jsonb; n int; t bigint; nowms bigint := public.now_ms();
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist() for update;
  if cur is null or jsonb_array_length(cur) = 0 or (cur -> -1 ->> 'out') is not null then raise exception 'You are not checked in'; end if;
  if not exists (select 1 from public.eod_reports where employee_id = me and day = public.today_ist()) then
    raise exception 'Submit your EOD report before checking out';
  end if;
  n := jsonb_array_length(cur);
  t := greatest((cur -> -1 ->> 'in')::bigint, least(coalesce(p_at, nowms), nowms));
  update public.attendance_days set sessions = jsonb_set(sessions, array[(n - 1)::text, 'out'], to_jsonb(t)), updated_at = now()
    where employee_id = me and day = public.today_ist();
  -- Anything marked as in progress goes back to the to-do list
  perform set_config('mp.timer', 'on', true);
  update public.tasks set time_log = public.close_sessions(time_log, me, t)
    where exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
end;
$$;

-- Live updates for the reports page
do $$ begin
  alter publication supabase_realtime add table public.eod_reports;
exception when duplicate_object then null; when undefined_object then null; end $$;
