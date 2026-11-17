-- Preserve note drafts and bind file cleanup to the exact downloaded payslip.
-- Additive upgrade: existing files/history are preserved. Old clients must refresh
-- before they can acknowledge a download; their acknowledgement cannot delete data.
drop policy if exists "own notes read" on public.notes;
create policy "own notes read" on public.notes for select using (public.is_staff() and employee_id=public.my_employee_id());
drop policy if exists "own notes add" on public.notes;
create policy "own notes add" on public.notes for insert with check (public.is_staff() and employee_id=public.my_employee_id());
drop policy if exists "own notes change" on public.notes;
create policy "own notes change" on public.notes for update using (public.is_staff() and employee_id=public.my_employee_id()) with check (public.is_staff() and employee_id=public.my_employee_id());
drop policy if exists "own notes remove" on public.notes;
create policy "own notes remove" on public.notes for delete using (public.is_staff() and employee_id=public.my_employee_id());

alter table public.payslip_files add column if not exists revision uuid not null default gen_random_uuid();
alter table public.payslip_requests add column if not exists downloaded_revision uuid;
create or replace function public.payslip_file_revision() returns trigger
language plpgsql set search_path=public as $$
begin new.revision:=gen_random_uuid(); return new; end $$;
drop trigger if exists payslip_file_revision on public.payslip_files;
create trigger payslip_file_revision before update on public.payslip_files for each row execute function public.payslip_file_revision();
revoke all on function public.payslip_file_revision() from public,anon,authenticated;

create or replace function public.cancel_payslip_request(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  update public.payslip_requests set status='cancelled',decided_at=now()
    where id=p_id and employee_id=public.my_employee_id() and status='requested';
  if not found then raise exception 'That request cannot be cancelled'; end if;
end $$;

create or replace function public.get_payslip_file(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  -- One statement snapshot keeps filename, content and revision from the same delivery.
  select jsonb_build_object('status',r.status,'name',r.file_name,'type',r.file_type,'revision',f.revision,
    'data',replace(encode(f.data,'base64'),E'\n','')) into answer
    from public.payslip_requests r left join public.payslip_files f on f.request_id=r.id
    where r.id=p_id and (public.is_admin() or r.employee_id=public.my_employee_id());
  if answer is null then raise exception 'Not allowed'; end if;
  if answer->>'status'='downloaded' then raise exception 'That payslip was downloaded and the file has been removed'; end if;
  if answer->>'status'<>'delivered' then raise exception 'Not allowed'; end if;
  if answer->>'data' is null then raise exception 'That file is missing'; end if;
  return answer-'status';
end $$;

create or replace function public.confirm_payslip_downloaded(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  raise exception 'Refresh the app before confirming this download. The file has been kept.';
end $$;

create or replace function public.confirm_payslip_downloaded(p_id uuid,p_revision uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.payslip_requests;
begin
  if not public.is_staff() or p_revision is null then raise exception 'Not allowed'; end if;
  -- Same request-first lock order as deliver_payslip. A replacement cannot occur
  -- between revision comparison and removal.
  select * into r from public.payslip_requests where id=p_id and employee_id=public.my_employee_id() for update;
  if not found then raise exception 'Not allowed'; end if;
  if r.status='downloaded' and r.downloaded_revision=p_revision then return; end if;
  if r.status<>'delivered' then raise exception 'Not allowed'; end if;
  delete from public.payslip_files where request_id=p_id and revision=p_revision;
  if not found then raise exception 'This payslip was replaced. Download the current file; it has been kept.'; end if;
  update public.payslip_requests set status='downloaded',downloaded_at=now(),downloaded_revision=p_revision where id=p_id;
end $$;
revoke all on function public.cancel_payslip_request(uuid),public.get_payslip_file(uuid),public.confirm_payslip_downloaded(uuid),public.confirm_payslip_downloaded(uuid,uuid) from public,anon;
grant execute on function public.cancel_payslip_request(uuid),public.get_payslip_file(uuid),public.confirm_payslip_downloaded(uuid),public.confirm_payslip_downloaded(uuid,uuid) to authenticated;
