-- 0015: fixes from a full review. Run after 0014.

-- 1. Employees could slip a person into a card by editing its history (prev), then moving the card there.
create or replace function public.tasks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare mgr boolean := public.is_pm(); timer boolean := coalesce(current_setting('mp.timer', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not mgr then new.time_log := '[]'::jsonb; new.prev := '[]'::jsonb; end if;
    return new;
  end if;
  if not mgr and not timer then new.time_log := old.time_log; end if;
  if not mgr then
    -- History may only change when a card is completed or reopened, and then only to what the card already had
    if new.prev is distinct from old.prev and not (new.prev <@ (old.cols || coalesce(old.prev, '[]'::jsonb))) then
      new.prev := old.prev;
    end if;
    if exists (select 1 from jsonb_array_elements(new.cols) e
               where not ((old.cols || coalesce(old.prev, '[]'::jsonb) || '["done"]'::jsonb) @> jsonb_build_array(e))) then
      raise exception 'Only admins and project managers can assign cards to other people';
    end if;
  end if;
  return new;
end;
$$;

-- 3. Someone who has left cannot file leave
drop policy if exists "file own leave" on public.leave_requests;
create policy "file own leave" on public.leave_requests for insert
  with check (public.is_staff() and employee_id = public.my_employee_id() and state = 'pending'
    and type in (select jsonb_object_keys(allow) from public.leave_policy));

-- 4. A decision must follow a sensible path, and approving cannot double-book
create or replace function public.stamp_leave_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
  return new;
end;
$$;

-- 13. Cancelling uses India's date
create or replace function public.cancel_leave(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r public.leave_requests;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into r from public.leave_requests where id = p_id and employee_id = public.my_employee_id();
  if not found then raise exception 'Request not found'; end if;
  if not (r.state = 'pending' or (r.state = 'approved' and r.from_date > public.today_ist())) then raise exception 'This request can no longer be cancelled'; end if;
  update public.leave_requests set state = 'cancelled' where id = p_id;
end;
$$;

-- 5. Check-out time comes from the server clock; the browser's time is only a hint (used for the end-of-shift automatic check-out)
create or replace function public.check_out(p_at bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); cur jsonb; n int; t bigint; nowms bigint := public.now_ms();
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select sessions into cur from public.attendance_days where employee_id = me and day = public.today_ist() for update;
  if cur is null or jsonb_array_length(cur) = 0 or (cur -> -1 ->> 'out') is not null then raise exception 'You are not checked in'; end if;
  n := jsonb_array_length(cur);
  t := greatest((cur -> -1 ->> 'in')::bigint, least(coalesce(p_at, nowms), nowms));
  update public.attendance_days set sessions = jsonb_set(sessions, array[(n - 1)::text, 'out'], to_jsonb(t)), updated_at = now()
    where employee_id = me and day = public.today_ist();
  perform set_config('mp.timer', 'on', true);
  update public.tasks set time_log = public.close_sessions(time_log, me, t)
    where exists (select 1 from jsonb_array_elements(time_log) e where (e ->> 'emp')::bigint = me and coalesce(jsonb_typeof(e -> 'end'), 'null') = 'null');
end;
$$;
