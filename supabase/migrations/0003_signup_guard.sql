-- Self sign-up, limited to people in the staff list.
-- Run after 0002_staff.sql. Then in Supabase: Authentication > Sign In / Providers > turn on "Allow new users to sign up"
-- and keep "Confirm email" ON (this is what stops anyone claiming someone else's address).

create or replace function public.guard_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.employees where email = lower(new.email) and status <> 'Exited') then
    raise exception 'This email is not in the staff list';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_signup on auth.users;
create trigger guard_signup before insert on auth.users
  for each row execute function public.guard_signup();
