-- 0020: the admin Members page. Admins can see when each person last signed in and when their account was created. Run after 0019.
create or replace function public.admin_members()
returns table (employee_id bigint, last_sign_in timestamptz, account_created timestamptz, signed_up boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Only admins can see this'; end if;
  return query
    select e.id, u.last_sign_in_at, coalesce(u.created_at, e.created_at), (u.id is not null)
    from public.employees e left join auth.users u on lower(u.email) = e.email
    order by e.id;
end;
$$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;
