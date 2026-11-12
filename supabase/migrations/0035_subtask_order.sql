-- Reorder existing subtasks without replacing their content or dropping items
-- added by another editor. Apply in staging before the matching frontend.
begin;
create or replace function public.reorder_task_subs(p_task text, p_ids jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare cur jsonb;
begin
  if p_ids is null or jsonb_typeof(p_ids) <> 'array' then raise exception 'Invalid subtask order'; end if;
  if jsonb_array_length(p_ids) > 500
     or exists (select 1 from jsonb_array_elements(p_ids) e where jsonb_typeof(e) <> 'string')
     or (select count(*) <> count(distinct e) from jsonb_array_elements_text(p_ids) e)
  then raise exception 'Invalid subtask order'; end if;
  -- Lock before checking involvement so concurrent assignment edits cannot race
  -- this decision, and build the new order from the latest stored subtasks.
  select subs into cur from public.tasks where id = p_task for update;
  if not found or not public.is_staff() or not public.can_edit_task(p_task)
  then raise exception 'You can only change cards you created or are on'; end if;
  update public.tasks set subs = coalesce((
    select jsonb_agg(x.e order by requested.pos nulls last, x.pos)
    from jsonb_array_elements(cur) with ordinality x(e, pos)
    left join jsonb_array_elements_text(p_ids) with ordinality requested(id, pos)
      on requested.id = x.e ->> 'id'
  ), '[]'::jsonb) where id = p_task;
end;
$$;
revoke all on function public.reorder_task_subs(text, jsonb) from public, anon;
grant execute on function public.reorder_task_subs(text, jsonb) to authenticated;
commit;
