create extension if not exists pgcrypto;
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists plants_company_code_uq on public.plants(company_id,lower(code));
create index if not exists idx_plants_company on public.plants(company_id);
insert into public.plants(company_id,name,code,active)
select c.id,'Cazin','CAZIN',true from public.companies c
where not exists (select 1 from public.plants p where p.company_id=c.id);
do $$
declare t text;
begin
  foreach t in array array['departments','employees','locations','eso_reports','maintenance_tasks','corrective_actions','eso_attachments','eso_status_history','notifications'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists plant_id uuid references public.plants(id)',t);
      execute format('update public.%I x set plant_id=(select p.id from public.plants p where p.company_id=x.company_id order by p.created_at limit 1) where plant_id is null',t);
      execute format('alter table public.%I alter column plant_id set not null',t);
      execute format('create index if not exists %I on public.%I(plant_id)', 'idx_'||t||'_plant', t);
    end if;
  end loop;
end $$;
drop index if exists public.employees_company_no_uq;
drop index if exists public.departments_company_name_uq;
create unique index if not exists employees_company_plant_no_uq on public.employees(company_id,plant_id,employee_no);
create unique index if not exists departments_company_plant_name_uq on public.departments(company_id,plant_id,lower(name));
drop function if exists public.verify_eso_login_tenant(text,text,text);
create or replace function public.verify_eso_login_tenant(
  p_employee_no text,
  p_password text default null,
  p_company_code text default null,
  p_plant_code text default null
)
returns table(id uuid, employee_no text, first_name text, last_name text, role text, annual_eso_target integer, active boolean, department_name text, company_id uuid, company_name text, company_code text, plant_id uuid, plant_name text, plant_code text)
language plpgsql security definer set search_path=public,extensions as $$
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
    and (e.role='employee' or (e.password_hash is not null and e.password_hash=crypt(coalesce(p_password,''),e.password_hash)))
  limit 1;
end $$;
create or replace view public.eso_tenant_integrity as
select r.id as eso_report_id,r.report_no,r.company_id as report_company,e.company_id as reporter_company,l.company_id as location_company,t.company_id as task_company,r.plant_id as report_plant,e.plant_id as reporter_plant,l.plant_id as location_plant,t.plant_id as task_plant
from public.eso_reports r join public.employees e on e.id=r.reporter_id left join public.locations l on l.id=r.location_id left join public.maintenance_tasks t on t.eso_report_id=r.id;
