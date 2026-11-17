-- Completed-only deletion is distinct from an intentional individual card deletion.
begin;
create or replace function public.delete_completed_tasks(p_ids jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare removed jsonb;
begin
  if not public.is_pm() then raise exception 'Only admins and project managers can delete cards'; end if;
  if p_ids is null or jsonb_typeof(p_ids)<>'array' then raise exception 'Invalid task IDs'; end if;
  if jsonb_array_length(p_ids)>10000 or exists(select 1 from jsonb_array_elements(p_ids) x where jsonb_typeof(x)<>'string') then raise exception 'Invalid task IDs'; end if;
  -- PostgreSQL rechecks done if this DELETE waits for a concurrent reopen.
  with deleted as (
    delete from public.tasks where done and id in(select jsonb_array_elements_text(p_ids)) returning id
  ) select coalesce(jsonb_agg(id),'[]'::jsonb) into removed from deleted;
  return removed;
end $$;
revoke all on function public.delete_completed_tasks(jsonb) from public,anon;
grant execute on function public.delete_completed_tasks(jsonb) to authenticated;

-- Reassignment must not erase the original worker's EOD time. Return only that
-- worker's day-scoped total and a minimal label, not the newly assigned card.
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
  ), totals as (
    select id,title,sum(greatest(0,least(coalesce((s->>'end')::numeric,nowms),end_ms)-greatest((s->>'start')::numeric,start_ms))) ms
    from sessions where (s->>'emp')::bigint=me
      and (s->>'start')::numeric<end_ms and coalesce((s->>'end')::numeric,nowms)>start_ms group by id,title
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'ms',ms) order by ms desc,id),'[]'::jsonb)
    into result from totals where ms>=60000;
  if jsonb_array_length(result)>1000 then raise exception 'Too many tasks for one report'; end if;
  return result;
end $$;
revoke all on function public.my_task_time_for_day(date) from public,anon;
grant execute on function public.my_task_time_for_day(date) to authenticated;
commit;
