begin;
-- Server-only, actor-scoped paging. Filters and total are evaluated together.
create function public.eso_report_page_v628(p_actor uuid,p_filter jsonb default '{}',p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.employees%rowtype; result jsonb;
begin
  select e.* into actor from public.employees e join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active where e.id=p_actor and e.active;
  if actor.id is null then raise exception 'Active employee required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid page'; end if;
  with matches as materialized (
    select r.id,r.reported_at from public.eso_reports r
    join public.employees e on e.id=r.reporter_id and e.company_id=r.company_id
    left join public.departments d on d.id=e.department_id
    left join public.locations l on l.id=r.location_id
    where r.company_id=actor.company_id and not r.reclassified_to_voe
      and (actor.role='super_admin' or r.plant_id=actor.plant_id)
      and (actor.role<>'employee' and coalesce(p_filter->>'mine','false')<>'true' or r.reporter_id=actor.id)
      and (coalesce(p_filter->>'q','')='' or position(lower(p_filter->>'q') in lower(concat_ws(' ',r.report_no,e.first_name,e.last_name,e.employee_no,d.name,l.name)))>0)
      and (coalesce(p_filter->>'status','All')='All' or
        case when r.status in ('completed','closed') then 'Completed' when r.status in ('in_progress','assigned','waiting') then 'In Progress' else 'Open' end=p_filter->>'status')
      and (coalesce(p_filter->>'urgency','All')='All' or r.urgency::text=lower(p_filter->>'urgency'))
      and (coalesce(p_filter->>'category','All')='All' or r.category::text=lower(p_filter->>'category'))
      and (coalesce(p_filter->>'department','All')='All' or coalesce(d.name,'Unassigned')=p_filter->>'department')
      and (coalesce(p_filter->>'location','All')='All' or coalesce(l.name,'Unknown')=p_filter->>'location')
      and (nullif(p_filter->>'from','') is null or r.reported_at>=(p_filter->>'from')::timestamptz)
      and (nullif(p_filter->>'to','') is null or r.reported_at<(p_filter->>'to')::timestamptz)
      and (coalesce(p_filter->>'stars','false')<>'true' or r.is_starred or exists(select 1 from public.eso_report_stars s where s.report_id=r.id))
  ), page as (select * from matches order by reported_at desc,id limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from matches),'ids',coalesce((select jsonb_agg(id order by reported_at desc,id) from page),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.eso_report_page_v628(uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.eso_report_page_v628(uuid,jsonb,integer,integer) to service_role;

-- Return aggregates instead of sending every report/task to the application for counting.
create function public.eso_metrics_v628(p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.employees%rowtype; today date:=(now() at time zone 'Europe/Sarajevo')::date;
  year_start date; year_end date; result jsonb;
begin
  select e.* into actor from public.employees e join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active where e.id=p_actor and e.active;
  if actor.id is null then raise exception 'Active employee required' using errcode='42501'; end if;
  year_start:=make_date(extract(year from today)::integer-case when extract(month from today)<10 then 1 else 0 end,10,1);
  year_end:=(year_start+interval '1 year')::date;
  with scoped as materialized (
    select r.* from public.eso_reports r where r.company_id=actor.company_id and not r.reclassified_to_voe
      and (actor.role='super_admin' or r.plant_id=actor.plant_id)
  ), cohort as materialized (
    select r.*,coalesce(r.closed_at,r.completed_at,t.completed_at) as finished_at from scoped r
    left join public.maintenance_tasks t on t.eso_report_id=r.id and t.status='completed'
    where r.reported_at>=year_start::timestamp at time zone 'Europe/Sarajevo' and r.reported_at<year_end::timestamp at time zone 'Europe/Sarajevo'
  ), completed as materialized (
    select t.plant_id,coalesce(t.completed_by,t.assigned_to) resolver,
      coalesce(t.completed_at,r.closed_at,r.completed_at) finished_at,t.completed_at task_finished_at
    from public.maintenance_tasks t join scoped r on r.id=t.eso_report_id
    where t.status='completed' and coalesce(t.completed_at,r.closed_at,r.completed_at)>=year_start::timestamp at time zone 'Europe/Sarajevo'
      and coalesce(t.completed_at,r.closed_at,r.completed_at)<year_end::timestamp at time zone 'Europe/Sarajevo'
  ), reporters as (
    select reporter_id id,count(*) ytd,count(*) filter(where extract(month from reported_at at time zone 'Europe/Sarajevo')=extract(month from today)) "month" from cohort group by reporter_id
  ), resolvers as (
    select resolver id,count(*) ytd,count(*) filter(where extract(month from finished_at at time zone 'Europe/Sarajevo')=extract(month from today)) "month" from completed where resolver is not null group by resolver
  ), periods as (
    select 'week' key,greatest(year_start,date_trunc('week',today)::date) start union all select 'month',greatest(year_start,date_trunc('month',today)::date) union all select 'year',year_start
  ), closures as (
    select p.key,p.start,count(r.id) reported,count(r.id) filter(where (r.finished_at at time zone 'Europe/Sarajevo')::date<=today) closed
    from periods p left join cohort r on (r.reported_at at time zone 'Europe/Sarajevo')::date between p.start and today group by p.key,p.start
  )
  select jsonb_build_object(
    'year',extract(year from year_end),'currentMonth',extract(month from today),
    'reporters',coalesce((select jsonb_agg(to_jsonb(x)) from reporters x),'[]'::jsonb),
    'resolvers',coalesce((select jsonb_agg(to_jsonb(x)) from resolvers x),'[]'::jsonb),
    'monthly',(select jsonb_agg(jsonb_build_object('month',m,'reported',(select count(*) from cohort r where extract(month from r.reported_at at time zone 'Europe/Sarajevo')=m),'resolved',(select count(*) from completed t where extract(month from t.task_finished_at at time zone 'Europe/Sarajevo')=m)) order by m) from generate_series(1,12) m),
    'closureRates',(select jsonb_object_agg(key,jsonb_build_object('reported',reported,'closed',closed,'open',reported-closed,'rate',case when reported=0 then 0 else round(closed*100.0/reported) end,'start',start,'end',today)) from closures),
    'plants',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'reportedYtd',(select count(*) from cohort r where r.plant_id=p.id),'resolvedYtd',(select count(*) from completed t where t.plant_id=p.id and t.task_finished_at is not null),'open',(select count(*) from cohort r where r.plant_id=p.id and r.status not in ('completed','closed')))),'[]'::jsonb) from public.plants p where p.company_id=actor.company_id and (actor.role='super_admin' or p.id=actor.plant_id))
  ) into result;
  return result;
end;
$$;
revoke all on function public.eso_metrics_v628(uuid) from public,anon,authenticated;
grant execute on function public.eso_metrics_v628(uuid) to service_role;
create index if not exists eso_reports_paging_v628_idx on public.eso_reports(company_id,plant_id,reported_at desc,id) where not reclassified_to_voe;
notify pgrst,'reload schema';
commit;
