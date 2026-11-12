-- Serialize attendance/leave on a stable employee row, including first insert.
-- Restore/approve obeys the configured allowance; no undocumented admin override.
begin;
create or replace function public.check_in(p_loc text default 'office')
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); e public.employees; cur jsonb; loc text := case when p_loc = 'home' then 'home' else 'office' end;
begin
  select * into e from public.employees where id = me for update;
  if not found or e.status = 'Exited' then raise exception 'No active staff record for this account'; end if;
  update public.attendance_days d set sessions = jsonb_set(d.sessions, array[(jsonb_array_length(d.sessions) - 1)::text, 'out'],
      to_jsonb(greatest((d.sessions -> -1 ->> 'in')::bigint, (extract(epoch from ((d.day + e.shift_end) at time zone 'Asia/Kolkata')) * 1000)::bigint)))
    where d.employee_id = me and d.day < public.today_ist() and jsonb_array_length(d.sessions) > 0 and (d.sessions -> -1 ->> 'out') is null;
  perform public.close_stale_timers(me, e.shift_end);
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist();
  if cur is not null and jsonb_array_length(cur) > 0 and (cur -> -1 ->> 'out') is null then raise exception 'You are already checked in'; end if;
  insert into public.attendance_days (employee_id, day, sessions)
    values (me, public.today_ist(), jsonb_build_array(jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc)))
  on conflict (employee_id, day) do update
    set sessions = public.attendance_days.sessions || jsonb_build_object('in', public.now_ms(), 'out', null, 'loc', loc), updated_at = now();
end;
$$;

create or replace function public.validate_leave_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare pol public.leave_policy; wd int; cap numeric; used numeric;
begin
  perform id from public.employees where id = new.employee_id for update;
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


create or replace function public.stamp_leave_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap numeric; used numeric;
begin
  perform id from public.employees where id = old.employee_id for update;
  if new.state is distinct from old.state then
    if not ((old.state = 'pending' and new.state in ('approved','declined','cancelled'))
         or (old.state in ('approved','declined') and new.state in ('pending','approved','declined'))
         or (old.state = 'approved' and new.state = 'cancelled')) then
      raise exception 'This request has already changed. Refresh and try again.';
    end if;
    if new.state = 'approved' and exists (select 1 from public.leave_requests o
         where o.employee_id = old.employee_id and o.id <> old.id and o.state = 'approved'
           and o.from_date <= old.to_date and o.to_date >= old.from_date) then
      raise exception 'This overlaps leave that is already approved';
    end if;
    if new.state in ('approved','declined') then new.decided_by := public.my_employee_id(); new.decided_at := now();
    elsif new.state = 'pending' then new.decided_by := null; new.decided_at := null; end if;
  end if;
  new.employee_id := old.employee_id; new.type := old.type; new.from_date := old.from_date; new.to_date := old.to_date;
  new.days := old.days; new.half := old.half; new.reason := old.reason; new.created_at := old.created_at;
  if new.state is distinct from old.state and new.state in ('pending','approved') then
    if exists (select 1 from public.leave_requests r where r.employee_id=old.employee_id and r.id<>old.id
      and r.state in ('pending','approved') and r.from_date<=old.to_date and r.to_date>=old.from_date) then
      raise exception 'You already have leave on those dates';
    end if;
    select (allow->>old.type)::numeric into cap from public.leave_policy where id=1;
    select coalesce(sum(days),0) into used from public.leave_requests where employee_id=old.employee_id
      and id<>old.id and type=old.type and state in ('pending','approved')
      and extract(year from from_date)=extract(year from old.from_date);
    if cap is null or used+old.days>cap then raise exception 'Not enough % left this year',lower(old.type); end if;
  end if;
  return new;
end;
$$;


create or replace function public.submit_eod_for(p_day date, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); nohrs boolean := exists (select 1 from public.profiles where id = auth.uid() and role in ('Admin', 'Project manager') and active); r jsonb; s jsonb; total numeric := 0; sub_total numeric; h numeric; n int := 0;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_day is null or p_day > public.today_ist() or p_day < public.today_ist() - 7 then raise exception 'Not allowed'; end if;
  if p_day < public.today_ist() and exists (select 1 from public.eod_reports where employee_id = me and day = p_day) then raise exception 'That report was already sent'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Add at least one line to your report'; end if;
  if jsonb_array_length(p_rows) > 40 then raise exception 'That report has too many lines'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    if length(trim(coalesce(r ->> 'project', ''))) = 0 then raise exception 'Line %: add the project name', n; end if;
    if length(r ->> 'project') > 200 or length(coalesce(r ->> 'desc', '')) > 1000 then raise exception 'Line %: that is too long', n; end if;
    if jsonb_typeof(r -> 'subs') = 'array' and jsonb_array_length(r -> 'subs') > 0 then
      if jsonb_array_length(r -> 'subs') > 40 then raise exception 'Line %: too many subtasks', n; end if;
      sub_total := 0;
      for s in select * from jsonb_array_elements(r -> 'subs') loop
        if length(trim(coalesce(s ->> 'title', ''))) = 0 then raise exception 'Line %: name each subtask', n; end if;
        if length(s ->> 'title') > 200 or length(coalesce(s ->> 'desc', '')) > 1000 then raise exception 'Line %: that is too long', n; end if;
        h := coalesce(nullif(s ->> 'hours', '')::numeric, 0);
        if nohrs then h := 0; elsif h <= 0 or h > 24 then raise exception 'Line %: enter the hours for every subtask', n; end if;
        sub_total := sub_total + h;
      end loop;
      total := total + sub_total;
    else
      if length(trim(coalesce(r ->> 'desc', ''))) = 0 then raise exception 'Line %: describe what you did', n; end if;
      h := coalesce(nullif(r ->> 'hours', '')::numeric, 0);
      if nohrs then h := 0; elsif h <= 0 or h > 24 then raise exception 'Line %: enter the hours (up to 24)', n; end if;
      total := total + h;
    end if;
  end loop;
  if total > 24 then raise exception 'That adds up to more than 24 hours'; end if;
  insert into public.eod_reports (employee_id, day, rows, total_hours) values (me, p_day, p_rows, total)
  on conflict (employee_id, day) do update set rows = excluded.rows, total_hours = excluded.total_hours, updated_at = now() where p_day = public.today_ist();
  if not found then raise exception 'That report was already sent'; end if;
end;
$$;
revoke all on function public.submit_eod_for(date, jsonb) from public, anon;
grant execute on function public.submit_eod_for(date, jsonb) to authenticated;


commit;
