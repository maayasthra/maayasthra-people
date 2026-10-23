-- Maayasthra People, part 2: leave requests, holidays and leave rules.
-- Run after 0003_signup_guard.sql, in the Supabase SQL Editor.

create table if not exists public.leave_requests (
  id          bigint generated always as identity primary key,
  employee_id bigint not null references public.employees (id) on delete cascade,
  type        text not null,
  from_date   date not null,
  to_date     date not null,
  days        numeric(4,1) not null check (days > 0 and days <= 366),
  half        boolean not null default false,
  reason      text not null default '' check (length(reason) <= 1000),
  state       text not null default 'pending' check (state in ('pending','approved','declined','cancelled')),
  decided_by  bigint references public.employees (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists leave_requests_employee on public.leave_requests (employee_id);

create table if not exists public.holidays (
  day  date primary key,
  name text not null check (length(name) between 1 and 120)
);

-- One row only. allow = days per year for each leave type.
create table if not exists public.leave_policy (
  id     int primary key check (id = 1),
  allow  jsonb   not null default '{"Annual leave":18,"Casual leave":8,"Sick leave":8}',
  notice int     not null default 3 check (notice between 0 and 30),
  half   boolean not null default true,
  note   boolean not null default false
);
insert into public.leave_policy (id) values (1) on conflict do nothing;

alter table public.leave_requests enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_policy enable row level security;

-- Requests: a person sees their own, admins see all. The team sees only who is away, through the view below.
drop policy if exists "own or admin read leave" on public.leave_requests;
create policy "own or admin read leave" on public.leave_requests for select using (public.is_admin() or employee_id = public.my_employee_id());

-- A person can only file a pending request for themselves.
drop policy if exists "file own leave" on public.leave_requests;
create policy "file own leave" on public.leave_requests for insert
  with check (employee_id = public.my_employee_id() and state = 'pending' and decided_by is null
    and type in (select jsonb_object_keys(allow) from public.leave_policy));

-- Only an admin changes a request, and never their own.
drop policy if exists "admins decide leave" on public.leave_requests;
create policy "admins decide leave" on public.leave_requests for update
  using (public.is_admin() and employee_id <> coalesce(public.my_employee_id(), 0))
  with check (public.is_admin() and employee_id <> coalesce(public.my_employee_id(), 0));

-- Record who decided and when.
create or replace function public.stamp_leave_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.state is distinct from old.state then
    if new.state in ('approved','declined') then new.decided_by := public.my_employee_id(); new.decided_at := now();
    elsif new.state = 'pending' then new.decided_by := null; new.decided_at := null; end if;
  end if;
  -- Nothing but the decision may change here.
  new.employee_id := old.employee_id; new.type := old.type; new.from_date := old.from_date; new.to_date := old.to_date;
  new.days := old.days; new.half := old.half; new.reason := old.reason; new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists leave_stamp on public.leave_requests;
create trigger leave_stamp before update on public.leave_requests for each row execute function public.stamp_leave_decision();

-- A person withdraws their own pending request, or cancels an approved one that has not started.
create or replace function public.cancel_leave(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r public.leave_requests;
begin
  select * into r from public.leave_requests where id = p_id and employee_id = public.my_employee_id();
  if not found then raise exception 'Request not found'; end if;
  if not (r.state = 'pending' or (r.state = 'approved' and r.from_date > current_date)) then raise exception 'This request can no longer be cancelled'; end if;
  update public.leave_requests set state = 'cancelled' where id = p_id;
end;
$$;
revoke all on function public.cancel_leave(bigint) from public, anon;
grant execute on function public.cancel_leave(bigint) to authenticated;

-- Who is away, for the calendar and team views. No reason is shown.
create or replace view public.leave_away as
  select id, employee_id, type, from_date, to_date, days, half
  from public.leave_requests
  where state = 'approved' and public.is_staff();
revoke all on public.leave_away from public, anon;
grant select on public.leave_away to authenticated;

-- Holidays and rules: every active person reads them, only admins change them.
drop policy if exists "staff read holidays" on public.holidays;
create policy "staff read holidays" on public.holidays for select using (public.is_staff());
drop policy if exists "admins write holidays" on public.holidays;
create policy "admins write holidays" on public.holidays for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "staff read policy" on public.leave_policy;
create policy "staff read policy" on public.leave_policy for select using (public.is_staff());
drop policy if exists "admins edit policy" on public.leave_policy;
create policy "admins edit policy" on public.leave_policy for update using (public.is_admin()) with check (public.is_admin());
