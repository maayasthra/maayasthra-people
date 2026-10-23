-- Employee IDs read M-<number>. Admins can decide any leave request, including their own. Staff changes reach everyone live.
-- Run after 0009_integrity.sql, in the Supabase SQL Editor.

-- Employee ID: M-1, M-2, ...
alter table public.employees drop column if exists emp_code;
alter table public.employees add column emp_code text generated always as ('M-' || id::text) stored;

-- Any admin may approve or decline any request, their own included. decided_by and decided_at record who and when.
drop policy if exists "admins decide leave" on public.leave_requests;
create policy "admins decide leave" on public.leave_requests for update using (public.is_admin()) with check (public.is_admin());

-- Photos, names, new people and role changes now reach everyone's open screens straight away.
do $$ begin alter publication supabase_realtime add table public.employees; exception when duplicate_object or undefined_object then null; end $$;
