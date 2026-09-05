-- ESO V5.7 Platform Owner / multi-corporation SaaS migration
create extension if not exists pgcrypto;

alter table public.companies add column if not exists plan text not null default 'Trial';
alter table public.companies add column if not exists subscription_status text not null default 'trial';
alter table public.companies add column if not exists updated_at timestamptz not null default now();

create table if not exists public.platform_owners (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists platform_owners_username_ci_uq on public.platform_owners(lower(username));

-- Bootstrap the first platform owner from the existing application owner/admin account.
insert into public.platform_owners(username,display_name,password_hash,active)
select e.employee_no, trim(e.first_name||' '||e.last_name), e.password_hash, true
from public.employees e
where e.employee_no='10375305' and e.password_hash is not null
  and not exists (select 1 from public.platform_owners po where lower(po.username)=lower(e.employee_no))
limit 1;

create or replace function public.verify_platform_owner_login(p_username text, p_password text)
returns table(id uuid, username text, display_name text)
language sql security definer set search_path=public,extensions as $$
  select po.id,po.username,po.display_name
  from public.platform_owners po
  where lower(po.username)=lower(trim(p_username))
    and po.active=true
    and po.password_hash=crypt(coalesce(p_password,''),po.password_hash)
  limit 1;
$$;
revoke all on function public.verify_platform_owner_login(text,text) from public;
grant execute on function public.verify_platform_owner_login(text,text) to anon, authenticated, service_role;

create or replace function public.platform_create_company(
  p_name text,
  p_code text,
  p_plan text,
  p_subscription_status text,
  p_plant_name text,
  p_plant_code text,
  p_admin_employee_no text,
  p_admin_first_name text,
  p_admin_last_name text,
  p_admin_password text
)
returns table(company_id uuid, plant_id uuid, admin_id uuid)
language plpgsql security definer set search_path=public,extensions as $$
declare
  v_company uuid;
  v_plant uuid;
  v_admin uuid;
begin
  if length(trim(coalesce(p_name,'')))=0 or length(trim(coalesce(p_code,'')))=0 then
    raise exception 'Company name and code are required.';
  end if;
  if length(trim(coalesce(p_plant_name,'')))=0 or length(trim(coalesce(p_plant_code,'')))=0 then
    raise exception 'First plant name and code are required.';
  end if;
  if length(trim(coalesce(p_admin_employee_no,'')))=0 then
    raise exception 'Super Admin Employee ID is required.';
  end if;
  if length(coalesce(p_admin_password,'')) < 6 then
    raise exception 'Super Admin password must be at least 6 characters.';
  end if;

  insert into public.companies(name,code,active,plan,subscription_status)
  values(trim(p_name),upper(trim(p_code)),true,coalesce(nullif(trim(p_plan),''),'Trial'),coalesce(nullif(trim(p_subscription_status),''),'trial'))
  returning id into v_company;

  insert into public.plants(company_id,name,code,active)
  values(v_company,trim(p_plant_name),upper(trim(p_plant_code)),true)
  returning id into v_plant;

  insert into public.employees(company_id,plant_id,employee_no,first_name,last_name,department_id,role,annual_eso_target,active,password_hash)
  values(v_company,v_plant,trim(p_admin_employee_no),trim(p_admin_first_name),trim(p_admin_last_name),null,'super_admin',12,true,crypt(p_admin_password,gen_salt('bf')))
  returning id into v_admin;

  return query select v_company,v_plant,v_admin;
end;
$$;
revoke all on function public.platform_create_company(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.platform_create_company(text,text,text,text,text,text,text,text,text,text) to service_role;

-- Company-specific login keeps the employee screen simple while safely allowing duplicate Employee IDs across corporations.
create or replace function public.verify_eso_company_login(p_company_code text,p_employee_no text,p_password text default null)
returns table(id uuid, employee_no text, first_name text, last_name text, role text, department_id uuid, department_name text, annual_eso_target integer, active boolean, company_id uuid, company_code text, company_name text, plant_id uuid, plant_code text, plant_name text)
language sql security definer set search_path=public,extensions as $$
  select e.id,e.employee_no,e.first_name,e.last_name,e.role,e.department_id,d.name,e.annual_eso_target,e.active,c.id,c.code,c.name,p.id,p.code,p.name
  from public.employees e
  join public.companies c on c.id=e.company_id and c.active=true
  join public.plants p on p.id=e.plant_id and p.company_id=c.id and p.active=true
  left join public.departments d on d.id=e.department_id
  where lower(c.code)=lower(trim(p_company_code)) and e.employee_no=trim(p_employee_no) and e.active=true
    and (e.role='employee' or (p_password is not null and e.password_hash is not null and e.password_hash=crypt(p_password,e.password_hash)))
  limit 1;
$$;
revoke all on function public.verify_eso_company_login(text,text,text) from public;
grant execute on function public.verify_eso_company_login(text,text,text) to anon, authenticated, service_role;
