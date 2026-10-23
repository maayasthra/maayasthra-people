-- A new role: Project manager. Run after 0012_task_timer.sql, in the Supabase SQL Editor.
--   Admin            everything, including people, leave and settings
--   Project manager  the whole Kanban board, Team and Project hours; assigns and removes tasks
--   Employee         only their own tasks (My Tasks)

-- The role is allowed in the staff list and on sign-in accounts
do $$ declare c record; begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
           where contype = 'c' and conrelid in ('public.employees'::regclass, 'public.profiles'::regclass) and pg_get_constraintdef(oid) ilike '%role = any%' loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;
alter table public.employees add constraint employees_role_check check (role in ('Employee', 'Admin', 'Project manager'));
alter table public.profiles  add constraint profiles_role_check  check (role in ('Employee', 'Admin', 'Project manager'));

-- Admins and project managers
create or replace function public.is_pm()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('Admin', 'Project manager') and active);
$$;

-- Who can see and change tasks
drop policy if exists "staff read tasks" on public.tasks;
create policy "staff read tasks" on public.tasks for select using (public.is_staff() and (
  public.is_pm() or by_emp = public.my_employee_id()
  or cols @> to_jsonb(public.my_employee_id()) or coalesce(prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id())));

drop policy if exists "staff add tasks" on public.tasks;
create policy "staff add tasks" on public.tasks for insert with check (
  public.is_staff() and by_emp = public.my_employee_id()
  and (public.is_pm() or cols <@ jsonb_build_array(public.my_employee_id())));

drop policy if exists "involved change tasks" on public.tasks;
create policy "involved change tasks" on public.tasks for update
  using (public.is_staff() and (public.is_pm() or by_emp = public.my_employee_id()
         or cols @> to_jsonb(public.my_employee_id()) or coalesce(prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id())))
  with check (public.is_staff());

-- Only admins and project managers remove tasks
drop policy if exists "involved delete tasks" on public.tasks;
drop policy if exists "managers delete tasks" on public.tasks;
create policy "managers delete tasks" on public.tasks for delete using (public.is_pm());

-- The board layout and extra columns are managed by admins and project managers
drop policy if exists "staff change board" on public.task_board;
drop policy if exists "managers change board" on public.task_board;
create policy "managers change board" on public.task_board for update using (public.is_pm()) with check (public.is_pm());
drop policy if exists "admins change layout" on public.board_layout;
drop policy if exists "managers change layout" on public.board_layout;
create policy "managers change layout" on public.board_layout for update using (public.is_pm()) with check (public.is_pm());

-- Employees cannot hand cards to other people, or write hours by hand. Only the timer function below changes time_log for them.
create or replace function public.tasks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare mgr boolean := public.is_pm(); timer boolean := coalesce(current_setting('mp.timer', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not mgr then new.time_log := '[]'::jsonb; end if;
    return new;
  end if;
  if not mgr and not timer then new.time_log := old.time_log; end if;
  if not mgr and exists (select 1 from jsonb_array_elements(new.cols) e
                         where not ((old.cols || coalesce(old.prev, '[]'::jsonb) || '["done"]'::jsonb) @> jsonb_build_array(e))) then
    raise exception 'Only admins and project managers can assign cards to other people';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard before insert or update on public.tasks for each row execute function public.tasks_guard();

-- A card can be changed by admins, project managers, its creator, or people on it
create or replace function public.can_edit_task(p_task text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and (
    public.is_pm() or t.by_emp = public.my_employee_id()
    or t.cols @> to_jsonb(public.my_employee_id()) or coalesce(t.prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id())))
$$;

create or replace function public.patch_task_list(p_task text, p_kind text, p_op text, p_item jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id();
begin
  if p_kind not in ('subs', 'comments') or p_op not in ('add', 'set', 'remove') or jsonb_typeof(p_item) <> 'object' then raise exception 'Invalid change'; end if;
  if not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  if p_kind = 'comments' then
    if p_op = 'add' and (p_item ->> 'by')::bigint is distinct from me then raise exception 'Invalid comment author'; end if;
    if p_op = 'set' then raise exception 'Comments cannot be edited'; end if;
    if p_op = 'remove' and not public.is_pm() and not exists (
      select 1 from public.tasks t, jsonb_array_elements(t.comments) c where t.id = p_task and c ->> 'id' = p_item ->> 'id' and (c ->> 'by')::bigint = me)
    then raise exception 'You can only remove your own comments'; end if;
  end if;
  if p_kind = 'subs' then
    update public.tasks set subs = case p_op
      when 'add' then subs || jsonb_build_array(p_item)
      when 'set' then coalesce((select jsonb_agg(case when e ->> 'id' = p_item ->> 'id' then p_item else e end order by o) from jsonb_array_elements(subs) with ordinality x(e, o)), '[]'::jsonb)
      else coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(subs) with ordinality x(e, o) where e ->> 'id' <> p_item ->> 'id'), '[]'::jsonb) end
    where id = p_task;
  else
    update public.tasks set comments = case p_op
      when 'add' then comments || jsonb_build_array(p_item)
      else coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(comments) with ordinality x(e, o) where e ->> 'id' <> p_item ->> 'id'), '[]'::jsonb) end
    where id = p_task;
  end if;
end;
$$;

-- Timers. Starting a card pauses the person's other running card, so their hours are never counted twice.
-- p_emp lets an admin or project manager stop someone else's timer, for example when a card is moved to another person.
create or replace function public.close_sessions(p_time jsonb, p_emp bigint, p_now bigint)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(case when coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null' and (p_emp is null or (e ->> 'emp')::bigint = p_emp)
                                 then jsonb_set(e, '{end}', to_jsonb(greatest(p_now, (e ->> 'start')::bigint))) else e end order by o), '[]'::jsonb)
  from jsonb_array_elements(p_time) with ordinality x(e, o)
$$;

drop function if exists public.task_timer(text, text);
create or replace function public.task_timer(p_task text, p_action text, p_emp bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); nowms bigint := public.now_ms(); who bigint;
begin
  if p_action not in ('start', 'stop', 'stop_all') then raise exception 'Invalid timer action'; end if;
  if me is null or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  who := case when p_action = 'start' then me else coalesce(p_emp, me) end;
  if who <> me and not public.is_pm() then raise exception 'You can only change cards you created or are on'; end if;
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
revoke all on function public.task_timer(text, text, bigint) from public, anon;
grant execute on function public.task_timer(text, text, bigint) to authenticated;
