-- 0031: A retainer task stays marked as a retainer task wherever it is moved, so it keeps its blue tint. Run after 0030.
alter table public.tasks add column if not exists retainer boolean not null default false;

-- Everything that is in, or has been in, the Retainer column is a retainer task
update public.tasks set retainer = true
  where cols @> '"retainer"'::jsonb or coalesce(prev, '[]'::jsonb) @> '"retainer"'::jsonb;

-- Only admins and project managers can mark or unmark one
create or replace function public.guard_retainer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.retainer and not public.is_pm() then new.retainer := false; end if;
  elsif new.retainer is distinct from old.retainer and not public.is_pm() then
    raise exception 'Only admins and project managers can change a retainer task';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_guard_retainer on public.tasks;
create trigger tasks_guard_retainer before insert or update on public.tasks for each row execute function public.guard_retainer();
