-- 0022: Board groups. Admins group the board's columns by hand, each group with its own name, colour and emoji. Run after 0021.
create table if not exists public.board_groups (
  id       text primary key,
  name     text not null default '' check (char_length(name) <= 60),
  color    text not null default '#8E8E93' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon     text not null default '' check (char_length(icon) <= 8),
  members  jsonb not null default '[]'::jsonb,
  position int not null default 0
);
alter table public.board_groups enable row level security;

-- Anyone signed in can see the groups (the board shows them). Only admins change them.
drop policy if exists "staff read groups" on public.board_groups;
create policy "staff read groups" on public.board_groups for select using (public.is_staff());
drop policy if exists "admins add groups" on public.board_groups;
create policy "admins add groups" on public.board_groups for insert with check (public.is_admin());
drop policy if exists "admins change groups" on public.board_groups;
create policy "admins change groups" on public.board_groups for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins remove groups" on public.board_groups;
create policy "admins remove groups" on public.board_groups for delete using (public.is_admin());
grant select, insert, update, delete on public.board_groups to authenticated;

do $$ begin alter publication supabase_realtime add table public.board_groups; exception when duplicate_object or undefined_object then null; end $$;
