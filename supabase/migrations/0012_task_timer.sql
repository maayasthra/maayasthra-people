-- Task timers: when someone moves a card to Doing the clock starts, and it stops when they pause or complete it.
-- Run after 0011_board_layout.sql, in the Supabase SQL Editor.
-- Every start and stop is stamped by the database clock. time_log = [{ id, emp, start, end }] in milliseconds; end is null while the timer runs.

alter table public.tasks add column if not exists time_log jsonb not null default '[]'
  check (jsonb_typeof(time_log) = 'array' and jsonb_array_length(time_log) <= 500);

create or replace function public.task_timer(p_task text, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); nowms bigint := public.now_ms();
begin
  if p_action not in ('start', 'stop', 'stop_all') then raise exception 'Invalid timer action'; end if;
  if me is null or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  if p_action = 'start' then
    -- One running timer per person per card
    update public.tasks set time_log = time_log || jsonb_build_array(jsonb_build_object('id', nowms::text || '-' || me, 'emp', me, 'start', nowms, 'end', null))
    where id = p_task and not exists (
      select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
  else
    update public.tasks set time_log = coalesce((
      select jsonb_agg(case when coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null' and (p_action = 'stop_all' or (e ->> 'emp')::bigint = me)
                            then jsonb_set(e, '{end}', to_jsonb(greatest(nowms, (e ->> 'start')::bigint))) else e end order by o)
      from jsonb_array_elements(time_log) with ordinality x(e, o)), '[]'::jsonb)
    where id = p_task;
  end if;
end;
$$;
revoke all on function public.task_timer(text, text) from public, anon;
grant execute on function public.task_timer(text, text) to authenticated;
