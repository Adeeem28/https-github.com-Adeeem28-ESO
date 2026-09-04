-- ESO V5.6 Multi-company / tenant migration
-- Run ONCE in Supabase SQL Editor BEFORE deploying V5.6.
-- Existing records are preserved and assigned to the first/default company.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists companies_code_ci_uq on public.companies (lower(code));

insert into public.companies(name,code,active)
select 'Default Company','DEFAULT',true
where not exists (select 1 from public.companies);

-- Add tenant ownership to every business table.
do $$
declare t text;
begin
  foreach t in array array['departments','employees','locations','eso_reports','maintenance_tasks','corrective_actions','eso_attachments','eso_status_history','notifications'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists company_id uuid references public.companies(id)',t);
      execute format('update public.%I set company_id=(select id from public.companies order by created_at limit 1) where company_id is null',t);
      execute format('alter table public.%I alter column company_id set not null',t);
      execute format('create index if not exists %I on public.%I(company_id)', 'idx_'||t||'_company', t);
    end if;
  end loop;
end $$;

-- Names/employee numbers only need to be unique inside a company.
alter table public.departments drop constraint if exists departments_name_key;
alter table public.employees drop constraint if exists employees_employee_no_key;
alter table public.employees drop constraint if exists employees_employee_id_key;
create unique index if not exists departments_company_name_uq on public.departments(company_id,lower(name));
create unique index if not exists employees_company_no_uq on public.employees(company_id,employee_no);

-- Tenant-aware login. Company code is optional only while an Employee ID is globally unambiguous.
-- This preserves the current login experience for the first company while allowing duplicate IDs later.
create or replace function public.verify_eso_login_tenant(p_employee_no text, p_password text default null, p_company_code text default null)
returns table(id uuid, employee_no text, first_name text, last_name text, role text, annual_eso_target integer, active boolean, department_name text, company_id uuid, company_name text, company_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare matches integer;
begin
  if coalesce(trim(p_company_code),'')='' then
    select count(*) into matches from employees e where e.employee_no=trim(p_employee_no) and e.active=true;
    if matches<>1 then return; end if;
  end if;
  return query
  select e.id,e.employee_no,e.first_name,e.last_name,e.role,e.annual_eso_target,e.active,d.name,c.id,c.name,c.code
  from employees e
  join companies c on c.id=e.company_id and c.active=true
  left join departments d on d.id=e.department_id
  where e.employee_no=trim(p_employee_no) and e.active=true
    and (coalesce(trim(p_company_code),'')='' or lower(c.code)=lower(trim(p_company_code)))
    and (e.role='employee' or (e.password_hash is not null and e.password_hash=crypt(coalesce(p_password,''),e.password_hash)))
  limit 1;
end $$;

-- RLS-ready helper. Current app server uses the service role, so API routes also enforce company_id.
-- When Supabase Auth/SSO is introduced, this becomes the basis for database policies.
alter table public.companies enable row level security;

-- Convenience view for tenant integrity review.
create or replace view public.eso_tenant_integrity as
select r.id as eso_report_id,r.report_no,r.company_id as report_company,e.company_id as reporter_company,
       l.company_id as location_company,t.company_id as task_company
from public.eso_reports r
join public.employees e on e.id=r.reporter_id
left join public.locations l on l.id=r.location_id
left join public.maintenance_tasks t on t.eso_report_id=r.id;
