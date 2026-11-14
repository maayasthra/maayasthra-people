-- 0044: one cover picture for the top of the Home page. Everyone signed in can see it; only admins can change or remove it.
-- Stored as a small data URL (the app shrinks the picture before saving). An empty value means "use the default cover". Run after 0043.
create table if not exists public.app_cover (
  id         int primary key default 1 check (id = 1),
  image      text not null default '' check (length(image) <= 700000 and (image = '' or image like 'data:image/%')),
  updated_by bigint references public.employees (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_cover enable row level security;
drop policy if exists "staff read cover" on public.app_cover;
create policy "staff read cover" on public.app_cover for select using (public.is_staff());

create or replace function public.set_cover(p_image text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_image is null then p_image := ''; end if;
  if p_image <> '' and p_image not like 'data:image/%' then raise exception 'That is not a picture'; end if;
  if length(p_image) > 700000 then raise exception 'That picture is too large'; end if;
  insert into public.app_cover (id, image, updated_by, updated_at) values (1, p_image, public.my_employee_id(), now())
  on conflict (id) do update set image = excluded.image, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke all on function public.set_cover(text) from public, anon;
grant execute on function public.set_cover(text) to authenticated;
