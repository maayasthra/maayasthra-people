-- Experimental two-way worklog API. No credential is provisioned by this migration.
-- A dedicated, expiring admin-owned token and explicit employee allowlist are required.
create table public.eod_sheet_config (
  id boolean primary key default true check (id),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default false,
  expires_at timestamptz not null default now() + interval '1 day',
  allowed_employee_ids bigint[] not null default '{}'
    check (cardinality(allowed_employee_ids)<=1000 and array_position(allowed_employee_ids,null) is null)
);
create sequence public.eod_sheet_revision_seq;
create table public.eod_sheet_versions (
  employee_id bigint not null,
  day date not null,
  revision bigint not null default nextval('public.eod_sheet_revision_seq'),
  primary key(employee_id, day)
);
-- No employee FK: tombstones survive deletion and prevent an old snapshot becoming current again.
create table public.eod_sheet_audit (
  request_id uuid primary key,
  actor_id uuid not null,
  payload_hash text not null,
  action text not null,
  employee_id bigint not null,
  day date not null,
  before_report jsonb,
  after_report jsonb,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.eod_sheet_config enable row level security;
alter table public.eod_sheet_versions enable row level security;
alter table public.eod_sheet_audit enable row level security;
revoke all on public.eod_sheet_config, public.eod_sheet_versions, public.eod_sheet_audit from public, anon, authenticated;
revoke all on sequence public.eod_sheet_revision_seq from public, anon, authenticated;

-- Shared with ordinary app writes. Statement-level locking happens before row locks,
-- so sheet compare-and-write cannot deadlock against an app row-then-trigger lock.
create function public.lock_eod_sheet_writes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(17491, 49);
  return null;
end $$;
create trigger eod_sheet_write_lock before insert or update or delete on public.eod_reports
for each statement execute function public.lock_eod_sheet_writes();
create function public.track_eod_sheet_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then
    insert into public.eod_sheet_versions(employee_id,day) values(old.employee_id,old.day)
    on conflict(employee_id,day) do update set revision=nextval('public.eod_sheet_revision_seq');
  end if;
  if tg_op <> 'DELETE' and (tg_op='INSERT' or (new.employee_id,new.day) is distinct from (old.employee_id,old.day)) then
    insert into public.eod_sheet_versions(employee_id,day) values(new.employee_id,new.day)
    on conflict(employee_id,day) do update set revision=nextval('public.eod_sheet_revision_seq');
  end if;
  return null;
end $$;
create trigger eod_sheet_version after insert or update or delete on public.eod_reports
for each row execute function public.track_eod_sheet_version();
insert into public.eod_sheet_versions(employee_id,day) select employee_id,day from public.eod_reports;

create function public.eod_sheet_authority(p_token text) returns public.eod_sheet_config
language plpgsql stable security definer set search_path = public as $$
declare c public.eod_sheet_config;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>512 then raise exception 'Not allowed'; end if;
  select cfg.* into c from public.eod_sheet_config cfg
  join public.profiles p on p.id=cfg.owner_id and p.active and p.role='Admin'
  join auth.users u on u.id=p.id and lower(u.email)=p.email
  join public.employees e on e.email=p.email and e.role='Admin' and e.status<>'Exited'
  where cfg.active and cfg.expires_at>clock_timestamp()
    and cfg.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception 'Not allowed'; end if;
  return c;
end $$;

create function public.eod_sheet_snapshot(p_token text,p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.eod_sheet_config; d date; n integer; bytes bigint;
begin
  c:=public.eod_sheet_authority(p_token);
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Not a month'; end if;
  d:=(p_month||'-01')::date;
  select count(*),coalesce(sum(octet_length(rows::text)),0) into n,bytes from public.eod_reports where employee_id=any(c.allowed_employee_ids) and day>=d and day<d+interval '1 month';
  if n>1000 then raise exception 'Too many reports for one sheet'; end if;
  if bytes>4194304 then raise exception 'Reports too large for one sheet'; end if;
  return jsonb_build_object('reports',coalesce((select jsonb_agg(jsonb_build_object(
    'employee_id',r.employee_id::text,'day',r.day,'name',e.name,'revision',v.revision::text,'rows',r.rows)
    order by r.day,r.employee_id) from public.eod_reports r
    join public.employees e on e.id=r.employee_id join public.eod_sheet_versions v using(employee_id,day)
    where r.employee_id=any(c.allowed_employee_ids) and r.day>=d and r.day<d+interval '1 month'),'[]'::jsonb),
    'employees',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'name',name,'role',role) order by id)
      from public.employees where id=any(c.allowed_employee_ids) and status<>'Exited'),'[]'::jsonb),
    'revisions',coalesce((select jsonb_object_agg(employee_id::text||'/'||day::text,revision::text)
      from public.eod_sheet_versions where employee_id=any(c.allowed_employee_ids) and day>=d and day<d+interval '1 month'),'{}'::jsonb));
