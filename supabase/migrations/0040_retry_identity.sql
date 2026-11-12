-- Stable creation identities and repeat-safe list/deletion operations.
begin;
alter table public.employees add column creation_key uuid unique;
alter table public.announcements add column client_key text check(length(client_key)<=100);
create unique index announcements_client_key on public.announcements(by_emp,client_key);
alter table public.leave_requests add column client_key text check(length(client_key)<=100);
create unique index leave_client_key on public.leave_requests(employee_id,client_key);
create or replace function public.patch_task_list(p_task text, p_kind text, p_op text, p_item jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); items jsonb; existing jsonb;
begin
  if p_kind not in ('subs', 'comments') or p_op not in ('add', 'set', 'remove') or jsonb_typeof(p_item) <> 'object' then raise exception 'Invalid change'; end if;
  if not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  select case when p_kind='subs' then subs else comments end into items from public.tasks where id=p_task for update;
  -- Assignment may have changed while this request waited for the row lock.
  if not found or not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  if p_kind = 'comments' then
    if p_op = 'add' and (p_item ->> 'by')::bigint is distinct from me then raise exception 'Invalid comment author'; end if;
    if p_op = 'set' then raise exception 'Comments cannot be edited'; end if;
    if p_op = 'remove' and not public.is_pm() and exists (
      select 1 from jsonb_array_elements(items) c where c ->> 'id' = p_item ->> 'id' and (c ->> 'by')::bigint is distinct from me)
    then raise exception 'You can only remove your own comments'; end if;
  end if;
  if p_op='add' then
    select e into existing from jsonb_array_elements(items) e where e->>'id'=p_item->>'id';
    if found then
      if existing=p_item then return; end if;
      raise exception 'That item already exists with different content. Refresh before changing it';
    end if;
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


create or replace function public.delete_tasks(p_ids jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.is_pm() then raise exception 'Only admins and project managers can delete cards'; end if;
  delete from public.tasks where id in (select jsonb_array_elements_text(p_ids));
end $$;
revoke all on function public.delete_tasks(jsonb) from public,anon;
grant execute on function public.delete_tasks(jsonb) to authenticated;
commit;
