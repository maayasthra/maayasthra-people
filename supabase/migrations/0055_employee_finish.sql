-- 0055: An employee marking a task done no longer completes it for everyone. They are recorded in "finished" (who has said they are done),
-- the card stays where it is on the board, and only an admin or project manager can move it to Completed. Run after 0054.

alter table public.tasks add column if not exists finished jsonb not null default '[]'::jsonb check (jsonb_typeof(finished) = 'array');

create or replace function public.tasks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare mgr boolean := public.is_pm(); timer boolean := coalesce(current_setting('mp.timer', true), '') = 'on'; me bigint := public.my_employee_id();
begin
  if tg_op = 'INSERT' then
    if not mgr then new.time_log := '[]'::jsonb; new.prev := '[]'::jsonb; new.finished := '[]'::jsonb; new.done := false; end if;
    return new;
  end if;
  if not mgr and not timer then new.time_log := old.time_log; end if;
  if not mgr then
    -- History may only change when a card is reopened, and then only to what the card already had
    if new.prev is distinct from old.prev and not (new.prev <@ (old.cols || coalesce(old.prev, '[]'::jsonb))) then
      new.prev := old.prev;
    end if;
    if exists (select 1 from jsonb_array_elements(new.cols) e
               where not ((old.cols || coalesce(old.prev, '[]'::jsonb) || '["done"]'::jsonb) @> jsonb_build_array(e))) then
      raise exception 'Only admins and project managers can assign cards to other people';
    end if;
    -- Only an admin or project manager can complete a card. Anyone on it can reopen it.
    if new.done and not old.done then
      raise exception 'Only admins and project managers can complete a task. Use Done to tell them you have finished.';
    end if;
    -- "finished" can only gain or lose the person's own name
    new.finished := coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(old.finished, '[]'::jsonb)) e where e <> to_jsonb(me)), '[]'::jsonb)
                    || case when coalesce(new.finished, '[]'::jsonb) @> to_jsonb(me) then jsonb_build_array(me) else '[]'::jsonb end;
  end if;
  return new;
end;
$$;
