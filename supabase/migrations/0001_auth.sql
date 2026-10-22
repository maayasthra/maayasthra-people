-- Maayasthra People: accounts and roles
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  role       text not null default 'Employee' check (role in ('Employee', 'Admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Used by the policies below. security definer lets it read profiles without looping through RLS.
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'Admin' and active);
$$;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (id = auth.uid());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles for select using (public.is_admin());

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- There is no insert or delete policy on purpose. A profile is created by the trigger below
-- when someone is invited or signs up, and removed with their auth account.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email)) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Make the first admin AFTER that person has been invited and has set a password.
-- Replace the email, then run this single statement:
--   update public.profiles set role = 'Admin' where email = 'meera.iyer@maayasthra.com';
