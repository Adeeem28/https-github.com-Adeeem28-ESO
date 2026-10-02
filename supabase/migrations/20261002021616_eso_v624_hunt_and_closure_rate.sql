-- ESO V6.2.4: ESO HUNT event statistics.
-- Hunt is an append-only association layer around the existing ESO workflow.
-- The normal ESO report is never copied, moved or hidden from the main app.
begin;

create table public.eso_hunt_teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  fiscal_year integer not null check (fiscal_year between 2000 and 9999),
  name text not null check (length(btrim(name)) between 1 and 80),
  color_key text not null check (color_key ~ '^[a-z0-9_-]{2,32}$'),
  active boolean not null default true,
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  unique (company_id, fiscal_year, id),
  unique (company_id, id),
  unique (company_id, fiscal_year, color_key)
);

create table public.eso_hunt_team_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  fiscal_year integer not null,
  team_id uuid not null,
  user_id uuid not null references public.employees(id),
  assigned_by uuid not null references public.employees(id),
  assigned_at timestamptz not null default now(),
  unique (company_id, fiscal_year, user_id),
  unique (team_id, user_id),
  foreign key (company_id, fiscal_year, team_id)
    references public.eso_hunt_teams(company_id, fiscal_year, id),
  foreign key (user_id) references public.employees(id)
);

create table public.eso_hunt_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  fiscal_year integer not null check (fiscal_year between 2000 and 9999),
  title text not null check (length(btrim(title)) between 1 and 120),
  scope_type text not null default 'all' check (scope_type in ('all','plant','location')),
  plant_id uuid,
  location_id uuid,
  status text not null default 'draft' check (status in ('draft','live','review','final','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.employees(id),
  moderator_id uuid references public.employees(id),
  review_locked_at timestamptz,
  finalized_at timestamptz,
  finalized_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, fiscal_year, id),
  unique (company_id, id),
  foreign key (company_id, plant_id) references public.plants(company_id, id),
  foreign key (company_id, plant_id, location_id) references public.locations(company_id, plant_id, id),
  check ((scope_type = 'all' and plant_id is null and location_id is null)
      or (scope_type = 'plant' and plant_id is not null and location_id is null)
      or (scope_type = 'location' and plant_id is not null and location_id is not null)),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);

create table public.eso_hunt_event_teams (
  event_id uuid not null,
  company_id uuid not null,
  fiscal_year integer not null,
  team_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (event_id, team_id),
  unique (company_id, event_id, team_id),
  foreign key (company_id, fiscal_year, event_id)
    references public.eso_hunt_events(company_id, fiscal_year, id),
  foreign key (company_id, fiscal_year, team_id)
    references public.eso_hunt_teams(company_id, fiscal_year, id)
);

create table public.eso_hunt_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  event_id uuid not null,
  team_id uuid not null,
  report_id uuid not null references public.eso_reports(id),
  reporter_id uuid not null references public.employees(id),
  submitted_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending','accepted','duplicate','not_eso')),
  duplicate_of uuid references public.eso_hunt_submissions(id),
  reviewed_by uuid references public.employees(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  unique (event_id, report_id),
  foreign key (company_id, event_id) references public.eso_hunt_events(company_id, id),
  foreign key (company_id, event_id, team_id) references public.eso_hunt_event_teams(company_id, event_id, team_id),
  foreign key (reporter_id) references public.employees(id)
);

create index eso_hunt_teams_season_idx on public.eso_hunt_teams(company_id, fiscal_year, active, name);
create unique index eso_hunt_teams_name_season_idx on public.eso_hunt_teams(company_id, fiscal_year, lower(name));
create index eso_hunt_members_team_idx on public.eso_hunt_team_members(company_id, fiscal_year, team_id, user_id);
create index eso_hunt_events_status_idx on public.eso_hunt_events(company_id, fiscal_year, status, starts_at desc);
create index eso_hunt_submissions_event_idx on public.eso_hunt_submissions(event_id, team_id, review_status, submitted_at);
create index eso_hunt_submissions_report_idx on public.eso_hunt_submissions(company_id, report_id);
create unique index eso_hunt_one_live_per_company_idx on public.eso_hunt_events(company_id) where status = 'live';

-- The event snapshot is fixed once a Hunt starts. Team membership can be prepared
-- in draft, but the API refuses membership changes while an event is running.
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
drop trigger if exists eso_hunt_capture_submission_v624 on public.eso_reports;
create trigger eso_hunt_capture_submission_v624
  after insert on public.eso_reports
  for each row execute function public.eso_hunt_capture_submission_v624();

alter table public.eso_hunt_teams enable row level security;
alter table public.eso_hunt_team_members enable row level security;
alter table public.eso_hunt_events enable row level security;
alter table public.eso_hunt_event_teams enable row level security;
alter table public.eso_hunt_submissions enable row level security;

revoke all on public.eso_hunt_teams, public.eso_hunt_team_members, public.eso_hunt_events,
  public.eso_hunt_event_teams, public.eso_hunt_submissions from public, anon, authenticated;
grant all on public.eso_hunt_teams, public.eso_hunt_team_members, public.eso_hunt_events,
  public.eso_hunt_event_teams, public.eso_hunt_submissions to service_role;

notify pgrst, 'reload schema';
commit;
