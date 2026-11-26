begin;
-- Apply offboarding to every owner policy, including writes using a retained session.
create policy "active membership required" on public.employee_private as restrictive
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "active membership required" on public.leave_requests as restrictive
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "active membership required" on public.employee_covers as restrictive
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "active membership required" on public.notifications as restrictive
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "active membership required" on public.user_state as restrictive
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.tasks add constraint tasks_completion_lane
  check (case when done then cols='["done"]'::jsonb else not (cols ? 'done') end);

create or replace function public.task_timer(p_task text, p_action text, p_emp bigint default null)
returns void language plpgsql security definer set search_path=public as $$
declare me bigint := public.my_employee_id(); nowms bigint := public.now_ms(); who bigint; entries jsonb; closed jsonb; running jsonb;
begin
  if p_action is null or p_action not in ('start','stop','stop_all') then raise exception 'Invalid timer action'; end if;
  if me is null or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  if p_action='stop_all' and not public.is_pm() then raise exception 'Only managers can stop all timers'; end if;
  who := case when p_action='start' then me else coalesce(p_emp,me) end;
  if who<>me and not public.is_pm() then raise exception 'You can only change cards you created or are on'; end if;
  perform public.close_stale_timers_all();
  perform set_config('mp.timer','on',true);
  select time_log into entries from public.tasks where id=p_task for update;
  -- Assignment may have changed while this request waited for the row lock.
  if not found or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  if p_action='start' then
    if exists(select 1 from jsonb_array_elements(entries) e where (e->>'emp')::bigint=me and e->>'end' is null) then return; end if;
    if jsonb_array_length(entries)>=500 then
      select coalesce(jsonb_agg(e order by ord) filter(where e->>'end' is not null),'[]'),
             coalesce(jsonb_agg(e order by ord) filter(where e->>'end' is null),'[]') into closed,running
        from jsonb_array_elements(entries) with ordinality x(e,ord);
      if jsonb_array_length(running)>=500 then raise exception 'Stop an active timer before starting another on this card'; end if;
      insert into public.task_time_archive(task_id,sessions) values(p_task,closed);
      entries := running;
    end if;
    update public.tasks set time_log=entries||jsonb_build_array(jsonb_build_object('id',nowms::text||'-'||me,'emp',me,'start',nowms,'end',null)) where id=p_task;
  elsif p_action='stop' then
    update public.tasks set time_log=public.close_sessions(time_log,who,nowms) where id=p_task;
  else
    update public.tasks set time_log=public.close_sessions(time_log,null,nowms) where id=p_task;
  end if;
end $$;

create or replace function public.my_task_time_for_day(p_day date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me bigint:=public.my_employee_id(); start_ms numeric; end_ms numeric; nowms numeric:=public.now_ms(); result jsonb;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_day is null or p_day>public.today_ist() or p_day<public.today_ist()-7 then raise exception 'Invalid report day'; end if;
  start_ms:=extract(epoch from (p_day::timestamp at time zone 'Asia/Kolkata'))*1000;
  end_ms:=start_ms+86400000;
  with sessions as (
    select t.id,t.title,s from public.tasks t cross join lateral jsonb_array_elements(t.time_log) s
    union all
    select t.id,t.title,s from public.task_time_archive a join public.tasks t on t.id=a.task_id cross join lateral jsonb_array_elements(a.sessions) s
  ), clipped as (
    select id,title,greatest((s->>'start')::numeric,start_ms) as lo,
      least(coalesce((s->>'end')::numeric,nowms),end_ms) as hi
    from sessions where (s->>'emp')::bigint=me
  ), breaks as (
    select (b->>'from')::numeric as lo,coalesce((b->>'to')::numeric,nowms) as hi
    from public.attendance_days d cross join lateral jsonb_array_elements(d.away) b
    where d.employee_id=me and d.day=p_day
  ), totals as (
    select c.id,c.title,sum(greatest(0,c.hi-c.lo-coalesce((
      select sum(greatest(0,least(c.hi,b.hi)-greatest(c.lo,b.lo))) from breaks b
    ),0))) ms from clipped c where c.hi>c.lo group by c.id,c.title
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',
    case when public.can_edit_task(id) then title else 'Previously assigned task' end,
    'ms',ms) order by ms desc,id),'[]'::jsonb) into result from totals where ms>=60000;
  if jsonb_array_length(result)>1000 then raise exception 'Too many tasks for one report'; end if;
  return result;
end $$;
commit;
