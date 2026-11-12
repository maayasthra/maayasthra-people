-- Active membership is required even when an old Auth session is still valid.
-- Keep both profile overloads consistent; can_edit_task also gates list/timer RPCs.
begin;
create or replace function public.can_edit_task(p_task text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (select 1 from public.tasks t where t.id = p_task and (
    public.is_pm() or t.by_emp = public.my_employee_id()
    or t.cols @> to_jsonb(public.my_employee_id()) or coalesce(t.prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id())))
$$;

create or replace function public.update_my_profile(p_phone text, p_bio text, p_photo text, p_emergency_name text, p_emergency_phone text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or not public.is_staff() then raise exception 'No active staff record for this account'; end if;
  update public.employees set bio = coalesce(p_bio, ''), photo = coalesce(p_photo, '') where id = me;
  insert into public.employee_private (employee_id, phone, emergency_name, emergency_phone)
    values (me, coalesce(p_phone, ''), coalesce(p_emergency_name, ''), coalesce(p_emergency_phone, ''))
    on conflict (employee_id) do update set phone = excluded.phone, emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone;
end;
$$;

create or replace function public.update_my_profile(p_phone text, p_bio text, p_photo text, p_emergency_name text, p_emergency_phone text, p_emergency_relation text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or not public.is_staff() then raise exception 'No active staff record for this account'; end if;
  update public.employees set bio = coalesce(p_bio, ''), photo = coalesce(p_photo, '') where id = me;
  insert into public.employee_private (employee_id, phone, emergency_name, emergency_phone, emergency_relation)
    values (me, coalesce(p_phone, ''), coalesce(p_emergency_name, ''), coalesce(p_emergency_phone, ''), coalesce(p_emergency_relation, ''))
    on conflict (employee_id) do update set phone = excluded.phone, emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone, emergency_relation = excluded.emergency_relation;
end;
$$;
commit;
