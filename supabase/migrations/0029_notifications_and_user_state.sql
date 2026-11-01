-- 0029: Each person's notification bell and their "have I seen the tour / which tasks have I been told about" live in the
-- database, so they follow the person to a new device. Run after 0028.

create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  employee_id bigint not null references public.employees (id) on delete cascade,
  key         text not null,                       -- what the notification is about, so it is never added twice
  kind        text not null check (kind in ('task', 'eod')),
  title       text not null check (length(title) <= 200),
  body        text not null default '' check (length(body) <= 500),
  ref         text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (employee_id, key)
);
create index if not exists notifications_by_person on public.notifications (employee_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select using (employee_id = public.my_employee_id());
drop policy if exists "own notifications add" on public.notifications;
create policy "own notifications add" on public.notifications for insert with check (employee_id = public.my_employee_id());
drop policy if exists "own notifications change" on public.notifications;
create policy "own notifications change" on public.notifications for update using (employee_id = public.my_employee_id()) with check (employee_id = public.my_employee_id());
drop policy if exists "own notifications remove" on public.notifications;
create policy "own notifications remove" on public.notifications for delete using (employee_id = public.my_employee_id());
revoke all on public.notifications from anon;
grant select, insert, update, delete on public.notifications to authenticated;

-- Keep only the latest 40 for each person
create or replace function public.trim_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications where employee_id = new.employee_id
    and id not in (select id from public.notifications where employee_id = new.employee_id order by created_at desc, id desc limit 40);
  return null;
end;
$$;
drop trigger if exists notifications_trim on public.notifications;
create trigger notifications_trim after insert on public.notifications for each row execute function public.trim_notifications();

do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object or undefined_object then null; end $$;

-- Small per-person settings
create table if not exists public.user_state (
  employee_id bigint primary key references public.employees (id) on delete cascade,
  tour_done   boolean not null default false,
  seen_tasks  jsonb,                               -- null until the first visit sets the starting point
  updated_at  timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "own state read" on public.user_state;
create policy "own state read" on public.user_state for select using (employee_id = public.my_employee_id());
drop policy if exists "own state add" on public.user_state;
create policy "own state add" on public.user_state for insert with check (employee_id = public.my_employee_id());
drop policy if exists "own state change" on public.user_state;
create policy "own state change" on public.user_state for update using (employee_id = public.my_employee_id()) with check (employee_id = public.my_employee_id());
revoke all on public.user_state from anon;
grant select, insert, update on public.user_state to authenticated;
