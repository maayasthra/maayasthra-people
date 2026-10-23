-- Board layout: the order of columns and which columns are hidden. Shared by everyone, changed only by admins.
-- Run after 0010_profile_and_leave.sql, in the Supabase SQL Editor.

create table if not exists public.board_layout (
  id        int primary key check (id = 1),
  col_order jsonb not null default '[]' check (jsonb_typeof(col_order) = 'array' and jsonb_array_length(col_order) <= 200),
  hidden    jsonb not null default '[]' check (jsonb_typeof(hidden) = 'array' and jsonb_array_length(hidden) <= 200)
);
insert into public.board_layout (id) values (1) on conflict do nothing;

alter table public.board_layout enable row level security;
drop policy if exists "staff read layout" on public.board_layout;
create policy "staff read layout" on public.board_layout for select using (public.is_staff());
drop policy if exists "admins change layout" on public.board_layout;
create policy "admins change layout" on public.board_layout for update using (public.is_admin()) with check (public.is_admin());

-- For now, hide these five people's columns. Admins can show them again from the Columns button on the board.
update public.board_layout set hidden = coalesce((
  select jsonb_agg(id order by id) from public.employees
  where email in ('harish@maayasthra.com', 'arunkumar@maayasthra.com', 'vandhana@maayasthra.com', 'vijay@maayasthra.com', 'yogan@maayasthra.com')
), '[]'::jsonb)
where id = 1 and hidden = '[]'::jsonb;

do $$ begin alter publication supabase_realtime add table public.board_layout; exception when duplicate_object or undefined_object then null; end $$;
