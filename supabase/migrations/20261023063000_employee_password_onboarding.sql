-- Existing sessions keep their normal expiry. New passwordless employee logins
-- receive a restricted setup session, never an application session.
begin;
alter table public.eso_sessions add column password_setup boolean not null default false;
alter table public.eso_sessions add column legacy_password_grace boolean not null default false;
update public.eso_sessions s set legacy_password_grace=true
from public.employees e where e.id=s.employee_id and e.role='employee'
  and e.password_hash is null and s.revoked_at is null and s.expires_at>now();

create function public.eso_login_v626(p_employee_no text,p_password text,p_company_code text default null,p_plant_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare candidate public.employees%rowtype; matches integer;
begin
  if p_password is null or p_password='' or octet_length(p_password)>72 then return null; end if;
  select count(*) into matches from public.employees e
    join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active
    where e.active and e.employee_no=btrim(p_employee_no)
      and (coalesce(btrim(p_company_code),'')='' or lower(c.code)=lower(btrim(p_company_code)))
      and (coalesce(btrim(p_plant_code),'')='' or lower(p.code)=lower(btrim(p_plant_code)));
  if matches<>1 then return null; end if;
  select e.* into candidate from public.employees e
    join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active
    where e.active and e.employee_no=btrim(p_employee_no)
      and (coalesce(btrim(p_company_code),'')='' or lower(c.code)=lower(btrim(p_company_code)))
      and (coalesce(btrim(p_plant_code),'')='' or lower(p.code)=lower(btrim(p_plant_code))) for share of e;
  if candidate.id is null then return null; end if;
  if candidate.password_hash is null then
    if candidate.role='employee' and p_password=candidate.employee_no then
      return jsonb_build_object('id',candidate.id,'password_setup',true);
    end if;
    return null;
  end if;
  if candidate.password_hash=extensions.crypt(p_password,candidate.password_hash) then
    return jsonb_build_object('id',candidate.id,'password_setup',false);
  end if;
  return null;
end;
$$;
revoke all on function public.eso_login_v626(text,text,text,text) from public,anon,authenticated;
grant execute on function public.eso_login_v626(text,text,text,text) to service_role;

create function public.eso_finish_password_setup_v626(p_token_hash text,p_password text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare s public.eso_sessions%rowtype; e public.employees%rowtype;
begin
  select * into s from public.eso_sessions where token_hash=p_token_hash and password_setup and revoked_at is null and expires_at>now();
  if s.id is null then raise exception 'Setup session expired'; end if;
  -- Lock the employee first, consistently with the password-change trigger.
  select emp.* into e from public.employees emp
    join public.companies c on c.id=emp.company_id and c.active
    join public.plants p on p.id=emp.plant_id and p.company_id=emp.company_id and p.active
    where emp.id=s.employee_id and emp.active and emp.role='employee' for update of emp;
  if e.id is null or e.password_hash is not null then raise exception 'Password setup no longer available'; end if;
  perform 1 from public.eso_sessions where id=s.id and password_setup and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Setup session expired'; end if;
  if p_password is null or length(p_password)<12 or octet_length(p_password)>72 or p_password=e.employee_no then
    raise exception 'Use a new password of at least 12 characters (maximum 72 bytes), different from Employee ID';
  end if;
  update public.employees set password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',10)) where id=e.id;
  return e.id;
end;
$$;
revoke all on function public.eso_finish_password_setup_v626(text,text) from public,anon,authenticated;
grant execute on function public.eso_finish_password_setup_v626(text,text) to service_role;

create or replace function public.change_eso_password(p_user_id uuid,p_current_password text,p_new_password text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare e public.employees%rowtype;
begin
  select * into e from public.employees where id=p_user_id and active for update;
  if e.id is null or e.password_hash is null or octet_length(coalesce(p_current_password,''))>72
    or e.password_hash<>extensions.crypt(coalesce(p_current_password,''),e.password_hash) then raise exception 'Current password is incorrect'; end if;
  if p_new_password is null or length(p_new_password)<12 or octet_length(p_new_password)>72 or p_new_password=e.employee_no or p_new_password=p_current_password then
    raise exception 'Choose a different password of at least 12 characters (maximum 72 bytes)';
  end if;
  update public.employees set password_hash=extensions.crypt(p_new_password,extensions.gen_salt('bf',10)) where id=p_user_id;
  return true;
end;
$$;
revoke all on function public.change_eso_password(uuid,text,text) from public,anon,authenticated;
grant execute on function public.change_eso_password(uuid,text,text) to service_role;
create or replace function public.eso_revoke_sessions_v622() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='employees' then
  if new.password_hash is distinct from old.password_hash or new.role is distinct from old.role or new.active is distinct from old.active or new.company_id is distinct from old.company_id or new.plant_id is distinct from old.plant_id then
   update public.eso_sessions set revoked_at=now() where employee_id=new.id and revoked_at is null and not (
     legacy_password_grace and not password_setup and old.password_hash is null and new.password_hash is not null
     and old.role='employee' and new.role=old.role and new.active=old.active
     and new.company_id=old.company_id and new.plant_id=old.plant_id
   );
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

create or replace function public.eso_save_employee_v622(p_actor uuid,p_user uuid,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
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
 if password is not null then
  if length(password)<8 or octet_length(password)>72 then raise exception 'Password must contain at least 8 characters and at most 72 bytes';end if;
  hash=extensions.crypt(password,extensions.gen_salt('bf',10));
 elsif hash is null and new_role<>'employee' then raise exception 'A password is required for privileged roles';
 end if;
 if p_user is null then
  insert into public.employees(company_id,plant_id,employee_no,first_name,last_name,department_id,role,annual_eso_target,active,password_hash)values(a.company_id,pid,eno,v_first_name,v_last_name,dep,new_role,target,enabled,hash) returning * into e;
 else
  update public.employees set plant_id=pid,first_name=v_first_name,last_name=v_last_name,department_id=dep,role=new_role,annual_eso_target=target,active=enabled,password_hash=hash where id=e.id returning * into e;
 end if;return jsonb_build_object('id',e.id);
end $$;
revoke all on function public.eso_save_employee_v622(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.eso_save_employee_v622(uuid,uuid,jsonb) to service_role;
CREATE OR REPLACE FUNCTION public.verify_eso_login_tenant(p_employee_no text, p_password text DEFAULT NULL::text, p_company_code text DEFAULT NULL::text, p_plant_code text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, employee_no text, first_name text, last_name text, role text, annual_eso_target integer, active boolean, department_name text, company_id uuid, company_name text, company_code text, plant_id uuid, plant_name text, plant_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare matches integer;
begin
  if coalesce(trim(p_company_code),'')='' and coalesce(trim(p_plant_code),'')='' then
    select count(*) into matches from employees e where e.employee_no=trim(p_employee_no) and e.active=true;
    if matches<>1 then return; end if;
  end if;
  return query
  select e.id,e.employee_no,e.first_name,e.last_name,e.role,e.annual_eso_target,e.active,d.name,c.id,c.name,c.code,p.id,p.name,p.code
  from employees e join companies c on c.id=e.company_id and c.active=true join plants p on p.id=e.plant_id and p.company_id=c.id and p.active=true left join departments d on d.id=e.department_id
  where e.employee_no=trim(p_employee_no) and e.active=true
    and (coalesce(trim(p_company_code),'')='' or lower(c.code)=lower(trim(p_company_code)))
    and (coalesce(trim(p_plant_code),'')='' or lower(p.code)=lower(trim(p_plant_code)))
    and (e.password_hash is not null and e.password_hash=crypt(coalesce(p_password,''),e.password_hash))
  limit 1;
end $function$;

notify pgrst,'reload schema';
commit;
