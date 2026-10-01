-- ESO V6.2.3: attribute an already-completed ESO to the person who completed it outside the app.
-- The operation is intentionally separate from normal task assignment: it never re-opens or
-- changes the completion status, and it is callable only by the server service role.
begin;

create or replace function public.eso_set_completion_resolver_v622(
  p_actor uuid,
  p_report uuid,
  p_expected_version integer,
  p_resolver uuid
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  a public.employees%rowtype;
  r public.eso_reports%rowtype;
  t public.maintenance_tasks%rowtype;
  resolver public.employees%rowtype;
  before_state jsonb;
  after_state jsonb;
  v_completed_at timestamptz;
begin
  select * into a
  from public.employees
  where id=p_actor and active
  for share;
  if not found or a.role not in ('admin','super_admin') then
    raise exception 'Only an Admin or Super Admin can set Completed by.' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.companies c
    join public.plants p on p.company_id=c.id
    where c.id=a.company_id and c.active and p.id=a.plant_id and p.active
  ) then
    raise exception 'Inactive company or plant' using errcode='42501';
  end if;

  select * into r
  from public.eso_reports
  where id=p_report
    and company_id=a.company_id
    and (a.role='super_admin' or plant_id=a.plant_id)
  for update;
  if not found then
    raise exception 'ESO unavailable in your scope' using errcode='42501';
  end if;
  if p_expected_version is null or r.revision<>p_expected_version then
    raise exception 'ESO changed. Refresh the detail and review before saving again.' using errcode='40001';
  end if;
  if r.status not in ('completed','closed') then
    raise exception 'Only a completed ESO can receive a Completed by attribution.' using errcode='P0001';
  end if;

  select * into resolver
  from public.employees
  where id=p_resolver
    and company_id=a.company_id
    and plant_id=r.plant_id
    and active
  for share;
  if not found then
    raise exception 'Choose an active employee from the ESO plant.' using errcode='42501';
  end if;

  select * into t
  from public.maintenance_tasks
  where eso_report_id=r.id
  for update;

  before_state=jsonb_build_object(
    'report',to_jsonb(r),
    'task',case when t.id is null then null else to_jsonb(t) end
  );
  v_completed_at=coalesce(r.completed_at,t.completed_at,now());

  if t.id is null then
    insert into public.maintenance_tasks(
      company_id,plant_id,eso_report_id,assigned_to,assigned_by,status,
      assigned_at,started_at,completed_at,completed_by,completion_note
    ) values(
      a.company_id,r.plant_id,r.id,resolver.id,a.id,'completed',
      v_completed_at,v_completed_at,v_completed_at,resolver.id,''
    ) returning * into t;
  else
    update public.maintenance_tasks
    set assigned_to=resolver.id,
        assigned_by=a.id,
        status='completed',
        assigned_at=coalesce(public.maintenance_tasks.assigned_at,v_completed_at),
        started_at=coalesce(public.maintenance_tasks.started_at,v_completed_at),
        completed_at=coalesce(public.maintenance_tasks.completed_at,v_completed_at),
        completed_by=resolver.id
    where id=t.id
    returning * into t;
  end if;

  -- Touching the report gives the client an optimistic-lock version bump while retaining
  -- the original completion date and status.
  update public.eso_reports
  set completed_at=coalesce(r.completed_at,v_completed_at),
      updated_at=now()
  where id=r.id
  returning * into r;

  after_state=jsonb_build_object(
    'report',to_jsonb(r),
    'task',to_jsonb(t)
  );
  insert into public.eso_audit_events(
    eso_report_id,company_id,plant_id,actor_id,action,old_values,new_values
  ) values(
    r.id,a.company_id,r.plant_id,a.id,'set_completion_resolver',before_state,after_state
  );

  return jsonb_build_object(
    'id',r.id,
    'report_no',r.report_no,
    'revision',r.revision,
    'completed_by',resolver.id,
    'completed_at',r.completed_at
  );
end;
$$;

revoke all on function public.eso_set_completion_resolver_v622(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.eso_set_completion_resolver_v622(uuid,uuid,integer,uuid) to service_role;
notify pgrst,'reload schema';
commit;
