-- Maayasthra People, part 4: tasks (Kanban board) and announcements.
-- Run after 0005_attendance.sql, in the Supabase SQL Editor.
-- Everyone signed in sees the whole board. Admins, a card's creator and people on the card can change it.

create table if not exists public.tasks (
  id         text primary key check (length(id) between 1 and 64),
  title      text not null check (length(title) <= 300),
  client     text not null default '' check (length(client) <= 200),
  cols       jsonb not null default '[]' check (jsonb_typeof(cols) = 'array' and jsonb_array_length(cols) <= 60),
  prev       jsonb check (prev is null or jsonb_typeof(prev) = 'array'),
  prio       text not null default 'med' check (prio in ('high','med','low')),
  due        date,
  labels     jsonb not null default '[]' check (jsonb_typeof(labels) = 'array'),
  by_emp     bigint references public.employees (id) on delete set null,
  done       boolean not null default false,
  descr      text not null default '' check (length(descr) <= 20000),
  subs       jsonb not null default '[]' check (jsonb_typeof(subs) = 'array' and jsonb_array_length(subs) <= 200),
  comments   jsonb not null default '[]' check (jsonb_typeof(comments) = 'array' and jsonb_array_length(comments) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_by on public.tasks (by_emp);

-- One row: the custom columns, and the order cards appear in.
create table if not exists public.task_board (
  id      int primary key check (id = 1),
  columns jsonb not null default '[]' check (jsonb_typeof(columns) = 'array' and jsonb_array_length(columns) <= 40),
  ord     jsonb not null default '[]' check (jsonb_typeof(ord) = 'array' and jsonb_array_length(ord) <= 5000)
);
insert into public.task_board (id) values (1) on conflict do nothing;

create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  kind       text not null default 'general' check (length(kind) <= 30),
  title      text not null check (length(title) between 1 and 200),
  body       text not null default '' check (length(body) <= 2000),
  by_emp     bigint references public.employees (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.task_board enable row level security;
alter table public.announcements enable row level security;

-- Tasks
drop policy if exists "staff read tasks" on public.tasks;
create policy "staff read tasks" on public.tasks for select using (public.is_staff());

drop policy if exists "staff add tasks" on public.tasks;
create policy "staff add tasks" on public.tasks for insert with check (public.is_staff() and by_emp = public.my_employee_id());

drop policy if exists "involved change tasks" on public.tasks;
create policy "involved change tasks" on public.tasks for update
  using (public.is_admin() or by_emp = public.my_employee_id()
         or cols @> to_jsonb(public.my_employee_id()) or coalesce(prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id()))
  with check (public.is_staff());

drop policy if exists "involved delete tasks" on public.tasks;
create policy "involved delete tasks" on public.tasks for delete
  using (public.is_admin() or by_emp = public.my_employee_id()
         or cols @> to_jsonb(public.my_employee_id()) or coalesce(prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id()));

-- The creator and creation time never change.
create or replace function public.keep_task_origin()
returns trigger language plpgsql as $$
begin
  new.by_emp := old.by_emp; new.created_at := old.created_at; new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists tasks_origin on public.tasks;
create trigger tasks_origin before update on public.tasks for each row execute function public.keep_task_origin();

-- Board
drop policy if exists "staff read board" on public.task_board;
create policy "staff read board" on public.task_board for select using (public.is_staff());
drop policy if exists "staff change board" on public.task_board;
create policy "staff change board" on public.task_board for update using (public.is_staff()) with check (public.is_staff());

-- Announcements: everyone reads, admins post and remove.
drop policy if exists "staff read announcements" on public.announcements;
create policy "staff read announcements" on public.announcements for select using (public.is_staff());
drop policy if exists "admins post announcements" on public.announcements;
create policy "admins post announcements" on public.announcements for insert with check (public.is_admin() and by_emp = public.my_employee_id());
drop policy if exists "admins remove announcements" on public.announcements;
create policy "admins remove announcements" on public.announcements for delete using (public.is_admin());

-- Live updates: other people's changes reach open screens straight away.
do $$ begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.task_board; exception when duplicate_object or undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object or undefined_object then null; end $$;
