-- 0025: EOD reports are for admins and project managers. An employee can read back only today's own report
-- (so the check-out box can show what they already sent), not their history. Run after 0024.
drop policy if exists "own or manager read eod" on public.eod_reports;
create policy "own or manager read eod" on public.eod_reports for select
  using (public.is_staff() and (public.is_pm() or (employee_id = public.my_employee_id() and day = public.today_ist())));
