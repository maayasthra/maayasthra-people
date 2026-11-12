-- Retain every closed timer session without exceeding the hot task row's 500-entry limit.
-- The matching frontend merges archive batches into time history for totals and date reports.
begin;
create table public.task_time_archive (
  id bigint generated always as identity primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  sessions jsonb not null check (jsonb_typeof(sessions)='array' and jsonb_array_length(sessions)<=500)
);
create index on public.task_time_archive(task_id);
alter table public.task_time_archive enable row level security;
create policy "involved read archived time" on public.task_time_archive for select using(public.can_edit_task(task_id));
revoke all on public.task_time_archive from public, anon, authenticated;
grant select on public.task_time_archive to authenticated;

create or replace function public.task_timer(p_task text, p_action text, p_emp bigint default null)
returns void language plpgsql security definer set search_path=public as $$
declare me bigint := public.my_employee_id(); nowms bigint := public.now_ms(); who bigint; entries jsonb; closed jsonb; running jsonb;
begin
  if p_action not in ('start','stop','stop_all') then raise exception 'Invalid timer action'; end if;
  if me is null or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
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

create or replace function public.valid_group_members(items jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
begin
  if jsonb_typeof(items) is distinct from 'array' then return false; end if;
  return not exists(select 1 from jsonb_array_elements(items) x where jsonb_typeof(x) not in ('string','number'));
end $$;
alter table public.board_groups add constraint board_groups_members_shape check(public.valid_group_members(members));
commit;
