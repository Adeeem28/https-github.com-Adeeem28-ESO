-- Fix the trigger variable/column ambiguity found in the transactional smoke test
-- and cover the new Hunt foreign keys used by the event and review queries.
begin;

create or replace function public.eso_hunt_capture_submission_v624()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_team_id uuid;
begin
  if new.reclassified_to_voe then
    return new;
  end if;

  select e.id, t.id
    into v_event_id, v_team_id
    from public.eso_hunt_events e
    join public.eso_hunt_event_teams et
      on et.event_id = e.id and et.company_id = e.company_id
    join public.eso_hunt_team_members tm
      on tm.team_id = et.team_id
     and tm.company_id = e.company_id
     and tm.fiscal_year = e.fiscal_year
     and tm.user_id = new.reporter_id
    join public.eso_hunt_teams t
      on t.id = tm.team_id
     and t.company_id = e.company_id
     and t.fiscal_year = e.fiscal_year
   where e.company_id = new.company_id
     and e.status = 'live'
     and new.reported_at >= e.starts_at
     and new.reported_at < e.ends_at
     and (
       e.scope_type = 'all'
       or (e.scope_type = 'plant' and e.plant_id = new.plant_id)
       or (e.scope_type = 'location' and e.location_id = new.location_id)
     )
   limit 1;

  if v_event_id is not null and v_team_id is not null then
    insert into public.eso_hunt_submissions(
      company_id, event_id, team_id, report_id, reporter_id, submitted_at
    ) values (
      new.company_id, v_event_id, v_team_id, new.id, new.reporter_id, new.reported_at
    ) on conflict (event_id, report_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.eso_hunt_capture_submission_v624() from public, anon, authenticated;

create index if not exists eso_hunt_event_teams_event_fk_idx on public.eso_hunt_event_teams(company_id, fiscal_year, event_id);
create index if not exists eso_hunt_event_teams_team_fk_idx on public.eso_hunt_event_teams(company_id, fiscal_year, team_id);
create index if not exists eso_hunt_events_plant_fk_idx on public.eso_hunt_events(company_id, plant_id);
create index if not exists eso_hunt_events_location_fk_idx on public.eso_hunt_events(company_id, plant_id, location_id);
create index if not exists eso_hunt_events_created_by_idx on public.eso_hunt_events(created_by);
create index if not exists eso_hunt_events_moderator_idx on public.eso_hunt_events(moderator_id);
create index if not exists eso_hunt_events_finalized_by_idx on public.eso_hunt_events(finalized_by);
create index if not exists eso_hunt_submissions_event_fk_idx on public.eso_hunt_submissions(company_id, event_id);
create index if not exists eso_hunt_submissions_event_team_fk_idx on public.eso_hunt_submissions(company_id, event_id, team_id);
create index if not exists eso_hunt_submissions_duplicate_idx on public.eso_hunt_submissions(duplicate_of);
create index if not exists eso_hunt_submissions_report_idx2 on public.eso_hunt_submissions(report_id);
create index if not exists eso_hunt_submissions_reporter_idx on public.eso_hunt_submissions(reporter_id);
create index if not exists eso_hunt_submissions_reviewer_idx on public.eso_hunt_submissions(reviewed_by);
create index if not exists eso_hunt_members_assigned_by_idx on public.eso_hunt_team_members(assigned_by);
create index if not exists eso_hunt_members_user_idx on public.eso_hunt_team_members(user_id);
create index if not exists eso_hunt_teams_created_by_idx on public.eso_hunt_teams(created_by);

notify pgrst, 'reload schema';
commit;
