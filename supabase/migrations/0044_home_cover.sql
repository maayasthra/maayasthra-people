-- 0044: each person can set their own cover picture for the top of their Home page. Only they see it (and nobody else can change it).
-- Stored as a small data URL (the app checks the file is under 2 MB and shrinks it before saving). No row means the default cover. Run after 0043.
-- This replaces an earlier draft that had one shared cover; the drops below make it safe to run either way.
drop function if exists public.set_cover(text);
drop table if exists public.app_cover;

create table if not exists public.employee_covers (
  employee_id bigint primary key references public.employees (id) on delete cascade,
  image       text not null default '' check (length(image) <= 700000 and (image = '' or image like 'data:image/%')),
  updated_at  timestamptz not null default now()
);
alter table public.employee_covers enable row level security;
drop policy if exists "read own cover" on public.employee_covers;
create policy "read own cover" on public.employee_covers for select using (employee_id = public.my_employee_id());

create or replace function public.set_my_cover(p_image text)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_image is null then p_image := ''; end if;
  if p_image <> '' and p_image not like 'data:image/%' then raise exception 'That is not a picture'; end if;
  if length(p_image) > 700000 then raise exception 'That picture is too large'; end if;
  insert into public.employee_covers (employee_id, image, updated_at) values (me, p_image, now())
  on conflict (employee_id) do update set image = excluded.image, updated_at = now();
end;
$$;
revoke all on function public.set_my_cover(text) from public, anon;
grant execute on function public.set_my_cover(text) to authenticated;
