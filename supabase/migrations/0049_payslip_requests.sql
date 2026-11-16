-- 0049: payslip requests. An employee asks for the payslip of a past month; admins see the request under Requests > Payslips and
-- deliver the file there (a PDF or an image, up to 2 MB). The employee downloads it from their Payslips page and gets a bell notification.
-- Payslips are private: a person reads only their own requests and files, admins read everyone's. Files live in their own table that the
-- app can never read directly; they are only handed out by get_payslip_file to the owner or an admin. Run after 0045.

create table if not exists public.payslip_requests (
  id             uuid primary key default gen_random_uuid(),
  employee_id    bigint not null references public.employees (id) on delete cascade,
  month          date   not null check (month = date_trunc('month', month)::date),     -- the first day of the month asked for
  status         text   not null default 'requested' check (status in ('requested', 'delivered', 'declined', 'cancelled')),
  note           text   not null default '' check (length(note) <= 300),                -- what the employee wrote
  requested_at   timestamptz not null default now(),
  decided_by     bigint references public.employees (id) on delete set null,
  decided_at     timestamptz,
  decline_reason text   not null default '' check (length(decline_reason) <= 300),
  file_name      text   not null default '' check (length(file_name) <= 120),
  file_type      text   not null default '' check (file_type in ('', 'application/pdf', 'image/png', 'image/jpeg')),
  file_size      int    not null default 0 check (file_size >= 0 and file_size <= 2097152)
);
-- One live request per person per month; a declined or cancelled one can be asked for again
create unique index if not exists payslip_one_open on public.payslip_requests (employee_id, month) where status in ('requested', 'delivered');
create index if not exists payslip_by_status on public.payslip_requests (status, requested_at);

create table if not exists public.payslip_files (
  request_id uuid primary key references public.payslip_requests (id) on delete cascade,
  data       bytea not null check (octet_length(data) between 1 and 2097152)
);

alter table public.payslip_requests enable row level security;
alter table public.payslip_files enable row level security;      -- no policies: nothing reads this table directly
drop policy if exists "own or admin read payslip requests" on public.payslip_requests;
create policy "own or admin read payslip requests" on public.payslip_requests for select
  using (public.is_staff() and (public.is_admin() or employee_id = public.my_employee_id()));
revoke all on public.payslip_requests, public.payslip_files from public, anon, authenticated;
grant select on public.payslip_requests to authenticated;

do $$ begin alter publication supabase_realtime add table public.payslip_requests; exception when duplicate_object or undefined_object then null; end $$;

-- The bell can now carry a payslip notification
do $$ begin alter table public.notifications drop constraint notifications_kind_check; exception when undefined_object then null; end $$;
alter table public.notifications add constraint notifications_kind_check check (kind in ('task', 'eod', 'payslip'));

-- Ask for a payslip. Only completed months, up to a year back, and not before the person joined.
create or replace function public.request_payslip(p_month date, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); e public.employees; new_id uuid; this_month date := date_trunc('month', public.today_ist())::date;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into e from public.employees where id = me;
  if p_month is null or p_month <> date_trunc('month', p_month)::date then raise exception 'Choose a month'; end if;
  if p_month >= this_month then raise exception 'That month is not finished yet'; end if;
  if p_month < (this_month - interval '12 months')::date then raise exception 'You can ask for the last 12 months'; end if;
  if e.join_date is not null and p_month < date_trunc('month', e.join_date)::date then raise exception 'You had not joined by then'; end if;
  if length(coalesce(p_note, '')) > 300 then raise exception 'That note is too long'; end if;
  begin
    insert into public.payslip_requests (employee_id, month, note) values (me, p_month, trim(coalesce(p_note, ''))) returning payslip_requests.id into new_id;
  exception when unique_violation then raise exception 'You already asked for that month';
  end;
  return new_id;
end;
$$;

-- Withdraw a request that has not been answered
create or replace function public.cancel_payslip_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payslip_requests set status = 'cancelled', decided_at = now()
    where id = p_id and employee_id = public.my_employee_id() and status = 'requested';
  if not found then raise exception 'That request cannot be cancelled'; end if;
end;
$$;

