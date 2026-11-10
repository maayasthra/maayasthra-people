-- 0033: each retainer card can have its own tint colour (a hex like #BF5AF2). A duplicate keeps it. Run after 0032.
alter table public.tasks add column if not exists retainer_color text
  check (retainer_color is null or retainer_color ~ '^#[0-9A-Fa-f]{6}$');

-- Only admins and project managers can mark a retainer task or change its colour
create or replace function public.guard_retainer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.retainer and not public.is_pm() then new.retainer := false; end if;
    if new.retainer_color is not null and not public.is_pm() then new.retainer_color := null; end if;
  elsif (new.retainer is distinct from old.retainer or new.retainer_color is distinct from old.retainer_color) and not public.is_pm() then
    raise exception 'Only admins and project managers can change a retainer task';
  end if;
  return new;
end;
$$;
