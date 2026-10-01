-- ESO V6.2.2: additive upgrade of the verified multi-company schema.
-- Run AFTER 20260928183757_eso_v621_editing_photos_locations.sql.
-- No company, employee, report or audit records are deleted.
begin;
revoke create on schema public from public,anon,authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon,authenticated;
alter table public.plants enable row level security;
alter table public.platform_owners enable row level security;
revoke all on all tables in schema public from public,anon,authenticated;
revoke all on all sequences in schema public from public,anon,authenticated;
alter view public.eso_tenant_integrity set(security_invoker=true);
grant select,insert,update,delete on public.plants,public.platform_owners to service_role;
grant select on public.eso_tenant_integrity to service_role;
alter function public.set_updated_at() set search_path=pg_catalog;
revoke all on function public.set_updated_at() from public,anon,authenticated;
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('verify_eso_login','verify_eso_login_simple','verify_eso_login_tenant','verify_eso_company_login','verify_platform_owner_login','admin_reset_eso_password','admin_set_eso_password','change_eso_password','create_eso_employee','platform_create_company') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

create table public.eso_sessions(
 id uuid primary key default gen_random_uuid(),token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),
 employee_id uuid references public.employees(id) on delete cascade,owner_key text,credential_fingerprint text,
 created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,
 check((employee_id is not null and owner_key is null) or (employee_id is null and owner_key is not null)),
 check(expires_at>created_at and expires_at<=created_at+interval '12 hours 1 minute')
);
create index eso_sessions_employee_idx on public.eso_sessions(employee_id);
create index eso_sessions_owner_idx on public.eso_sessions(owner_key) where owner_key is not null;
create index eso_sessions_expiry_idx on public.eso_sessions(expires_at);
create table public.eso_login_limits(key_hash text primary key check(key_hash~'^[0-9a-f]{64}$'),window_start timestamptz not null default now(),attempts integer not null default 1);
create index eso_login_limits_window_idx on public.eso_login_limits(window_start);
alter table public.eso_sessions enable row level security;
alter table public.eso_login_limits enable row level security;
revoke all on public.eso_sessions,public.eso_login_limits from public,anon,authenticated;
grant select,insert,update,delete on public.eso_sessions,public.eso_login_limits to service_role;
create function public.eso_consume_login_limit_v622(p_key text,p_limit integer,p_window_seconds integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 if p_limit not between 1 and 100 or p_window_seconds not between 60 and 3600 then raise exception 'Invalid rate limit';end if;
 insert into public.eso_login_limits as l(key_hash,window_start,attempts)values(p_key,now(),1)
 on conflict(key_hash)do update set
 attempts=case when l.window_start<=now()-make_interval(secs=>p_window_seconds) then 1 else least(l.attempts+1,p_limit+1) end,
 window_start=case when l.window_start<=now()-make_interval(secs=>p_window_seconds) then now() else l.window_start end
 returning attempts into n;return n<=p_limit;
end $$;
revoke all on function public.eso_consume_login_limit_v622(text,integer,integer) from public,anon,authenticated;
grant execute on function public.eso_consume_login_limit_v622(text,integer,integer) to service_role;
create function public.eso_revoke_sessions_v622() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='employees' then
  if new.password_hash is distinct from old.password_hash or new.role is distinct from old.role or new.active is distinct from old.active or new.company_id is distinct from old.company_id or new.plant_id is distinct from old.plant_id then
   update public.eso_sessions set revoked_at=now() where employee_id=new.id and revoked_at is null;
  end if;
 elsif tg_table_name='companies' then
  if new.active is distinct from old.active then update public.eso_sessions set revoked_at=now() where employee_id in(select id from public.employees where company_id=new.id) and revoked_at is null;end if;
 elsif tg_table_name='plants' then
  if new.active is distinct from old.active then update public.eso_sessions set revoked_at=now() where employee_id in(select id from public.employees where plant_id=new.id) and revoked_at is null;end if;
 elsif tg_table_name='platform_owners' then
  if new.password_hash is distinct from old.password_hash or new.active is distinct from old.active then update public.eso_sessions set revoked_at=now() where owner_key=new.id::text and revoked_at is null;end if;
 end if;return new;
end $$;
revoke all on function public.eso_revoke_sessions_v622() from public,anon,authenticated;
create trigger eso_revoke_employee_sessions after update on public.employees for each row execute function public.eso_revoke_sessions_v622();
create trigger eso_revoke_company_sessions after update on public.companies for each row execute function public.eso_revoke_sessions_v622();
create trigger eso_revoke_plant_sessions after update on public.plants for each row execute function public.eso_revoke_sessions_v622();
create trigger eso_revoke_owner_sessions after update on public.platform_owners for each row execute function public.eso_revoke_sessions_v622();

-- Replace single-column plant FKs instead of adding ambiguous PostgREST joins.
alter table public.plants add constraint plants_company_id_id_key unique(company_id,id);
do $$declare c record;action text;begin
 for c in select con.conname,con.conrelid::regclass as child,con.confdeltype from pg_constraint con join pg_class t on t.oid=con.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and con.contype='f' and con.confrelid='public.plants'::regclass loop
  action=case c.confdeltype when 'c' then 'cascade' when 'r' then 'restrict' else 'no action' end;
  execute format('alter table %s drop constraint %I',c.child,c.conname);
  execute format('alter table %s add constraint %I foreign key(company_id,plant_id) references public.plants(company_id,id) on delete %s',c.child,c.conname,action);
 end loop;
end $$;
alter table public.departments add constraint departments_scope_id_key unique(company_id,plant_id,id);
alter table public.employees drop constraint employees_department_id_fkey;
alter table public.employees add constraint employees_department_id_fkey foreign key(company_id,plant_id,department_id) references public.departments(company_id,plant_id,id) on delete set null(department_id);
alter table public.locations drop constraint locations_department_id_fkey;
alter table public.locations add constraint locations_department_id_fkey foreign key(company_id,plant_id,department_id) references public.departments(company_id,plant_id,id) on delete set null(department_id);
alter table public.locations add constraint locations_scope_id_key unique(company_id,plant_id,id);
alter table public.eso_reports drop constraint eso_reports_location_id_fkey;
alter table public.eso_reports add constraint eso_reports_location_id_fkey foreign key(company_id,plant_id,location_id) references public.locations(company_id,plant_id,id) on delete set null(location_id);
alter table public.locations drop constraint locations_name_key;
create unique index locations_scope_name_key on public.locations(company_id,plant_id,lower(trim(name)));
alter table public.departments drop constraint departments_code_key;
create unique index departments_scope_code_key on public.departments(company_id,plant_id,lower(trim(code))) where nullif(trim(code),'') is not null;

-- Normalize only the legacy After photos already inferred this way by V6.2.1.
update public.eso_attachments a set attachment_type='completion'
 from public.eso_reports r left join public.maintenance_tasks t on t.eso_report_id=r.id
 where a.eso_report_id=r.id and a.attachment_type='report' and coalesce(t.completed_at,r.completed_at) is not null and a.created_at>=coalesce(t.completed_at,r.completed_at);

create or replace function public.eso_mutate_v621(p_actor uuid,p_report uuid,p_action text,p_expected_version integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor public.employees%rowtype; r public.eso_reports%rowtype; t public.maintenance_tasks%rowtype;
 assignee public.employees%rowtype; before_state jsonb; after_state jsonb; old_status text;
 admin boolean; resolver boolean; pid uuid; primary_id uuid; extra_ids uuid[]; remove_ids uuid[];
 photo jsonb; photo_type text; note text; due timestamptz; n integer;
begin
 select * into actor from public.employees where id=p_actor and active for share;
 if not found then raise exception 'Inactive or unknown user' using errcode='42501'; end if;
 if not exists(select 1 from public.companies c join public.plants p on p.company_id=c.id where c.id=actor.company_id and c.active and p.id=actor.plant_id and p.active) then raise exception 'Inactive company or plant' using errcode='42501';end if;
 admin=actor.role in ('admin','super_admin');
 resolver=actor.role in ('maintenance','supervisor','management','admin','super_admin');
 if p_action not in ('create','edit','take','start','assign','complete','edit_completion') then raise exception 'Unknown action'; end if;
 if p_action='create' then
  pid=(p_data->>'plant_id')::uuid;
  if pid is null or (actor.role<>'super_admin' and pid<>actor.plant_id) or not exists(select 1 from public.plants where id=pid and company_id=actor.company_id and active) then
   raise exception 'Invalid plant' using errcode='42501';
  end if;
 else
  -- Serializes all V6.2.1 writers to a report, including competing self-take requests.
  select * into r from public.eso_reports where id=p_report and company_id=actor.company_id and (actor.role='super_admin' or plant_id=actor.plant_id) for update;
  if not found or r.reclassified_to_voe then raise exception 'ESO unavailable in your scope' using errcode='42501'; end if;
  if p_expected_version is null or r.revision<>p_expected_version then raise exception 'ESO changed. Refresh the detail and review your changes before saving again.' using errcode='40001'; end if;
  pid=r.plant_id;old_status=r.status;
  if not exists(select 1 from public.plants where id=pid and company_id=actor.company_id and active) then raise exception 'Inactive report plant' using errcode='42501';end if;
  select * into t from public.maintenance_tasks where eso_report_id=r.id for update;
  before_state=jsonb_build_object('report',to_jsonb(r),'task',case when t.id is null then null else to_jsonb(t) end,
   'additional_locations',coalesce((select jsonb_agg(location_id order by location_id) from public.eso_additional_locations where eso_report_id=r.id),'[]'::jsonb),
   'photos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'file_name',file_name,'attachment_type',attachment_type) order by id) from public.eso_attachments where eso_report_id=r.id and removed_at is null),'[]'::jsonb));
 end if;
 if p_action in ('create','edit') then
  if p_action='edit' and not (admin or actor.role='management' or r.reporter_id=actor.id) then raise exception 'You cannot edit this report' using errcode='42501'; end if;
  if length(trim(coalesce(p_data->>'description','')))<5 or length(p_data->>'description')>10000 then raise exception 'Description must contain 5 to 10000 characters'; end if;
  if coalesce(p_data->>'category','') not in ('safety','environmental') or coalesce(p_data->>'urgency','') not in ('low','medium','high','critical') then raise exception 'Invalid canonical category or urgency'; end if;
  primary_id=nullif(p_data->>'location_id','')::uuid;
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into extra_ids from jsonb_array_elements_text(coalesce(p_data->'additional_locations',case when p_action='edit' then (select jsonb_agg(location_id) from public.eso_additional_locations where eso_report_id=r.id) else '[]'::jsonb end,'[]'::jsonb));
  if cardinality(extra_ids)>20 or (cardinality(extra_ids)>0 and primary_id is null) or primary_id=any(extra_ids) then raise exception 'Choose one primary and up to 20 distinct additional locations'; end if;
  if exists(select 1 from unnest(array_append(extra_ids,primary_id)) as x(id) where x.id is not null and not exists(select 1 from public.locations l where l.id=x.id and l.company_id=actor.company_id and l.plant_id=pid and (l.active or (p_action='edit' and (l.id=r.location_id or exists(select 1 from public.eso_additional_locations a where a.eso_report_id=r.id and a.location_id=l.id)))))) then raise exception 'All locations must belong to the report plant'; end if;
  if p_action='create' then
   insert into public.eso_reports(id,company_id,plant_id,reporter_id,location_id,description,category,urgency)
   values(p_report,actor.company_id,pid,actor.id,primary_id,trim(p_data->>'description'),p_data->>'category',p_data->>'urgency') returning * into r;
  else
   update public.eso_reports set location_id=primary_id,description=trim(p_data->>'description'),category=p_data->>'category',urgency=p_data->>'urgency' where id=r.id returning * into r;
  end if;
  delete from public.eso_additional_locations where eso_report_id=r.id;
  insert into public.eso_additional_locations(eso_report_id,location_id,company_id,plant_id) select r.id,x,actor.company_id,pid from unnest(extra_ids) x;
  photo_type='report';
 else
  if not resolver then raise exception 'Resolver role required' using errcode='42501'; end if;
  if p_action<>'edit_completion' and r.status in ('completed','closed') then raise exception 'ESO is already completed'; end if;
  if p_action='edit_completion' then
   if r.status not in ('completed','closed') or t.id is null then raise exception 'Complete this ESO before editing completion'; end if;
   if not(admin or coalesce(t.assigned_to=actor.id,false) or coalesce(t.completed_by=actor.id,false)) then raise exception 'Only the assignee, resolver or admin can edit completion' using errcode='42501'; end if;
  elsif p_action='assign' then
   if not admin then raise exception 'Only an admin can assign tasks' using errcode='42501'; end if;
  elsif t.assigned_to is not null and t.assigned_to<>actor.id and (p_action='take' or not admin) then
   raise exception 'Task already assigned to another user' using errcode='42501';
  end if;
  if p_action='assign' then
   due=(p_data->>'dueAt')::timestamptz;
   if due is null or due<=now() then raise exception 'Choose a future due date'; end if;
   select * into assignee from public.employees where id=(p_data->>'assignedTo')::uuid and company_id=actor.company_id and plant_id=pid and active and role in ('maintenance','supervisor','management') for share;
   if not found then raise exception 'Choose an active Maintenance, Supervisor or Management user from this plant'; end if;
   insert into public.maintenance_tasks(company_id,plant_id,eso_report_id,assigned_to,assigned_by,status,assigned_at,due_at)
    values(actor.company_id,pid,r.id,assignee.id,actor.id,'assigned',now(),due)
    on conflict(eso_report_id) do update set assigned_to=excluded.assigned_to,assigned_by=excluded.assigned_by,status='assigned',assigned_at=now(),due_at=due,started_at=null,completed_at=null,completed_by=null,completion_note=null returning * into t;
   update public.eso_reports set status='assigned' where id=r.id returning * into r;
  elsif p_action in ('take','start') then
   if p_action='start' and t.assigned_to is null then raise exception 'Take this ESO first'; end if;
   insert into public.maintenance_tasks(company_id,plant_id,eso_report_id,assigned_to,assigned_by,status,assigned_at,started_at)
    values(actor.company_id,pid,r.id,actor.id,actor.id,'in_progress',now(),now())
    on conflict(eso_report_id) do update set assigned_to=coalesce(public.maintenance_tasks.assigned_to,actor.id),assigned_by=coalesce(public.maintenance_tasks.assigned_by,actor.id),status='in_progress',assigned_at=coalesce(public.maintenance_tasks.assigned_at,now()),started_at=coalesce(public.maintenance_tasks.started_at,now()) returning * into t;
   update public.eso_reports set status='in_progress' where id=r.id returning * into r;
  elsif p_action in ('complete','edit_completion') then
   note=trim(coalesce(p_data->>'correctiveAction',''));
   if length(note)<1 or length(note)>10000 then raise exception 'Corrective action must contain 1 to 10000 characters'; end if;
   if p_action='complete' then
    insert into public.maintenance_tasks(company_id,plant_id,eso_report_id,assigned_to,assigned_by,status,assigned_at,started_at,completed_at,completed_by,completion_note)
     values(actor.company_id,pid,r.id,actor.id,actor.id,'completed',now(),now(),now(),actor.id,note)
     on conflict(eso_report_id) do update set assigned_to=coalesce(public.maintenance_tasks.assigned_to,actor.id),assigned_by=coalesce(public.maintenance_tasks.assigned_by,actor.id),assigned_at=coalesce(public.maintenance_tasks.assigned_at,now()),started_at=coalesce(public.maintenance_tasks.started_at,now()),status='completed',completed_at=now(),completed_by=actor.id,completion_note=note returning * into t;
    update public.eso_reports set status='completed',completed_at=now() where id=r.id returning * into r;
   else
    update public.maintenance_tasks set completion_note=note where id=t.id returning * into t;
    update public.eso_reports set updated_at=now() where id=r.id returning * into r;
   end if;
   insert into public.corrective_actions(company_id,plant_id,eso_report_id,maintenance_task_id,action_text,created_by) values(actor.company_id,pid,r.id,t.id,note,actor.id);
   photo_type='completion';
  end if;
 end if;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into remove_ids from jsonb_array_elements_text(coalesce(p_data->'remove_photos','[]'::jsonb));
 if photo_type is null and (cardinality(remove_ids)>0 or jsonb_array_length(coalesce(p_data->'photos','[]'::jsonb))>0) then raise exception 'Photos are not supported for this action'; end if;
 if exists(select 1 from unnest(remove_ids) x where not exists(select 1 from public.eso_attachments a where a.id=x and a.eso_report_id=r.id and a.company_id=actor.company_id and a.plant_id=pid and a.attachment_type=photo_type and a.removed_at is null)) then raise exception 'Invalid photo removal'; end if;
 update public.eso_attachments set removed_at=now() where id=any(remove_ids);
 select count(*) into n from public.eso_attachments where eso_report_id=r.id and attachment_type=photo_type and removed_at is null;
 if jsonb_array_length(coalesce(p_data->'photos','[]'::jsonb))>0 and n+jsonb_array_length(coalesce(p_data->'photos','[]'::jsonb))>8 then raise exception 'Maximum 8 photos per Before/After group'; end if;
 for photo in select value from jsonb_array_elements(coalesce(p_data->'photos','[]'::jsonb)) loop
  if photo_type is null or coalesce(photo->>'mime_type','') not in ('image/jpeg','image/png','image/webp') or coalesce(photo->>'storage_path','') not like actor.company_id::text||'/'||pid::text||'/'||r.id::text||'/%' then raise exception 'Invalid photo metadata'; end if;
  insert into public.eso_attachments(company_id,plant_id,eso_report_id,storage_path,file_name,mime_type,attachment_type,uploaded_by) values(actor.company_id,pid,r.id,photo->>'storage_path',photo->>'file_name',photo->>'mime_type',photo_type,actor.id);
 end loop;
 if p_action='create' or r.status is distinct from old_status then
  insert into public.eso_status_history(company_id,plant_id,eso_report_id,old_status,new_status,changed_by,note) values(actor.company_id,pid,r.id,old_status,r.status,actor.id,p_action);
 end if;
 after_state=jsonb_build_object('report',to_jsonb(r),'task',case when t.id is null then null else to_jsonb(t) end,
  'additional_locations',coalesce((select jsonb_agg(location_id order by location_id) from public.eso_additional_locations where eso_report_id=r.id),'[]'::jsonb),
  'photos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'file_name',file_name,'attachment_type',attachment_type) order by id) from public.eso_attachments where eso_report_id=r.id and removed_at is null),'[]'::jsonb));
 insert into public.eso_audit_events(eso_report_id,company_id,plant_id,actor_id,action,old_values,new_values) values(r.id,actor.company_id,pid,actor.id,p_action,before_state,after_state);
 return jsonb_build_object('id',r.id,'report_no',r.report_no,'revision',r.revision);
end $$;
revoke all on function public.eso_mutate_v621(uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.eso_mutate_v621(uuid,uuid,text,integer,jsonb) to service_role;

create function public.eso_classify_v622(p_actor uuid,p_report uuid,p_expected_version integer,p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.employees%rowtype;r public.eso_reports%rowtype;old_r jsonb;v uuid;reason text;category text;begin
 select * into a from public.employees where id=p_actor and active for share;
 if not found or a.role not in('management','admin','super_admin') then raise exception 'Manager role required' using errcode='42501';end if;
 if not exists(select 1 from public.companies c join public.plants p on p.company_id=c.id where c.id=a.company_id and c.active and p.id=a.plant_id and p.active) then raise exception 'Inactive company or plant' using errcode='42501';end if;
 select * into r from public.eso_reports where id=p_report and company_id=a.company_id and (a.role='super_admin' or plant_id=a.plant_id) for update;
 if not found or r.reclassified_to_voe then raise exception 'ESO unavailable in your scope' using errcode='42501';end if;
 if p_expected_version is null or r.revision<>p_expected_version then raise exception 'ESO changed. Refresh and review before saving.' using errcode='40001';end if;
 old_r=to_jsonb(r);
 if p_action='star' then
  if jsonb_typeof(p_data->'starred') is distinct from 'boolean' then raise exception 'Invalid star value';end if;
  update public.eso_reports set is_starred=(p_data->>'starred')::boolean,starred_by=case when (p_data->>'starred')::boolean then a.id else null end,starred_at=case when (p_data->>'starred')::boolean then now() else null end where id=r.id returning * into r;
 elsif p_action='reclassify' then
  reason=trim(coalesce(p_data->>'reason',''));category=coalesce(p_data->>'category','other');
  if length(reason)<3 or length(reason)>10000 then raise exception 'Reason must contain 3 to 10000 characters';end if;
  insert into public.voe_reports(company_id,plant_id,reporter_id,category,description,status,admin_note,source_eso_report_id)values(a.company_id,r.plant_id,r.reporter_id,category,r.description,'new','Reclassified from ESO: '||reason,r.id) returning id into v;
  insert into public.report_reclassification_history(company_id,plant_id,eso_report_id,voe_report_id,from_type,to_type,reason,changed_by)values(a.company_id,r.plant_id,r.id,v,'eso','voe',reason,a.id);
  update public.eso_reports set reclassified_to_voe=true where id=r.id returning * into r;
  insert into public.notifications(company_id,plant_id,user_id,type,title,message,eso_report_id)select a.company_id,e.plant_id,e.id,'reclassified_voe','Submission moved to Voice of Employee','Your submission no longer counts toward ESO metrics.',r.id from public.employees e where e.id=r.reporter_id and e.company_id=a.company_id and e.active;
 else raise exception 'Unknown action';end if;
 insert into public.eso_audit_events(eso_report_id,company_id,plant_id,actor_id,action,old_values,new_values)values(r.id,a.company_id,r.plant_id,a.id,p_action,jsonb_build_object('report',old_r),jsonb_build_object('report',to_jsonb(r),'voe_id',v,'reason',reason));
 return jsonb_build_object('id',r.id,'revision',r.revision,'voe_id',v,'starred',r.is_starred);
end $$;
revoke all on function public.eso_classify_v622(uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.eso_classify_v622(uuid,uuid,integer,text,jsonb) to service_role;

create function public.eso_queue_task_reminder_v622(p_task uuid,p_key text,p_users uuid[],p_title text,p_message text)returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.maintenance_tasks%rowtype;n integer;begin
 if cardinality(p_users)=0 or cardinality(p_users)>500 then return false;end if;
 select mt.* into t from public.maintenance_tasks mt join public.eso_reports r on r.id=mt.eso_report_id join public.companies c on c.id=mt.company_id join public.plants p on p.id=mt.plant_id where mt.id=p_task and mt.status in('assigned','in_progress') and not r.reclassified_to_voe and c.active and p.active for share of mt,r;
 if not found then return false;end if;
 insert into public.task_reminder_events(company_id,plant_id,maintenance_task_id,event_key)values(t.company_id,t.plant_id,t.id,p_key) on conflict(maintenance_task_id,event_key)do nothing;
 get diagnostics n=row_count;if n=0 then return false;end if;
 insert into public.notifications(company_id,plant_id,user_id,type,title,message,eso_report_id,maintenance_task_id)
 select t.company_id,e.plant_id,e.id,'task_reminder',p_title,p_message,t.eso_report_id,t.id from public.employees e where e.id=any(p_users) and e.company_id=t.company_id and e.active and(e.plant_id=t.plant_id or e.role='super_admin');
 return true;
end $$;
revoke all on function public.eso_queue_task_reminder_v622(uuid,text,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.eso_queue_task_reminder_v622(uuid,text,uuid[],text,text) to service_role;
create function public.eso_cleanup_auth_v622()returns void language sql security invoker set search_path='' as $$
 delete from public.eso_sessions where expires_at<now()-interval '1 day';
 delete from public.eso_login_limits where window_start<now()-interval '1 day';
$$;
revoke all on function public.eso_cleanup_auth_v622() from public,anon,authenticated;
grant execute on function public.eso_cleanup_auth_v622() to service_role;

create function public.eso_save_employee_v622(p_actor uuid,p_user uuid,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.employees%rowtype;e public.employees%rowtype;pid uuid;dep uuid;new_role text;password text;hash text;v_first_name text;v_last_name text;eno text;target integer;enabled boolean;begin
 select * into a from public.employees where id=p_actor and active for share;
 if not found or a.role not in('admin','super_admin') then raise exception 'Admin role required' using errcode='42501';end if;
 if not exists(select 1 from public.companies c join public.plants p on p.company_id=c.id where c.id=a.company_id and c.active and p.id=a.plant_id and p.active) then raise exception 'Inactive company or plant' using errcode='42501';end if;
 if p_user is not null then
  select * into e from public.employees where id=p_user and company_id=a.company_id and(a.role='super_admin' or plant_id=a.plant_id) for update;
  if not found then raise exception 'Employee outside your scope' using errcode='42501';end if;
 end if;
 pid=coalesce(nullif(p_data->>'plant_id','')::uuid,e.plant_id,a.plant_id);new_role=coalesce(p_data->>'role',e.role,'employee');
 if new_role not in('employee','maintenance','supervisor','management','admin','super_admin') then raise exception 'Invalid role';end if;
 if a.role<>'super_admin' and(new_role='super_admin' or e.role='super_admin' or pid<>a.plant_id) then raise exception 'You cannot modify this employee or role' using errcode='42501';end if;
 if not exists(select 1 from public.plants where id=pid and company_id=a.company_id and active) then raise exception 'Invalid or inactive plant';end if;
 dep=case when p_data?'department_id' then nullif(p_data->>'department_id','')::uuid else e.department_id end;
 if dep is not null and not exists(select 1 from public.departments where id=dep and company_id=a.company_id and plant_id=pid and(active or dep=e.department_id)) then raise exception 'Department is not available in the selected plant';end if;
 v_first_name=trim(coalesce(p_data->>'first_name',e.first_name,''));v_last_name=trim(coalesce(p_data->>'last_name',e.last_name,'-'));eno=trim(coalesce(e.employee_no,p_data->>'employee_no',''));
 if length(v_first_name)not between 1 and 100 or length(v_last_name)not between 1 and 100 or length(eno)not between 1 and 100 then raise exception 'Employee ID and name are required (maximum 100 characters)';end if;
 target=coalesce((p_data->>'annual_eso_target')::integer,e.annual_eso_target,12);if target not between 0 and 10000 then raise exception 'Invalid annual target';end if;
 enabled=coalesce((p_data->>'active')::boolean,e.active,true);password=nullif(p_data->>'password','');hash=e.password_hash;
 if new_role='employee' then hash=null;
 elsif password is not null then
  if length(password)<8 or octet_length(password)>72 then raise exception 'Password must contain at least 8 characters and at most 72 bytes';end if;
  hash=extensions.crypt(password,extensions.gen_salt('bf',10));
 elsif hash is null then raise exception 'A password is required for privileged roles';
 end if;
 if p_user is null then
  insert into public.employees(company_id,plant_id,employee_no,first_name,last_name,department_id,role,annual_eso_target,active,password_hash)values(a.company_id,pid,eno,v_first_name,v_last_name,dep,new_role,target,enabled,hash) returning * into e;
 else
  update public.employees set plant_id=pid,first_name=v_first_name,last_name=v_last_name,department_id=dep,role=new_role,annual_eso_target=target,active=enabled,password_hash=hash where id=e.id returning * into e;
 end if;return jsonb_build_object('id',e.id);
end $$;
revoke all on function public.eso_save_employee_v622(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.eso_save_employee_v622(uuid,uuid,jsonb) to service_role;
create function public.eso_import_employees_v622(p_actor uuid,p_rows jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.employees%rowtype;item jsonb;uid uuid;imported integer=0;updated integer=0;errors jsonb='[]';begin
 select * into a from public.employees where id=p_actor and active;
 if not found or a.role not in('admin','super_admin') then raise exception 'Admin role required' using errcode='42501';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Import supports up to 2000 employees';end if;
 for item in select value from jsonb_array_elements(p_rows)loop
  begin
   select id into uid from public.employees where company_id=a.company_id and employee_no=trim(item->'data'->>'employee_no');
   perform public.eso_save_employee_v622(p_actor,uid,item->'data');
   if uid is null then imported=imported+1;else updated=updated+1;end if;
  exception when others then
   errors=errors||jsonb_build_array(jsonb_build_object('row',item->'row','error',case when sqlstate='P0001' or sqlstate='42501' then sqlerrm else 'Invalid or duplicate employee data' end));
  end;
 end loop;return jsonb_build_object('imported',imported,'updated',updated,'errors',errors);
end $$;
revoke all on function public.eso_import_employees_v622(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.eso_import_employees_v622(uuid,jsonb) to service_role;

-- Add only missing FK indexes; existing indexes are retained.
do $$declare c record;columns_sql text;begin
 for c in select con.oid,con.conname,con.conrelid::regclass as child,con.conrelid,con.conkey from pg_constraint con join pg_class t on t.oid=con.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and con.contype='f' and not exists(
  select 1 from pg_index i where i.indrelid=con.conrelid and i.indisvalid and i.indpred is null and i.indnkeyatts>=cardinality(con.conkey) and (select array_agg(i.indkey[k.pos-1] order by k.pos) from unnest(con.conkey)with ordinality as k(att,pos))=con.conkey
 )loop
  select string_agg(quote_ident(a.attname),',' order by k.pos) into columns_sql from unnest(c.conkey)with ordinality as k(att,pos)join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.att;
  execute format('create index %I on %s(%s)',left(c.conname,58)||'_idx',c.child,columns_sql);
 end loop;
end $$;
revoke update,delete,truncate on public.eso_audit_events from service_role;
notify pgrst,'reload schema';
commit;
