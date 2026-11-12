-- Enforce UI JSON contracts at the database boundary, including direct REST writes.
-- Existing malformed records make this migration fail: inspect and repair them deliberately before release.
begin;
create or replace function public.valid_task_items(items jsonb, kind text)
returns boolean language plpgsql immutable set search_path = public as $$
declare x jsonb; seen text[] := '{}';
begin
  if jsonb_typeof(items) is distinct from 'array' then return false; end if;
  for x in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(x) is distinct from 'object' or coalesce(jsonb_typeof(x->'id'),'null') not in ('number','string') or coalesce(x->>'id','') = '' then return false; end if;
    if (x->>'id') = any(seen) then return false; end if;
    seen := array_append(seen,x->>'id');
    if kind = 'subs' then
      if jsonb_typeof(x->'t') is distinct from 'string' or jsonb_typeof(x->'done') is distinct from 'boolean' then return false; end if;
    elsif kind = 'comments' then
      if jsonb_typeof(x->'text') is distinct from 'string' or jsonb_typeof(x->'by') is distinct from 'number' or jsonb_typeof(x->'at') is distinct from 'number' then return false; end if;
    elsif kind = 'columns' then
      if jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'name') is distinct from 'string' then return false; end if;
    else return false;
    end if;
  end loop;
  return true;
end $$;
alter table public.tasks add constraint tasks_subs_shape check (public.valid_task_items(subs,'subs'));
alter table public.tasks add constraint tasks_comments_shape check (public.valid_task_items(comments,'comments'));
alter table public.task_board add constraint board_columns_shape check (public.valid_task_items(columns,'columns'));

create or replace function public.valid_eod_rows(items jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare x jsonb; s jsonb;
begin
  if jsonb_typeof(items) is distinct from 'array' then return false; end if;
  for x in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'project') is distinct from 'string'
      or (x ? 'desc' and jsonb_typeof(x->'desc') is distinct from 'string')
      or (x ? 'hours' and jsonb_typeof(x->'hours') is distinct from 'number')
      or (x ? 'task' and jsonb_typeof(x->'task') not in ('null','string')) then return false; end if;
    if x ? 'subs' then
      if jsonb_typeof(x->'subs') is distinct from 'array' then return false; end if;
      for s in select * from jsonb_array_elements(x->'subs') loop
        if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'title') is distinct from 'string'
          or (s ? 'desc' and jsonb_typeof(s->'desc') is distinct from 'string')
          or (s ? 'hours' and jsonb_typeof(s->'hours') is distinct from 'number') then return false; end if;
      end loop;
    end if;
  end loop;
  return true;
end $$;
alter table public.eod_reports add constraint eod_rows_shape check (public.valid_eod_rows(rows));

-- Keep comments immutable and author-bound even when bypassing patch_task_list.
create or replace function public.guard_task_comments()
returns trigger language plpgsql security definer set search_path = public as $$
declare prior jsonb := '[]'; c jsonb; previous jsonb; me bigint := public.my_employee_id();
begin
  if tg_op = 'UPDATE' then prior := old.comments; end if;
  if new.comments = prior then return new; end if;
  if not public.valid_task_items(new.comments,'comments') then raise exception 'Invalid comments'; end if;
  -- Trusted database maintenance has no end-user identity; API roles still obey RLS.
  if auth.uid() is null then return new; end if;
  for c in select * from jsonb_array_elements(new.comments) loop
    select e into previous from jsonb_array_elements(prior) e where e->>'id' = c->>'id';
    if found then
      if c <> previous then raise exception 'Comments cannot be edited'; end if;
    elsif (c->>'by')::numeric is distinct from me then raise exception 'Invalid comment author';
    end if;
  end loop;
  if not public.is_pm() and exists (
    select 1 from jsonb_array_elements(prior) e where (e->>'by')::numeric is distinct from me
      and not exists (select 1 from jsonb_array_elements(new.comments) n where n->>'id'=e->>'id')
  ) then raise exception 'You can only remove your own comments'; end if;
  return new;
end $$;
create trigger tasks_comments_guard before insert or update of comments on public.tasks for each row execute function public.guard_task_comments();

-- Deactivate the former login when a staff email changes or a staff record is removed.
create or replace function public.sync_profile_from_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles set active = false where email = old.email;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.email is distinct from new.email then
    update public.profiles set active = false where email = old.email;
  end if;
  update public.profiles set role = new.role, active = (new.status <> 'Exited') where email = new.email;
  return new;
end $$;
drop trigger employees_sync_profile on public.employees;
create trigger employees_sync_profile after insert or update of role, status, email or delete on public.employees
  for each row execute function public.sync_profile_from_employee();
commit;
