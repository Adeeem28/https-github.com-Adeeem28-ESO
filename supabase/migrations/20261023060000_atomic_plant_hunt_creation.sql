-- All-or-nothing creation. Actor authorization is repeated in the database.
begin;

create function public.eso_create_plant_v626(p_actor uuid, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  actor public.employees%rowtype;
  plant public.plants%rowtype;
  admin_id uuid;
  admin_no text := btrim(coalesce(p_data->>'adminEmployeeId',''));
  admin_name text := btrim(coalesce(p_data->>'adminName',''));
  password text := coalesce(p_data->>'adminPassword','');
  plant_name text := btrim(coalesce(p_data->>'name',''));
  plant_code text := btrim(coalesce(p_data->>'code',''));
begin
  select e.* into actor from public.employees e
    join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active
    where e.id=p_actor and e.active and e.role='super_admin' for share of e,c,p;
  if actor.id is null then raise exception 'Active Super Admin required'; end if;
  if length(plant_name) not between 1 and 120 or plant_code !~ '^[A-Z0-9_-]{1,60}$' then
    raise exception 'Invalid plant name or code';
  end if;
  if admin_no<>'' or admin_name<>'' or password<>'' then
    if length(admin_no) not between 1 and 100 or length(admin_name) not between 1 and 160
       or length(password)<8 or octet_length(password)>72 then
      raise exception 'Invalid administrator details or password';
    end if;
  end if;
  insert into public.plants(company_id,name,code,active)
    values(actor.company_id,plant_name,plant_code,true) returning * into plant;
  if admin_no<>'' then
    insert into public.employees(company_id,plant_id,employee_no,first_name,last_name,role,annual_eso_target,active)
      values(actor.company_id,plant.id,admin_no,split_part(admin_name,' ',1),
        coalesce(nullif(btrim(substr(admin_name,length(split_part(admin_name,' ',1))+1)),''),'-'),'admin',12,true)
      returning id into admin_id;
    perform public.admin_set_eso_password(admin_id,password);
  end if;
  return jsonb_build_object('id',plant.id,'name',plant.name,'code',plant.code);
end;
$$;
revoke all on function public.eso_create_plant_v626(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.eso_create_plant_v626(uuid,jsonb) to service_role;

create function public.eso_create_hunt_v626(p_actor uuid,p_year integer,p_data jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare
  actor public.employees%rowtype;
  event_id uuid := gen_random_uuid();
  scope text := coalesce(nullif(p_data->>'scopeType',''),'all');
  plant_id uuid := nullif(p_data->>'plantId','')::uuid;
  location_id uuid := nullif(p_data->>'locationId','')::uuid;
  team jsonb;
  team_id uuid;
  member_id uuid;
  existing public.eso_hunt_teams%rowtype;
  seen_users uuid[] := '{}';
  seen_colors text[] := '{}';
  color text;
  name text;
begin
  select e.* into actor from public.employees e
    join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active
    where e.id=p_actor and e.active and e.role='super_admin' for share of e,c,p;
  if actor.id is null then raise exception 'Active Super Admin required'; end if;
  -- Serialize season preparation with other creation calls for this company.
  perform pg_advisory_xact_lock(hashtextextended(actor.company_id::text,626));
  if exists(select 1 from public.eso_hunt_events e where e.company_id=actor.company_id and e.status='live') then
    raise exception 'Finish the active Hunt first';
  end if;
  if p_year is distinct from (extract(year from now() at time zone 'Europe/Sarajevo')::integer
    + case when extract(month from now() at time zone 'Europe/Sarajevo')>=10 then 1 else 0 end) then
    raise exception 'Invalid fiscal year';
  end if;
  if length(btrim(coalesce(p_data->>'title',''))) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if scope not in ('all','plant','location') then raise exception 'Invalid scope'; end if;
  if scope<>'all' and not exists(select 1 from public.plants p where p.id=plant_id and p.company_id=actor.company_id and p.active) then
    raise exception 'Invalid plant';
  end if;
  if scope='location' and not exists(select 1 from public.locations l where l.id=location_id and l.plant_id=plant_id and l.company_id=actor.company_id and l.active) then
    raise exception 'Invalid location';
  end if;
  if jsonb_typeof(p_data->'teams') is distinct from 'array' then raise exception 'Invalid teams'; end if;
  if jsonb_array_length(p_data->'teams') not between 2 and 9 then raise exception 'Choose between 2 and 9 teams'; end if;
  insert into public.eso_hunt_events(id,company_id,fiscal_year,title,scope_type,plant_id,location_id,created_by)
    values(event_id,actor.company_id,p_year,btrim(p_data->>'title'),scope,plant_id,location_id,p_actor);
  for team in select value from jsonb_array_elements(p_data->'teams') loop
    name:=btrim(coalesce(team->>'name','')); color:=lower(btrim(coalesce(team->>'colorKey','')));
    if length(name) not between 1 and 80 or color not in ('blue','green','yellow','red','purple','orange','teal','pink','black') or color=any(seen_colors) then
      raise exception 'Invalid or repeated team name/color';
    end if;
    seen_colors:=array_append(seen_colors,color);
    team_id:=nullif(team->>'id','')::uuid;
    if team_id is not null then
      select t.* into existing from public.eso_hunt_teams t where t.id=team_id and t.company_id=actor.company_id and t.fiscal_year=p_year and t.active for update;
      if existing.id is null or existing.name<>name or existing.color_key<>color then raise exception 'Existing team does not match'; end if;
    else
      insert into public.eso_hunt_teams(company_id,fiscal_year,name,color_key,created_by)
        values(actor.company_id,p_year,name,color,p_actor) returning id into team_id;
    end if;
    if jsonb_typeof(team->'memberIds') is distinct from 'array' then raise exception 'Invalid members'; end if;
    if jsonb_array_length(team->'memberIds')=0 then raise exception 'Every team requires a member'; end if;
    for member_id in select value::uuid from jsonb_array_elements_text(team->'memberIds') loop
      if member_id=any(seen_users) then raise exception 'Repeated team member'; end if;
      seen_users:=array_append(seen_users,member_id);
      perform 1 from public.employees e where e.id=member_id and e.company_id=actor.company_id and e.active and e.role<>'super_admin' for share;
      if not found then raise exception 'Invalid team member'; end if;
      if exists(select 1 from public.eso_hunt_team_members m where m.company_id=actor.company_id and m.fiscal_year=p_year and m.user_id=member_id and m.team_id<>team_id) then
        raise exception 'Member already belongs to another team';
      end if;
      insert into public.eso_hunt_team_members(company_id,fiscal_year,team_id,user_id,assigned_by)
        values(actor.company_id,p_year,team_id,member_id,p_actor) on conflict on constraint eso_hunt_team_members_team_id_user_id_key do nothing;
    end loop;
    insert into public.eso_hunt_event_teams(event_id,company_id,fiscal_year,team_id)
      values(event_id,actor.company_id,p_year,team_id);
  end loop;
  return event_id;
end;
$$;
revoke all on function public.eso_create_hunt_v626(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.eso_create_hunt_v626(uuid,integer,jsonb) to service_role;
notify pgrst,'reload schema';
commit;

