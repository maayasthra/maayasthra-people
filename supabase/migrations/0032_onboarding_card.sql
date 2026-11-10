-- Maayasthra People: a card for every newly added person.
-- Run after 0031_retainer_flag.sql, in the Supabase SQL Editor.
-- When someone is added to the staff list, a card titled with their name is put in the Pending column
-- (managers see it; the new person does not). If a card with that name is already on the board, no new one is made.

create or replace function public.onboarding_card() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tasks where lower(btrim(title)) = lower(btrim(new.name))) then
    insert into public.tasks (id, title, cols) values ('onb-' || new.id::text, btrim(new.name), '["pending"]'::jsonb)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists employees_onboarding_card on public.employees;
create trigger employees_onboarding_card after insert on public.employees
  for each row execute function public.onboarding_card();
