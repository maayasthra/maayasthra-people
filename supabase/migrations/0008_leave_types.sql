-- Leave types are now Sick, Casual and Emergency. Annual leave is removed.
-- Run after 0007_live_updates.sql, in the Supabase SQL Editor.
-- Days per year can be changed later in the app: Settings > Leave.
update public.leave_policy set allow = '{"Sick leave":8,"Casual leave":8,"Emergency leave":3}' where id = 1;
alter table public.leave_policy alter column allow set default '{"Sick leave":8,"Casual leave":8,"Emergency leave":3}';
