-- 0034: everyone can read back their own past day reports (shown under My Tasks > Submitted work). Admins and project managers
-- still read everyone's. Replaces the "today only" limit from 0025. Run after 0033.
drop policy if exists "own or manager read eod" on public.eod_reports;
create policy "own or manager read eod" on public.eod_reports for select
  using (public.is_staff() and (public.is_pm() or employee_id = public.my_employee_id()));
