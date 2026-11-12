-- Keep reporting relationships acyclic, including simultaneous opposite edits.
begin;
create function public.lock_reporting_changes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- ponytail: serialize rare reporting-line edits; revisit for bulk HR imports.
  -- Statement-level acquisition precedes row locks to avoid opposite-row lock order.
  perform pg_advisory_xact_lock(7741, 1);
  return null;
end $$;
create trigger employees_manager_lock before insert or update of manager_id on public.employees
  for each statement execute function public.lock_reporting_changes();

create function public.guard_reporting_cycle()
returns trigger language plpgsql security definer set search_path=public as $$
declare next_id bigint := new.manager_id; seen bigint[] := array[new.id];
begin
  if tg_op='UPDATE' and new.manager_id is not distinct from old.manager_id then return new; end if;
  while next_id is not null loop
    if next_id=any(seen) then raise exception 'Reporting relationships cannot contain a cycle. Choose another manager'; end if;
    seen := array_append(seen,next_id);
    select manager_id into next_id from public.employees where id=next_id;
  end loop;
  return new;
end $$;
create trigger employees_manager_cycle before insert or update of manager_id on public.employees
  for each row execute function public.guard_reporting_cycle();
revoke all on function public.lock_reporting_changes(),public.guard_reporting_cycle() from public,anon,authenticated;
commit;
