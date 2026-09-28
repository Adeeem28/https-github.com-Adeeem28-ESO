-- Upgrade the live V6.1.5 schema, not the historical supabase/schema.sql starter.
begin;
alter table public.eso_reports add column revision integer not null default 1;
alter table public.eso_attachments add column removed_at timestamptz;

create table public.eso_additional_locations (
 eso_report_id uuid not null references public.eso_reports(id),
 location_id uuid not null references public.locations(id),
 company_id uuid not null references public.companies(id),
 plant_id uuid not null references public.plants(id),
 primary key (eso_report_id,location_id)
);
create index eso_additional_scope_idx on public.eso_additional_locations(company_id,plant_id,location_id);
create table public.eso_audit_events (
 id bigint generated always as identity primary key,
 eso_report_id uuid not null references public.eso_reports(id),
 company_id uuid not null references public.companies(id),
 plant_id uuid not null references public.plants(id),
 actor_id uuid not null references public.employees(id),
 action text not null,
 old_values jsonb,
 new_values jsonb not null,
 created_at timestamptz not null default now()
);
create index eso_audit_report_idx on public.eso_audit_events(company_id,plant_id,eso_report_id,id desc);
alter table public.eso_additional_locations enable row level security;
alter table public.eso_audit_events enable row level security;
-- ESO uses signed server sessions, not Supabase Auth. Browser roles have no access.
revoke all on public.eso_additional_locations, public.eso_audit_events from public,anon,authenticated;
grant select,insert,update,delete on public.eso_additional_locations to service_role;
grant select,insert on public.eso_audit_events to service_role;
revoke update,delete,truncate on public.eso_audit_events from service_role;
grant usage,select on sequence public.eso_audit_events_id_seq to service_role;

create function public.eso_revision_v621() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision=old.revision+1; return new; end $$;
revoke all on function public.eso_revision_v621() from public,anon,authenticated;
create trigger eso_revision_v621 before update on public.eso_reports for each row execute function public.eso_revision_v621();

create function public.eso_audit_immutable_v621() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'ESO audit events are append-only'; end $$;
revoke all on function public.eso_audit_immutable_v621() from public,anon,authenticated;
create trigger eso_audit_immutable_v621 before update or delete on public.eso_audit_events for each row execute function public.eso_audit_immutable_v621();

-- Only the trusted server may supply p_actor, after validating its HMAC session.
-- SECURITY INVOKER deliberately retains service_role and does not elevate callers.
create function public.eso_mutate_v621(p_actor uuid,p_report uuid,p_action text,p_expected_version integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor public.employees%rowtype; r public.eso_reports%rowtype; t public.maintenance_tasks%rowtype;
 assignee public.employees%rowtype; before_state jsonb; after_state jsonb; old_status text;
 admin boolean; resolver boolean; pid uuid; primary_id uuid; extra_ids uuid[]; remove_ids uuid[];
 photo jsonb; photo_type text; note text; due timestamptz; n integer;
begin
 select * into actor from public.employees where id=p_actor and active for share;
 if not found then raise exception 'Inactive or unknown user' using errcode='42501'; end if;
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
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into extra_ids from jsonb_array_elements_text(coalesce(p_data->'additional_locations','[]'::jsonb));
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
  if photo_type is null or photo->>'mime_type' not in ('image/jpeg','image/png','image/webp') or coalesce(photo->>'storage_path','') not like actor.company_id::text||'/'||pid::text||'/'||r.id::text||'/%' then raise exception 'Invalid photo metadata'; end if;
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
notify pgrst,'reload schema';
commit;

