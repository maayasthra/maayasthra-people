-- 0017: no automatic check-out at the end of the shift. A person stays checked in until they check out themselves,
-- and can check in at any hour. Only a session left open from an EARLIER day is still closed (at that day's shift end),
-- so a forgotten check-out does not run on for days.
create or replace function public.check_in(p_loc text default 'office')
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); e public.employees; cur jsonb; loc text := case when p_loc = 'home' then 'home' else 'office' end;
begin
  select * into e from public.employees where id = me;
  if not found or e.status = 'Exited' then raise exception 'No active staff record for this account'; end if;
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
