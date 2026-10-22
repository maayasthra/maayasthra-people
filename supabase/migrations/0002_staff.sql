-- Maayasthra People, part 1: the staff directory.
-- Run after 0001_auth.sql, in the Supabase SQL Editor.

create table if not exists public.employees (
  id          bigint generated always as identity primary key,
  emp_code    text generated always as ('MAY-' || lpad(id::text, 3, '0')) stored,
  email       text not null unique check (email = lower(email)),
  name        text not null,
  job_title   text not null default '',
  department  text not null default '',
  city        text not null default '',
  join_date   date,
  birth_date  date,
  status      text not null default 'Full-time' check (status in ('Full-time','Probation','Contract','On leave','Exited')),
  role        text not null default 'Employee' check (role in ('Employee','Admin')),
  manager_id  bigint references public.employees (id) on delete set null,
  shift_start time not null default '10:00',
  shift_end   time not null default '18:00',
  bio         text not null default '',
  photo       text not null default '',
  created_at  timestamptz not null default now()
);

-- Private details: only that person and admins can read them.
create table if not exists public.employee_private (
  employee_id     bigint primary key references public.employees (id) on delete cascade,
  phone           text not null default '',
  emergency_name  text not null default '',
  emergency_phone text not null default ''
);

alter table public.employees enable row level security;
alter table public.employee_private enable row level security;

-- Helpers. security definer lets them read the tables without looping through the policies.
create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.my_employee_id()
returns bigint language sql security definer set search_path = public, auth stable as $$
  select e.id from public.employees e join auth.users u on lower(u.email) = e.email where u.id = auth.uid();
$$;

-- Directory: every active signed-in person can read it. Only admins change it.
drop policy if exists "staff read directory" on public.employees;
create policy "staff read directory" on public.employees for select using (public.is_staff());
drop policy if exists "admins add employees" on public.employees;
create policy "admins add employees" on public.employees for insert with check (public.is_admin());
drop policy if exists "admins edit employees" on public.employees;
create policy "admins edit employees" on public.employees for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins remove employees" on public.employees;
create policy "admins remove employees" on public.employees for delete using (public.is_admin());

drop policy if exists "own or admin read private" on public.employee_private;
create policy "own or admin read private" on public.employee_private for select using (public.is_admin() or employee_id = public.my_employee_id());
drop policy if exists "admins write private" on public.employee_private;
create policy "admins write private" on public.employee_private for all using (public.is_admin()) with check (public.is_admin());

-- A person edits only their own contact details and photo, through this function.
create or replace function public.update_my_profile(p_phone text, p_bio text, p_photo text, p_emergency_name text, p_emergency_phone text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me bigint := public.my_employee_id();
begin
  if me is null then raise exception 'No staff record for this account'; end if;
  update public.employees set bio = coalesce(p_bio, ''), photo = coalesce(p_photo, '') where id = me;
  insert into public.employee_private (employee_id, phone, emergency_name, emergency_phone)
    values (me, coalesce(p_phone, ''), coalesce(p_emergency_name, ''), coalesce(p_emergency_phone, ''))
    on conflict (employee_id) do update set phone = excluded.phone, emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone;
end;
$$;
revoke all on function public.update_my_profile(text, text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text) to authenticated;

-- Keep the sign-in role and the staff record in step.
create or replace function public.sync_profile_from_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = new.role, active = (new.status <> 'Exited') where email = new.email;
  return new;
end;
$$;
drop trigger if exists employees_sync_profile on public.employees;
create trigger employees_sync_profile after insert or update of role, status, email on public.employees
  for each row execute function public.sync_profile_from_employee();

-- When someone is invited, start them with the role their staff record says.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, active)
  select new.id, lower(new.email), coalesce(e.role, 'Employee'), coalesce(e.status <> 'Exited', true)
  from (select 1) x left join public.employees e on e.email = lower(new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---- Bulk import from a CSV -------------------------------------------------
-- 1. Table Editor > staff_import > Insert > Import data from CSV (the staff template).
-- 2. SQL Editor:  select public.import_staff();
create table if not exists public.staff_import (
  name text, work_email text, job_title text, department text, join_date text, birth_date text,
  manager_email text, city text, role text, status text, shift_start text, shift_end text
);
alter table public.staff_import enable row level security;  -- no policies: the app can never read it

create or replace function public.import_staff()
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.employees (email, name, job_title, department, city, join_date, birth_date, status, role, shift_start, shift_end)
  select lower(trim(work_email)), trim(name), coalesce(trim(job_title), ''), coalesce(trim(department), ''), coalesce(trim(city), ''),
         nullif(trim(join_date), '')::date, nullif(trim(birth_date), '')::date,
         coalesce(nullif(trim(status), ''), 'Full-time'), coalesce(nullif(trim(role), ''), 'Employee'),
         coalesce(nullif(trim(shift_start), '')::time, '10:00'), coalesce(nullif(trim(shift_end), '')::time, '18:00')
  from public.staff_import
  where trim(coalesce(work_email, '')) <> '' and trim(coalesce(name, '')) <> '' and name not ilike 'EXAMPLE%'
  on conflict (email) do update set name = excluded.name, job_title = excluded.job_title, department = excluded.department, city = excluded.city,
    join_date = excluded.join_date, birth_date = excluded.birth_date, status = excluded.status, role = excluded.role,
    shift_start = excluded.shift_start, shift_end = excluded.shift_end;
  get diagnostics n = row_count;
  update public.employees e set manager_id = m.id
    from public.staff_import s join public.employees m on m.email = lower(trim(s.manager_email))
    where e.email = lower(trim(s.work_email)) and trim(coalesce(s.manager_email, '')) <> '';
  return n || ' people imported or updated';
end;
$$;
revoke all on function public.import_staff() from public, anon, authenticated;
