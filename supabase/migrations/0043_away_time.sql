-- 0043: away time. A person who is checked in can step away (power cut, stepped out, break...) and come back; the time away is not
-- counted as worked. If they could not press anything (a power cut), they can add the time afterwards for today or yesterday.
-- A reason for leaving early can be noted too. Admins can remove an away entry. Run after 0042.
--   away  = [{ "from": ms, "to": ms or null, "why": key, "note": text or null, "later": bool }]   (to = null while still away)
--   early = { "why": key, "note": text or null, "at": ms }
alter table public.attendance_days add column if not exists away jsonb not null default '[]'
  check (jsonb_typeof(away) = 'array' and jsonb_array_length(away) <= 20);
alter table public.attendance_days add column if not exists early jsonb
  check (early is null or jsonb_typeof(early) = 'object');

-- Checking out (or an old open day being closed) ends an away period that was still running, at the check-out time.
create or replace function public.close_open_away() returns trigger language plpgsql as $$
declare n int := jsonb_array_length(new.away);
begin
  if n > 0 and (new.away -> -1 ->> 'to') is null and jsonb_array_length(new.sessions) > 0 and (new.sessions -> -1 ->> 'out') is not null then
    new.away := jsonb_set(new.away, array[(n - 1)::text, 'to'], to_jsonb(greatest((new.sessions -> -1 ->> 'out')::bigint, (new.away -> -1 ->> 'from')::bigint)));
  end if;
  return new;
end;
$$;
drop trigger if exists attendance_close_away on public.attendance_days;
create trigger attendance_close_away before insert or update on public.attendance_days
  for each row execute function public.close_open_away();

-- Step away now. Only while checked in, and only one at a time.
create or replace function public.go_away(p_why text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); d public.attendance_days;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_why is null or p_why not in ('power', 'net', 'out', 'break', 'meet', 'other') then raise exception 'Choose a reason'; end if;
  if length(coalesce(p_note, '')) > 200 then raise exception 'That note is too long'; end if;
  select * into d from public.attendance_days where employee_id = me and day = public.today_ist() for update;
  if not found or jsonb_array_length(d.sessions) = 0 or (d.sessions -> -1 ->> 'out') is not null then raise exception 'You are not checked in'; end if;
  if jsonb_array_length(d.away) > 0 and (d.away -> -1 ->> 'to') is null then raise exception 'You are already away'; end if;
  if jsonb_array_length(d.away) >= 20 then raise exception 'Too many away periods today'; end if;
  update public.attendance_days set away = away || jsonb_build_object('from', public.now_ms(), 'to', null, 'why', p_why, 'note', nullif(trim(coalesce(p_note, '')), ''), 'later', false), updated_at = now()
    where employee_id = me and day = public.today_ist();
end;
$$;

-- Back at the desk: ends the away period that is running.
create or replace function public.come_back()
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); d public.attendance_days; n int;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into d from public.attendance_days where employee_id = me and day = public.today_ist() for update;
  n := case when found then jsonb_array_length(d.away) else 0 end;
  if n = 0 or (d.away -> -1 ->> 'to') is not null then raise exception 'You are not away'; end if;
  update public.attendance_days set away = jsonb_set(away, array[(n - 1)::text, 'to'], to_jsonb(greatest(public.now_ms(), (d.away -> -1 ->> 'from')::bigint))), updated_at = now()
    where employee_id = me and day = public.today_ist();
end;
$$;

-- Add time that was already away (the power was out, so nothing could be pressed). Today or yesterday only, never in the future,
-- never overlapping another away period, and the person must have checked in that day. Marked "later" so it can be told apart.
create or replace function public.add_away(p_day date, p_from bigint, p_to bigint, p_why text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); d public.attendance_days; a jsonb; day0 bigint; nowms bigint := public.now_ms();
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_day is null or p_day > public.today_ist() or p_day < public.today_ist() - 1 then raise exception 'You can add away time for today or yesterday only'; end if;
  if p_why is null or p_why not in ('power', 'net', 'out', 'break', 'meet', 'other') then raise exception 'Choose a reason'; end if;
  if length(coalesce(p_note, '')) > 200 then raise exception 'That note is too long'; end if;
  day0 := (extract(epoch from (p_day::timestamp at time zone 'Asia/Kolkata')) * 1000)::bigint;
  if p_from is null or p_to is null or p_to <= p_from or p_from < day0 or p_to > day0 + 86400000 then raise exception 'Those times are not valid'; end if;
  if p_to > nowms + 5000 then raise exception 'That time has not happened yet'; end if;
  if p_to - p_from > 43200000 then raise exception 'Away time can be 12 hours at most'; end if;
  select * into d from public.attendance_days where employee_id = me and day = p_day for update;
  if not found or jsonb_array_length(d.sessions) = 0 then raise exception 'You have no check-in on that day'; end if;
  if jsonb_array_length(d.away) >= 20 then raise exception 'Too many away periods that day'; end if;
  for a in select * from jsonb_array_elements(d.away) loop
    if p_from < coalesce((a ->> 'to')::bigint, nowms) and p_to > (a ->> 'from')::bigint then raise exception 'That overlaps time you already marked away'; end if;
  end loop;
  update public.attendance_days set away = away || jsonb_build_object('from', p_from, 'to', p_to, 'why', p_why, 'note', nullif(trim(coalesce(p_note, '')), ''), 'later', true), updated_at = now()
    where employee_id = me and day = p_day;
end;
$$;

-- A reason for leaving early, for today.
create or replace function public.set_early_reason(p_why text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_why is null or p_why not in ('personal', 'unwell', 'power', 'work', 'other') then raise exception 'Choose a reason'; end if;
  if length(coalesce(p_note, '')) > 200 then raise exception 'That note is too long'; end if;
  update public.attendance_days set early = jsonb_build_object('why', p_why, 'note', nullif(trim(coalesce(p_note, '')), ''), 'at', public.now_ms()), updated_at = now()
    where employee_id = me and day = public.today_ist() and jsonb_array_length(sessions) > 0;
  if not found then raise exception 'You have no check-in today'; end if;
end;
$$;

-- Admins can remove an away entry (for example one that was added by mistake). The day shows who changed it.
create or replace function public.admin_remove_away(p_employee bigint, p_day date, p_from bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.attendance_days set
    away = coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(away) with ordinality t(x, ord) where (x ->> 'from')::bigint <> p_from), '[]'::jsonb),
    edited_by = public.my_employee_id(), edited_at = now(), updated_at = now()
    where employee_id = p_employee and day = p_day;
end;
$$;

revoke all on function public.go_away(text, text), public.come_back(), public.add_away(date, bigint, bigint, text, text), public.set_early_reason(text, text), public.admin_remove_away(bigint, date, bigint) from public, anon;
grant execute on function public.go_away(text, text), public.come_back(), public.add_away(date, bigint, bigint, text, text), public.set_early_reason(text, text), public.admin_remove_away(bigint, date, bigint) to authenticated;
