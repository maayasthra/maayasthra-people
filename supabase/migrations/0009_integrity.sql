-- Maayasthra People: integrity rules, enforced by the database itself.
-- Run after 0008_leave_types.sql, in the Supabase SQL Editor.
-- Until now several rules only lived in the browser. These make them impossible to bypass.

-- ---- Leave -----------------------------------------------------------------
-- Working days between two dates: not a weekend, not a listed holiday.
create or replace function public.working_days(a date, b date)
returns int language sql stable set search_path = public as $$
  select count(*)::int from generate_series(a::timestamp, b::timestamp, interval '1 day') d
  where extract(isodow from d) < 6 and not exists (select 1 from public.holidays h where h.day = d::date)
$$;

create or replace function public.validate_leave_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare pol public.leave_policy; wd int; cap numeric; used numeric;
begin
  select * into pol from public.leave_policy where id = 1;
  if new.from_date < public.today_ist() then raise exception 'Choose a start date from today onwards'; end if;
  wd := public.working_days(new.from_date, new.to_date);
  if wd = 0 then raise exception 'Those dates fall on weekends or holidays only'; end if;
  if new.half then
    if not pol.half then raise exception 'Half days are not allowed'; end if;
    if new.from_date <> new.to_date or wd <> 1 or new.days <> 0.5 then raise exception 'A half day must be a single working day'; end if;
  elsif new.days <> wd then
    raise exception 'The number of days does not match the dates';
  end if;
  if pol.note and btrim(new.reason) = '' then raise exception 'Add a short note for the approver'; end if;
  if new.type not in ('Sick leave', 'Emergency leave')
     and public.working_days(public.today_ist() + 1, new.from_date - 1) < pol.notice then
    raise exception 'Planned leave needs % working days notice', pol.notice;
  end if;
  if exists (select 1 from public.leave_requests r where r.employee_id = new.employee_id and r.state in ('pending', 'approved')
             and r.from_date <= new.to_date and r.to_date >= new.from_date) then
    raise exception 'You already have leave on those dates';
  end if;
  cap := (pol.allow ->> new.type)::numeric;
  select coalesce(sum(r.days), 0) into used from public.leave_requests r
    where r.employee_id = new.employee_id and r.type = new.type and r.state in ('pending', 'approved')
      and extract(year from r.from_date) = extract(year from new.from_date);
  if used + new.days > cap then raise exception 'Not enough % left this year', lower(new.type); end if;
  return new;
end;
$$;
drop trigger if exists leave_validate on public.leave_requests;
create trigger leave_validate before insert on public.leave_requests for each row execute function public.validate_leave_request();

-- ---- Admins ----------------------------------------------------------------
-- There is always at least one active admin.
create or replace function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'Admin' and old.status <> 'Exited'
     and (tg_op = 'DELETE' or new.role <> 'Admin' or new.status = 'Exited')
     and not exists (select 1 from public.employees e where e.role = 'Admin' and e.status <> 'Exited' and e.id <> old.id) then
    raise exception 'There must be at least one admin';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists employees_keep_admin on public.employees;
create trigger employees_keep_admin before update of role, status or delete on public.employees for each row execute function public.keep_one_admin();

-- Reasonable limits on what a profile can hold.
do $$ begin
  alter table public.employees add constraint employees_photo_size check (length(photo) <= 400000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.employees add constraint employees_bio_size check (length(bio) <= 2000);
exception when duplicate_object then null; end $$;

-- ---- Tasks -----------------------------------------------------------------
-- Subtasks and comments are changed one item at a time, so two people working on the same card never overwrite each other.
create or replace function public.can_edit_task(p_task text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and (
    public.is_admin() or t.by_emp = public.my_employee_id()
    or t.cols @> to_jsonb(public.my_employee_id()) or coalesce(t.prev, '[]'::jsonb) @> to_jsonb(public.my_employee_id())))
$$;

create or replace function public.patch_task_list(p_task text, p_kind text, p_op text, p_item jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id();
begin
  if p_kind not in ('subs', 'comments') or p_op not in ('add', 'set', 'remove') or jsonb_typeof(p_item) <> 'object' then raise exception 'Invalid change'; end if;
  if not public.can_edit_task(p_task) then raise exception 'You can only change cards you created or are on'; end if;
  if p_kind = 'comments' then
    if p_op = 'add' and (p_item ->> 'by')::bigint is distinct from me then raise exception 'Invalid comment author'; end if;
    if p_op = 'set' then raise exception 'Comments cannot be edited'; end if;
    if p_op = 'remove' and not public.is_admin() and not exists (
      select 1 from public.tasks t, jsonb_array_elements(t.comments) c where t.id = p_task and c ->> 'id' = p_item ->> 'id' and (c ->> 'by')::bigint = me)
    then raise exception 'You can only remove your own comments'; end if;
  end if;
  if p_kind = 'subs' then
    update public.tasks set subs = case p_op
      when 'add' then subs || jsonb_build_array(p_item)
      when 'set' then coalesce((select jsonb_agg(case when e ->> 'id' = p_item ->> 'id' then p_item else e end order by o) from jsonb_array_elements(subs) with ordinality x(e, o)), '[]'::jsonb)
      else coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(subs) with ordinality x(e, o) where e ->> 'id' <> p_item ->> 'id'), '[]'::jsonb) end
    where id = p_task;
  else
    update public.tasks set comments = case p_op
      when 'add' then comments || jsonb_build_array(p_item)
      else coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(comments) with ordinality x(e, o) where e ->> 'id' <> p_item ->> 'id'), '[]'::jsonb) end
    where id = p_task;
  end if;
end;
$$;
revoke all on function public.patch_task_list(text, text, text, jsonb), public.can_edit_task(text) from public, anon;
grant execute on function public.patch_task_list(text, text, text, jsonb), public.can_edit_task(text) to authenticated;

-- ---- Attendance ------------------------------------------------------------
-- A check-in left open on an earlier day is closed at that day's shift end the next time the person checks in.
create or replace function public.check_in(p_loc text default 'office')
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); e public.employees; cur jsonb; loc text := case when p_loc = 'home' then 'home' else 'office' end;
begin
  select * into e from public.employees where id = me;
  if not found or e.status = 'Exited' then raise exception 'No active staff record for this account'; end if;
  if (now() at time zone 'Asia/Kolkata')::time >= e.shift_end then raise exception 'Your working hours have ended'; end if;
  update public.attendance_days d set sessions = jsonb_set(d.sessions, array[(jsonb_array_length(d.sessions) - 1)::text, 'out'],
      to_jsonb(greatest((d.sessions -> -1 ->> 'in')::bigint, (extract(epoch from ((d.day + e.shift_end) at time zone 'Asia/Kolkata')) * 1000)::bigint)))
    where d.employee_id = me and d.day < public.today_ist() and jsonb_array_length(d.sessions) > 0 and (d.sessions -> -1 ->> 'out') is null;
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist();
  if cur is not null and jsonb_array_length(cur) > 0 and (cur -> -1 ->> 'out') is null then raise exception 'You are already checked in'; end if;
  insert into public.attendance_days (employee_id, day, sessions)
    values (me, public.today_ist(), jsonb_build_array(jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc)))
  on conflict (employee_id, day) do update
    set sessions = public.attendance_days.sessions || jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc), updated_at = now();
end;
$$;
