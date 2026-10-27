-- 0026: Admins and project managers write their end-of-day report without hours (the description is enough). Employees still give hours. Safe to run again. Run after 0025.
create or replace function public.submit_eod(p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id(); nohrs boolean := exists (select 1 from public.profiles where id = auth.uid() and role in ('Admin', 'Project manager') and active); r jsonb; s jsonb; total numeric := 0; sub_total numeric; h numeric; n int := 0;
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
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
  insert into public.eod_reports (employee_id, day, rows, total_hours) values (me, public.today_ist(), p_rows, total)
  on conflict (employee_id, day) do update set rows = excluded.rows, total_hours = excluded.total_hours, updated_at = now();
end;
$$;
revoke all on function public.submit_eod(jsonb) from public, anon;
grant execute on function public.submit_eod(jsonb) to authenticated;
