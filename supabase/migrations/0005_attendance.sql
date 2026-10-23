-- Maayasthra People, part 3: attendance (check-ins).
-- Run after 0004_leave.sql, in the Supabase SQL Editor.
-- One row per person per day. sessions = [{ "in": ms, "out": ms or null, "loc": "office" | "home" }]
-- Days are India days (Asia/Kolkata). Check-in and check-out times come from the database clock.

create table if not exists public.attendance_days (
  employee_id bigint not null references public.employees (id) on delete cascade,
  day         date   not null,
  sessions    jsonb  not null default '[]' check (jsonb_typeof(sessions) = 'array' and jsonb_array_length(sessions) <= 12),
  edited_by   bigint references public.employees (id) on delete set null,
  edited_at   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (employee_id, day)
);
create index if not exists attendance_days_day on public.attendance_days (day);

alter table public.attendance_days enable row level security;

-- A person reads their own days, admins read everyone's. Nobody writes directly: the functions below do it.
drop policy if exists "own or admin read attendance" on public.attendance_days;
create policy "own or admin read attendance" on public.attendance_days for select
  using (public.is_admin() or employee_id = public.my_employee_id());

create or replace function public.today_ist() returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;
create or replace function public.now_ms() returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- Check in now. Closed once the person's working hours have ended.
create or replace function public.check_in(p_loc text default 'office')
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); e public.employees; cur jsonb; loc text := case when p_loc = 'home' then 'home' else 'office' end;
begin
  select * into e from public.employees where id = me;
  if not found or e.status = 'Exited' then raise exception 'No active staff record for this account'; end if;
  if (now() at time zone 'Asia/Kolkata')::time >= e.shift_end then raise exception 'Your working hours have ended'; end if;
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist();
  if cur is not null and jsonb_array_length(cur) > 0 and (cur -> -1 ->> 'out') is null then raise exception 'You are already checked in'; end if;
  insert into public.attendance_days (employee_id, day, sessions)
    values (me, public.today_ist(), jsonb_build_array(jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc)))
  on conflict (employee_id, day) do update
    set sessions = public.attendance_days.sessions || jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc), updated_at = now();
end;
$$;

-- Check out. p_at lets the app close the day at the shift end; it cannot be before the check-in or in the future.
create or replace function public.check_out(p_at bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); cur jsonb; n int; t bigint; nowms bigint := public.now_ms();
begin
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist() for update;
  if cur is null or jsonb_array_length(cur) = 0 or (cur -> -1 ->> 'out') is not null then raise exception 'You are not checked in'; end if;
  n := jsonb_array_length(cur);
  t := coalesce(p_at, nowms);
  if t > nowms + 5000 or t < (cur -> -1 ->> 'in')::bigint then raise exception 'That check-out time is not valid'; end if;
  update public.attendance_days set sessions = jsonb_set(sessions, array[(n - 1)::text, 'out'], to_jsonb(t)), updated_at = now()
    where employee_id = me and day = public.today_ist();
end;
$$;

-- An admin corrects someone's day. Never their own.
create or replace function public.admin_set_day(p_employee bigint, p_day date, p_sessions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s jsonb; clean jsonb := '[]';
begin
  if not public.is_admin() then raise exception 'Only admins can edit hours'; end if;
  if p_employee = coalesce(public.my_employee_id(), 0) then raise exception 'Ask another admin to edit your hours'; end if;
  if p_day > public.today_ist() then raise exception 'You cannot edit a future day'; end if;
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) > 12 then raise exception 'Invalid sessions'; end if;
  for s in select * from jsonb_array_elements(p_sessions) loop
    if jsonb_typeof(s -> 'in') <> 'number' or (s -> 'out' is not null and jsonb_typeof(s -> 'out') not in ('number', 'null')) then raise exception 'Invalid session'; end if;
    if jsonb_typeof(s -> 'out') = 'number' and (s ->> 'out')::bigint < (s ->> 'in')::bigint then raise exception 'A check-out cannot be before its check-in'; end if;
    clean := clean || jsonb_build_object('in', (s ->> 'in')::bigint, 'out', case when jsonb_typeof(s -> 'out') = 'number' then (s ->> 'out')::bigint end, 'loc', case when s ->> 'loc' = 'home' then 'home' else 'office' end);
  end loop;
  insert into public.attendance_days (employee_id, day, sessions, edited_by, edited_at)
    values (p_employee, p_day, clean, public.my_employee_id(), now())
  on conflict (employee_id, day) do update set sessions = excluded.sessions, edited_by = excluded.edited_by, edited_at = excluded.edited_at, updated_at = now();
end;
$$;

revoke all on function public.check_in(text), public.check_out(bigint), public.admin_set_day(bigint, date, jsonb) from public, anon;
grant execute on function public.check_in(text), public.check_out(bigint), public.admin_set_day(bigint, date, jsonb) to authenticated;
