-- 0047: payslip files are not kept. Once the employee has downloaded their payslip, the file is deleted from the database and only the
-- history stays as text (who it was for, which month, who delivered it and when, the file name and size, and when it was downloaded).
-- If someone needs another copy they ask again and an admin uploads a fresh file. Run after 0046.
alter table public.payslip_requests add column if not exists downloaded_at timestamptz;
do $$ begin alter table public.payslip_requests drop constraint payslip_requests_status_check; exception when undefined_object then null; end $$;
alter table public.payslip_requests add constraint payslip_requests_status_check check (status in ('requested', 'delivered', 'downloaded', 'declined', 'cancelled'));
-- (the "one live request per month" index only covers requested and delivered, so a downloaded month can be asked for again)

-- The file, for its owner or an admin, only while it is still stored
create or replace function public.get_payslip_file(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.payslip_requests; bin bytea;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into r from public.payslip_requests where id = p_id;
  if not found or not (public.is_admin() or r.employee_id = public.my_employee_id()) then raise exception 'Not allowed'; end if;
  if r.status = 'downloaded' then raise exception 'That payslip was downloaded and the file has been removed'; end if;
  if r.status <> 'delivered' then raise exception 'Not allowed'; end if;
  select data into bin from public.payslip_files where request_id = p_id;
  if bin is null then raise exception 'That file is missing'; end if;
  return jsonb_build_object('name', r.file_name, 'type', r.file_type, 'data', replace(encode(bin, 'base64'), E'\n', ''));
end;
$$;

-- The employee's browser calls this once their download has started: the file is deleted and the request becomes history.
-- Only the person the payslip is for can do this (an admin looking at the file never removes it). Safe to call twice.
create or replace function public.confirm_payslip_downloaded(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.payslip_requests;
begin
  select * into r from public.payslip_requests where id = p_id and employee_id = public.my_employee_id();
  if not found then raise exception 'Not allowed'; end if;
  if r.status = 'downloaded' then return; end if;
  if r.status <> 'delivered' then raise exception 'Not allowed'; end if;
  delete from public.payslip_files where request_id = p_id;
  update public.payslip_requests set status = 'downloaded', downloaded_at = now() where id = p_id;
end;
$$;
revoke all on function public.get_payslip_file(uuid), public.confirm_payslip_downloaded(uuid) from public, anon;
grant execute on function public.get_payslip_file(uuid), public.confirm_payslip_downloaded(uuid) to authenticated;
