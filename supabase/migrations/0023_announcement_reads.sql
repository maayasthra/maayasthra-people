-- 0023: which announcements each person has read (they pop up until closed). Run after 0022.
create table if not exists public.announcement_reads (
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  employee_id     bigint not null references public.employees (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, employee_id)
);
alter table public.announcement_reads enable row level security;

-- People see only their own read marks. They are written through mark_announcement_read.
drop policy if exists "own reads" on public.announcement_reads;
create policy "own reads" on public.announcement_reads for select using (public.is_staff() and employee_id = public.my_employee_id());
revoke insert, update, delete on public.announcement_reads from anon, authenticated;
grant select on public.announcement_reads to authenticated;

create or replace function public.mark_announcement_read(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  insert into public.announcement_reads (announcement_id, employee_id) values (p_id, me) on conflict do nothing;
end;
$$;
revoke all on function public.mark_announcement_read(bigint) from public, anon;
grant execute on function public.mark_announcement_read(bigint) to authenticated;