-- Admin: say why a payslip cannot be given yet
create or replace function public.decline_payslip(p_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r public.payslip_requests; m text;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if length(coalesce(p_reason, '')) > 300 then raise exception 'That reason is too long'; end if;
  update public.payslip_requests set status = 'declined', decided_by = public.my_employee_id(), decided_at = now(), decline_reason = trim(coalesce(p_reason, ''))
    where id = p_id and status = 'requested' returning * into r;
  if not found then raise exception 'That request is not waiting'; end if;
  m := to_char(r.month, 'Mon YYYY');
  insert into public.notifications (employee_id, key, kind, title, body, ref, read)
    values (r.employee_id, 'payslip-' || r.id, 'payslip', 'Your payslip request for ' || m || ' was declined', case when r.decline_reason <> '' then r.decline_reason else 'Open Payslips for details.' end, r.id::text, false)
    on conflict (employee_id, key) do update set title = excluded.title, body = excluded.body, read = false, created_at = now();
end;
$$;

-- Admin: attach the payslip file (base64) to a request. Calling it again on a delivered request replaces the file.
create or replace function public.deliver_payslip(p_id uuid, p_name text, p_type text, p_data text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.payslip_requests; bin bytea; ok boolean;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_type is null or p_type not in ('application/pdf', 'image/png', 'image/jpeg') then raise exception 'Send a PDF, PNG or JPG file'; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 120 then raise exception 'The file needs a name (120 characters at most)'; end if;
  begin bin := decode(coalesce(p_data, ''), 'base64'); exception when others then raise exception 'That file could not be read'; end;
  if bin is null or octet_length(bin) = 0 then raise exception 'That file is empty'; end if;
  if octet_length(bin) > 2097152 then raise exception 'That file is over 2 MB'; end if;
  ok := case p_type when 'application/pdf' then substring(bin from 1 for 4) = '\x25504446'::bytea
                    when 'image/png' then substring(bin from 1 for 4) = '\x89504e47'::bytea
                    else substring(bin from 1 for 3) = '\xffd8ff'::bytea end;
  if not ok then raise exception 'That file does not look like a %', case p_type when 'application/pdf' then 'PDF' when 'image/png' then 'PNG' else 'JPG' end; end if;
  select * into r from public.payslip_requests where id = p_id and status in ('requested', 'delivered') for update;
  if not found then raise exception 'That request is not waiting'; end if;
  insert into public.payslip_files (request_id, data) values (p_id, bin) on conflict (request_id) do update set data = excluded.data;
  update public.payslip_requests set status = 'delivered', decided_by = public.my_employee_id(), decided_at = now(),
    file_name = trim(p_name), file_type = p_type, file_size = octet_length(bin), decline_reason = '' where id = p_id;
  insert into public.notifications (employee_id, key, kind, title, body, ref, read)
    values (r.employee_id, 'payslip-' || r.id, 'payslip', 'Your payslip for ' || to_char(r.month, 'Mon YYYY') || ' is ready', 'Open Payslips to download it.', r.id::text, false)
    on conflict (employee_id, key) do update set title = excluded.title, body = excluded.body, read = false, created_at = now();
end;
$$;

-- The file itself, only for its owner or an admin, only once delivered
create or replace function public.get_payslip_file(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.payslip_requests; bin bytea;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into r from public.payslip_requests where id = p_id;
  if not found or r.status <> 'delivered' or not (public.is_admin() or r.employee_id = public.my_employee_id()) then raise exception 'Not allowed'; end if;
  select data into bin from public.payslip_files where request_id = p_id;
  if bin is null then raise exception 'That file is missing'; end if;
  return jsonb_build_object('name', r.file_name, 'type', r.file_type, 'data', replace(encode(bin, 'base64'), E'\n', ''));
end;
$$;

revoke all on function public.request_payslip(date, text), public.cancel_payslip_request(uuid), public.decline_payslip(uuid, text), public.deliver_payslip(uuid, text, text, text), public.get_payslip_file(uuid) from public, anon;
grant execute on function public.request_payslip(date, text), public.cancel_payslip_request(uuid), public.decline_payslip(uuid, text), public.deliver_payslip(uuid, text, text, text), public.get_payslip_file(uuid) to authenticated;
