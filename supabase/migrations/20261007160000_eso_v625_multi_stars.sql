-- ESO V6.2.5: allow one STAR vote per authorized user and ESO.
-- Existing single-star values are preserved where the original awarding user is known.
begin;

create table public.eso_report_stars(
 report_id uuid not null references public.eso_reports(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 plant_id uuid not null,
 starred_by uuid not null references public.employees(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(report_id,starred_by),
 foreign key(company_id,plant_id) references public.plants(company_id,id) on delete cascade
);
create index eso_report_stars_scope_idx on public.eso_report_stars(company_id,plant_id,report_id);
create index eso_report_stars_report_idx on public.eso_report_stars(report_id,created_at desc);
alter table public.eso_report_stars enable row level security;
revoke all on public.eso_report_stars from public,anon,authenticated;
grant select,insert,delete on public.eso_report_stars to service_role;

insert into public.eso_report_stars(report_id,company_id,plant_id,starred_by,created_at)
select id,company_id,plant_id,starred_by,coalesce(starred_at,created_at)
from public.eso_reports
where is_starred and starred_by is not null
on conflict(report_id,starred_by) do nothing;

create function public.eso_toggle_star_v625(p_actor uuid,p_report uuid,p_starred boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 a public.employees%rowtype;
 r public.eso_reports%rowtype;
 old_report jsonb;
 old_count integer;
 new_count integer;
 latest_by uuid;
 latest_at timestamptz;
begin
 if p_starred is null then raise exception 'Invalid star value'; end if;
 select * into a from public.employees where id=p_actor and active for share;
 if not found or a.role not in('management','admin','super_admin') then raise exception 'Manager role required' using errcode='42501'; end if;
 if not exists(select 1 from public.companies c join public.plants p on p.company_id=c.id where c.id=a.company_id and c.active and p.id=a.plant_id and p.active) then
  raise exception 'Inactive company or plant' using errcode='42501';
 end if;
 select * into r from public.eso_reports where id=p_report and company_id=a.company_id and (a.role='super_admin' or plant_id=a.plant_id) and not reclassified_to_voe for update;
 if not found then raise exception 'ESO unavailable in your scope' using errcode='42501'; end if;
 old_report=to_jsonb(r);
 select count(*) into old_count from public.eso_report_stars where report_id=r.id;
 if p_starred then
  insert into public.eso_report_stars(report_id,company_id,plant_id,starred_by)
  values(r.id,a.company_id,r.plant_id,a.id)
  on conflict(report_id,starred_by) do nothing;
 else
  delete from public.eso_report_stars where report_id=r.id and starred_by=a.id;
 end if;
 select count(*) into new_count from public.eso_report_stars where report_id=r.id;
 select starred_by,created_at into latest_by,latest_at from public.eso_report_stars where report_id=r.id order by created_at desc,starred_by limit 1;
 update public.eso_reports set
  is_starred=(new_count>0),
  starred_by=latest_by,
  starred_at=latest_at
 where id=r.id returning * into r;
 insert into public.eso_audit_events(eso_report_id,company_id,plant_id,actor_id,action,old_values,new_values)
 values(r.id,a.company_id,r.plant_id,a.id,'star',jsonb_build_object('report',old_report,'star_count',old_count),jsonb_build_object('report',to_jsonb(r),'star_count',new_count,'starred',p_starred));
 return jsonb_build_object('id',r.id,'revision',r.revision,'starred',p_starred,'star_count',new_count);
end $$;
revoke all on function public.eso_toggle_star_v625(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.eso_toggle_star_v625(uuid,uuid,boolean) to service_role;

commit;
