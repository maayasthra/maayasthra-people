-- Bind delayed uploads to the employee who selected the image, not a later session.
-- Apply before the new frontend. Older clients must refresh before changing covers.
create or replace function public.set_my_cover(p_image text, p_employee bigint)
returns void language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_employee is distinct from me then raise exception 'Your account changed. Choose the picture again.'; end if;
  if p_image is null then p_image := ''; end if;
  if p_image <> '' and p_image not like 'data:image/%' then raise exception 'That is not a picture'; end if;
  if length(p_image) > 700000 then raise exception 'That picture is too large'; end if;
  insert into public.employee_covers (employee_id, image, updated_at) values (me, p_image, now())
  on conflict (employee_id) do update set image = excluded.image, updated_at = now();
end;
$$;

-- Keep a clear error for old tabs rather than accepting an unbound delayed upload.
create or replace function public.set_my_cover(p_image text)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Refresh this page before changing your cover.';
end;
$$;
revoke all on function public.set_my_cover(text, bigint), public.set_my_cover(text) from public, anon;
grant execute on function public.set_my_cover(text, bigint), public.set_my_cover(text) to authenticated;
