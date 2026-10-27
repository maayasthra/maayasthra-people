-- 0021: a person can have several cards in Doing at once. Starting a card no longer stops their other cards. Run after 0020.
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
    update public.tasks set time_log = time_log || jsonb_build_array(jsonb_build_object('id', nowms::text || '-' || me, 'emp', me, 'start', nowms, 'end', null))
      where id = p_task and not exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
  elsif p_action = 'stop' then
    update public.tasks set time_log = public.close_sessions(time_log, who, nowms) where id = p_task;
  else
    update public.tasks set time_log = public.close_sessions(time_log, null, nowms) where id = p_task;
  end if;
end;
$$;
