-- 0024: admins can see who has acknowledged each announcement. Run after 0023.
drop policy if exists "admins read all reads" on public.announcement_reads;
create policy "admins read all reads" on public.announcement_reads for select using (public.is_admin());
do $$ begin alter publication supabase_realtime add table public.announcement_reads; exception when duplicate_object or undefined_object then null; end $$;
