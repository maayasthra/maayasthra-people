-- 0051: Personal notes. Every person has their own notes; nobody else can read, change or delete them, admins included
-- (the rules below only ever match the signed-in person's own rows). Notes live in the database, so they are the same on every device.
-- Run after 0050.

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  employee_id bigint not null references public.employees (id) on delete cascade,
  title       text not null default '' check (length(title) <= 200),
  body        text not null default '' check (length(body) <= 20000),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notes_by_person on public.notes (employee_id, updated_at desc);
alter table public.notes enable row level security;

drop policy if exists "own notes read" on public.notes;
create policy "own notes read" on public.notes for select using (employee_id = public.my_employee_id());
drop policy if exists "own notes add" on public.notes;
create policy "own notes add" on public.notes for insert with check (employee_id = public.my_employee_id());
drop policy if exists "own notes change" on public.notes;
create policy "own notes change" on public.notes for update using (employee_id = public.my_employee_id()) with check (employee_id = public.my_employee_id());
drop policy if exists "own notes remove" on public.notes;
create policy "own notes remove" on public.notes for delete using (employee_id = public.my_employee_id());
revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;

-- A note cannot be handed to someone else by editing its owner
create or replace function public.notes_keep_owner()
returns trigger language plpgsql as $$
begin
  new.employee_id := old.employee_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists notes_keep_owner on public.notes;
create trigger notes_keep_owner before update on public.notes for each row execute function public.notes_keep_owner();

-- At most 500 notes each
create or replace function public.notes_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.notes where employee_id = new.employee_id) >= 500 then
    raise exception 'You have reached the limit of 500 notes. Delete some to add more.';
  end if;
  return new;
end;
$$;
drop trigger if exists notes_limit on public.notes;
create trigger notes_limit before insert on public.notes for each row execute function public.notes_limit();

do $$ begin alter publication supabase_realtime add table public.notes; exception when duplicate_object or undefined_object then null; end $$;
