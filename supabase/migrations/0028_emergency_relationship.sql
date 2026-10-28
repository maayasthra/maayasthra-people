-- 0028: The emergency contact's relationship is its own field (name, relationship, one phone number). Run after 0027.
alter table public.employee_private add column if not exists emergency_relation text not null default '';

create or replace function public.update_my_profile(p_phone text, p_bio text, p_photo text, p_emergency_name text, p_emergency_phone text, p_emergency_relation text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me bigint := public.my_employee_id();
begin
  if me is null then raise exception 'No staff record for this account'; end if;
  update public.employees set bio = coalesce(p_bio, ''), photo = coalesce(p_photo, '') where id = me;
  insert into public.employee_private (employee_id, phone, emergency_name, emergency_phone, emergency_relation)
    values (me, coalesce(p_phone, ''), coalesce(p_emergency_name, ''), coalesce(p_emergency_phone, ''), coalesce(p_emergency_relation, ''))
    on conflict (employee_id) do update set phone = excluded.phone, emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone, emergency_relation = excluded.emergency_relation;
end;
$$;
revoke all on function public.update_my_profile(text, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text, text) to authenticated;