end $$;

create function public.eod_sheet_mutate(p_token text,p_request uuid,p_action text,p_employee bigint,p_day date,
  p_revision text,p_main integer,p_sub integer,p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.eod_sheet_config; prior public.eod_reports; before_value jsonb; after_value jsonb;
  payload text; replay public.eod_sheet_audit; rev text; newrows jsonb; item jsonb; subitem jsonb; r jsonb; s jsonb;
  total numeric:=0; h numeric; nohrs boolean; found_report boolean; answer jsonb;
begin
  c:=public.eod_sheet_authority(p_token);
  if p_request is null or p_employee is null or not coalesce(p_employee=any(c.allowed_employee_ids),false) then raise exception 'Not allowed'; end if;
  if p_action is null or p_action not in ('create','update','delete') then raise exception 'Invalid action'; end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>8192 then raise exception 'Invalid fields'; end if;
  if p_revision is null or p_revision !~ '^(0|[1-9][0-9]{0,18})$' then raise exception 'Invalid revision'; end if;
  payload:=encode(sha256(convert_to(jsonb_build_array(p_action,p_employee,p_day,p_revision,p_main,p_sub,p_fields)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(17491,49);
  -- Do not retain authorization across a wait for another worklog writer. Lock the
  -- credential and canonical owner rows, then re-read current scope/role/expiry.
  -- Revocation either commits first and is rejected here, or waits for this write.
  perform 1 from public.eod_sheet_config cfg
    join public.profiles p on p.id=cfg.owner_id
    join auth.users u on u.id=p.id
    join public.employees e on e.email=p.email
    where cfg.id=true for share of cfg,p,u,e;
  c:=public.eod_sheet_authority(p_token);
  if not coalesce(p_employee=any(c.allowed_employee_ids),false) then raise exception 'Not allowed'; end if;
  select * into replay from public.eod_sheet_audit where request_id=p_request;
  if found then
    if replay.actor_id<>c.owner_id or replay.payload_hash<>payload then raise exception 'Request ID already used for different data'; end if;
    return replay.result;
  end if;
  if p_day is null or p_day>public.today_ist() or p_day<public.today_ist()-7 then raise exception 'Reports outside the last seven days are locked'; end if;
  select role in ('Admin','Project manager') into nohrs from public.employees where id=p_employee and status<>'Exited' for share;
  if not found then raise exception 'No active employee'; end if;
  select * into prior from public.eod_reports where employee_id=p_employee and day=p_day for update;
  found_report:=found; before_value:=case when found_report then to_jsonb(prior) else null end;
  select revision::text into rev from public.eod_sheet_versions where employee_id=p_employee and day=p_day;
  rev:=coalesce(rev,'0');
  if p_revision<>rev then raise exception 'Conflict: this report changed; refresh before editing'; end if;
  newrows:=case when found_report then prior.rows else '[]'::jsonb end;
  if p_action='create' then
    if p_main is not null or p_sub is not null or exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('project','desc','hours')) then raise exception 'Invalid create fields'; end if;
    item:=jsonb_build_object('project',p_fields->'project','desc',p_fields->'desc','hours',p_fields->'hours','subs','[]'::jsonb,'task',null);
    newrows:=newrows||jsonb_build_array(item);
  else
    if not found_report or p_main is null or p_main<0 or p_main>=jsonb_array_length(newrows) then raise exception 'Worklog does not exist'; end if;
    item:=newrows->p_main;
    if p_sub is not null and (p_sub<0 or p_sub>=jsonb_array_length(coalesce(item->'subs','[]'::jsonb))) then raise exception 'Subtask does not exist'; end if;
    if p_action='delete' then
      if p_fields<>'{}'::jsonb then raise exception 'Delete takes no fields'; end if;
      if p_sub is null then newrows:=newrows-p_main;
      else
        item:=jsonb_set(item,'{subs}',(item->'subs')-p_sub);
        -- A parent with no remaining subtasks is removed, never resurrected with stale hours.
        if jsonb_array_length(item->'subs')=0 then newrows:=newrows-p_main;
        else newrows:=jsonb_set(newrows,array[p_main::text],item); end if;
      end if;
    else
      if p_fields='{}'::jsonb then raise exception 'No changed fields'; end if;
      if p_sub is null then
        if exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('project','desc','hours')) then raise exception 'Invalid update fields'; end if;
        if jsonb_array_length(coalesce(item->'subs','[]'::jsonb))>0 and p_fields ? 'hours' then raise exception 'Edit subtask hours instead'; end if;
        item:=item||p_fields;
      else
        if exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('title','desc','hours')) then raise exception 'Invalid subtask fields'; end if;
        item:=jsonb_set(item,array['subs',p_sub::text],(item->'subs'->p_sub)||p_fields);
      end if;
      newrows:=jsonb_set(newrows,array[p_main::text],item);
    end if;
  end if;
  if not public.valid_eod_rows(newrows) or jsonb_array_length(newrows)>40 then raise exception 'Invalid report shape'; end if;
  for r in select * from jsonb_array_elements(newrows) loop
    if length(trim(r->>'project'))=0 or length(r->>'project')>200 or length(coalesce(r->>'desc',''))>1000 then raise exception 'Invalid project or description'; end if;
    if jsonb_array_length(coalesce(r->'subs','[]'::jsonb))>0 then
      if jsonb_array_length(r->'subs')>40 then raise exception 'Too many subtasks'; end if;
      for s in select * from jsonb_array_elements(r->'subs') loop
        if length(trim(s->>'title'))=0 or length(s->>'title')>200 or length(coalesce(s->>'desc',''))>1000 then raise exception 'Invalid subtask'; end if;
        h:=coalesce((s->>'hours')::numeric,0);
        if (nohrs and h<>0) or (not nohrs and (h<=0 or h>24)) then raise exception 'Invalid hours'; end if;
        total:=total+h;
      end loop;
    else
      if length(trim(coalesce(r->>'desc','')))=0 then raise exception 'Describe what you did'; end if;
      h:=coalesce((r->>'hours')::numeric,0);
      if (nohrs and h<>0) or (not nohrs and (h<=0 or h>24)) then raise exception 'Invalid hours'; end if;
      total:=total+h;
    end if;
  end loop;
  if total>24 then raise exception 'That adds up to more than 24 hours'; end if;
  if jsonb_array_length(newrows)=0 then
    delete from public.eod_reports where employee_id=p_employee and day=p_day;
  elsif found_report then
    update public.eod_reports set rows=newrows,total_hours=total,updated_at=clock_timestamp() where employee_id=p_employee and day=p_day;
  else
    insert into public.eod_reports(employee_id,day,rows,total_hours) values(p_employee,p_day,newrows,total);
  end if;
  select to_jsonb(saved) into after_value from public.eod_reports saved where employee_id=p_employee and day=p_day;
  select revision::text into rev from public.eod_sheet_versions where employee_id=p_employee and day=p_day;
  answer:=jsonb_build_object('status','applied','request_id',p_request,'employee_id',p_employee::text,'day',p_day,'revision',rev,'deleted',after_value is null,'total_hours',total);
  insert into public.eod_sheet_audit(request_id,actor_id,payload_hash,action,employee_id,day,before_report,after_report,result)
  values(p_request,c.owner_id,payload,p_action,p_employee,p_day,before_value,after_value,answer);
  return answer;
end $$;
revoke all on function public.lock_eod_sheet_writes(), public.track_eod_sheet_version(), public.eod_sheet_authority(text),
  public.eod_sheet_snapshot(text,text),public.eod_sheet_mutate(text,uuid,text,bigint,date,text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.eod_sheet_snapshot(text,text),public.eod_sheet_mutate(text,uuid,text,bigint,date,text,integer,integer,jsonb) to anon,authenticated;
