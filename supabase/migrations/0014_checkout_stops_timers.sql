-- Checking out stops the person's running task timers. Run after 0013_project_manager.sql, in the Supabase SQL Editor.
-- A timer left running past the end of a day is closed at that day's shift end the next time the person checks in.

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
  -- Their running task timers end with the day
  perform set_config('mp.timer', 'on', true);
  update public.tasks set time_log = public.close_sessions(time_log, me, t)
    where exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
end;
$$;

create or replace function public.close_stale_timers(p_emp bigint, p_shift_end time)
returns void language plpgsql security definer set search_path = public as $$
declare cutoff bigint := (extract(epoch from (public.today_ist()::timestamp at time zone 'Asia/Kolkata')) * 1000)::bigint;
begin
  perform set_config('mp.timer', 'on', true);
  update public.tasks t set time_log = (
    select coalesce(jsonb_agg(case
      when coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null' and (e ->> 'emp')::bigint = p_emp and (e ->> 'start')::bigint < cutoff
      then jsonb_set(e, '{end}', to_jsonb(greatest((e ->> 'start')::bigint,
             (extract(epoch from (((to_timestamp((e ->> 'start')::bigint / 1000.0) at time zone 'Asia/Kolkata')::date + p_shift_end) at time zone 'Asia/Kolkata')) * 1000)::bigint)))
      else e end order by o), '[]'::jsonb)
    from jsonb_array_elements(t.time_log) with ordinality x(e, o))
  where exists (select 1 from jsonb_array_elements(t.time_log) e
                where (e ->> 'emp')::bigint = p_emp and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null' and (e ->> 'start')::bigint < cutoff);
end;
$$;
revoke all on function public.close_stale_timers(bigint, time) from public, anon, authenticated;

create or replace function public.check_in(p_loc text default 'office')
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); e public.employees; cur jsonb; loc text := case when p_loc = 'home' then 'home' else 'office' end;
begin
  select * into e from public.employees where id = me;
  if not found or e.status = 'Exited' then raise exception 'No active staff record for this account'; end if;
  if (now() at time zone 'Asia/Kolkata')::time >= e.shift_end then raise exception 'Your working hours have ended'; end if;
  update public.attendance_days d set sessions = jsonb_set(d.sessions, array[(jsonb_array_length(d.sessions) - 1)::text, 'out'],
      to_jsonb(greatest((d.sessions -> -1 ->> 'in')::bigint, (extract(epoch from ((d.day + e.shift_end) at time zone 'Asia/Kolkata')) * 1000)::bigint)))
    where d.employee_id = me and d.day < public.today_ist() and jsonb_array_length(d.sessions) > 0 and (d.sessions -> -1 ->> 'out') is null;
  perform public.close_stale_timers(me, e.shift_end);
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist();
  if cur is not null and jsonb_array_length(cur) > 0 and (cur -> -1 ->> 'out') is null then raise exception 'You are already checked in'; end if;
  insert into public.attendance_days (employee_id, day, sessions)
    values (me, public.today_ist(), jsonb_build_array(jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc)))
  on conflict (employee_id, day) do update
    set sessions = public.attendance_days.sessions || jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc), updated_at = now();
end;
$$;
