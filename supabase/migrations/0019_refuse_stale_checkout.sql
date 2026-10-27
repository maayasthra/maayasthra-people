-- 0019: a check-out must carry the time of the click; an out-of-date page cannot check anyone out at the shift end. Run after 0018.
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
  -- The app sends the moment of the click. An older version of the app (a tab left open) sent the shift end instead,
  -- which checked people out at 6 PM on its own. That is refused.
  if p_at is not null and p_at < nowms - 120000 then raise exception 'This page is out of date. Refresh it, then check out.'; end if;
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

