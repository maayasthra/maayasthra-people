-- 0030: Board preferences (which columns are open or closed, the board filters) are kept per person in the database,
-- so they are remembered on every login and every device. Run after 0029.
alter table public.user_state add column if not exists prefs jsonb not null default '{}'::jsonb;
