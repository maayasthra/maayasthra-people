-- 0016: timers left running overnight never add extra hours. Run after 0015.

-- Close every timer that was started before today (India time) at the end of that person's working day.
-- Safe to call at any time, by anyone signed in: it only closes timers that are already out of date.
create or replace function public.close_stale_timers_all()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_staff() then return; end if;
  for r in
    select distinct (e ->> 'emp')::bigint as emp
    from public.tasks t, jsonb_array_elements(t.time_log) e
    where coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null'
      and (e ->> 'start')::bigint < (extract(epoch from (public.today_ist()::timestamp at time zone 'Asia/Kolkata')) * 1000)::bigint
  loop
    perform public.close_stale_timers(r.emp, coalesce((select shift_end from public.employees where id = r.emp), '18:00'::time));
  end loop;
end;
$$;
revoke all on function public.close_stale_timers_all() from public, anon;
grant execute on function public.close_stale_timers_all() to authenticated;

-- Pressing Start, Pause or Stop first closes any timer left over from a previous day.
create or replace function public.task_timer(p_task text, p_action text, p_emp bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); nowms bigint := public.now_ms(); who bigint;
begin
  if p_action not in ('start', 'stop', 'stop_all') then raise exception 'Invalid timer action'; end if;
  if me is null or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  who := case when p_action = 'start' then me else coalesce(p_emp, me) end;
  if who <> me and not public.is_pm() then raise exception 'You can only change cards you created or are on'; end if;
  perform public.close_stale_timers_all();
  perform set_config('mp.timer', 'on', true);
  if p_action = 'start' then
    update public.tasks set time_log = public.close_sessions(time_log, me, nowms)
      where id <> p_task and exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
    update public.tasks set time_log = time_log || jsonb_build_array(jsonb_build_object('id', nowms::text || '-' || me, 'emp', me, 'start', nowms, 'end', null))
      where id = p_task and not exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
  elsif p_action = 'stop' then
    update public.tasks set time_log = public.close_sessions(time_log, who, nowms) where id = p_task;
  else
    update public.tasks set time_log = public.close_sessions(time_log, null, nowms) where id = p_task;
  end if;
end;
$$;

-- When someone is marked Exited, their running timers stop at that moment.
create or replace function public.exit_stops_timers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Exited' and old.status is distinct from 'Exited' then
    perform set_config('mp.timer', 'on', true);
    update public.tasks set time_log = public.close_sessions(time_log, new.id, public.now_ms())
      where exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = new.id and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
  end if;
  return new;
end;
$$;
drop trigger if exists exit_stops_timers on public.employees;
create trigger exit_stops_timers after update of status on public.employees for each row execute function public.exit_stops_timers();
