-- Live updates for check-ins and leave, so admins see them as they happen.
-- Run after 0006_tasks.sql, in the Supabase SQL Editor. Row-level security still applies:
-- a person only receives updates for rows they are allowed to read.
do $$ begin alter publication supabase_realtime add table public.attendance_days; exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.leave_requests; exception when duplicate_object or undefined_object then null; end $$;
