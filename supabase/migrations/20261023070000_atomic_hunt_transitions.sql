-- Serialize event moderation with creation and report capture. No existing rows changed.
begin;
create function public.eso_transition_hunt_v627(p_actor uuid,p_event uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  actor public.employees%rowtype;
  event public.eso_hunt_events%rowtype;
  submission public.eso_hunt_submissions%rowtype;
  original_id uuid;
  result_status text := p_data->>'reviewStatus';
  stamp timestamptz;
begin
  select e.* into actor from public.employees e
    join public.companies c on c.id=e.company_id and c.active
    join public.plants p on p.id=e.plant_id and p.company_id=e.company_id and p.active
    where e.id=p_actor and e.active and e.role='super_admin' for share of e,c,p;
  if actor.id is null then raise exception 'Active Super Admin required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.company_id::text,626));
  select e.* into event from public.eso_hunt_events e where e.id=p_event and e.company_id=actor.company_id for update;
  if event.id is null then raise exception 'Hunt event not found' using errcode='P0002'; end if;
  stamp := clock_timestamp();
  if p_action='start' then
    if event.status<>'draft' then raise exception 'Only a draft event can be started'; end if;
    if event.fiscal_year<>(extract(year from stamp at time zone 'Europe/Sarajevo')::integer
      +case when extract(month from stamp at time zone 'Europe/Sarajevo')>=10 then 1 else 0 end) then
      raise exception 'Only a current fiscal year Hunt can be started';
    end if;
    if event.plant_id is not null and not exists(select 1 from public.plants p where p.id=event.plant_id and p.company_id=actor.company_id and p.active) then
      raise exception 'The Hunt plant is inactive';
    end if;
    if event.location_id is not null and not exists(select 1 from public.locations l where l.id=event.location_id and l.plant_id=event.plant_id and l.company_id=actor.company_id and l.active) then
      raise exception 'The Hunt location is inactive';
    end if;
    if exists(select 1 from public.eso_hunt_events e where e.company_id=actor.company_id and e.status='live') then
      raise exception 'Another ESO Hunt is already live';
    end if;
    if (select count(*) from public.eso_hunt_event_teams et where et.event_id=event.id)<2 then
      raise exception 'A Hunt needs at least two teams';
    end if;
    if exists(select 1 from public.eso_hunt_event_teams et join public.eso_hunt_teams t on t.id=et.team_id
      where et.event_id=event.id and (not t.active or not exists(
        select 1 from public.eso_hunt_team_members m join public.employees e on e.id=m.user_id
        join public.plants p on p.id=e.plant_id and p.company_id=e.company_id
        where m.team_id=t.id and m.company_id=actor.company_id and m.fiscal_year=event.fiscal_year
          and e.company_id=actor.company_id and e.active and p.active and e.role<>'super_admin'))) then
      raise exception 'Every team needs an active eligible member';
    end if;
    update public.eso_hunt_events set status='live',starts_at=stamp,ends_at=stamp+interval '1 hour',moderator_id=p_actor,updated_at=stamp where id=event.id;
    return jsonb_build_object('ok',true,'startsAt',stamp,'endsAt',stamp+interval '1 hour');
  elsif p_action='cancel' then
    if event.status<>'draft' then raise exception 'Only a draft event can be cancelled'; end if;
    update public.eso_hunt_events set status='cancelled',updated_at=stamp where id=event.id;
  elsif p_action in ('review','finalize') then
    if event.status='live' and event.ends_at<=stamp then
      update public.eso_hunt_events set status='review',review_locked_at=stamp,updated_at=stamp where id=event.id;
      event.status:='review';
    end if;
    if event.status<>'review' then raise exception 'Only a finished Hunt in review can be moderated'; end if;
    if p_action='review' then
      if result_status is null or result_status not in ('accepted','duplicate','not_eso') then raise exception 'Invalid review result'; end if;
      select s.* into submission from public.eso_hunt_submissions s
        where s.id=(p_data->>'submissionId')::uuid and s.event_id=event.id and s.company_id=actor.company_id for update;
      if submission.id is null then raise exception 'Hunt submission not found' using errcode='P0002'; end if;
      if result_status<>'accepted' and exists(select 1 from public.eso_hunt_submissions s where s.duplicate_of=submission.id) then
        raise exception 'Reassign duplicate submissions before changing their accepted original';
      end if;
      if result_status='duplicate' then
        original_id:=nullif(p_data->>'duplicateOf','')::uuid;
        if original_id is null or original_id=submission.id or not exists(select 1 from public.eso_hunt_submissions s
          where s.id=original_id and s.event_id=event.id and s.company_id=actor.company_id and s.review_status='accepted') then
          raise exception 'Duplicates must point to an accepted original in the same Hunt';
        end if;
      end if;
      update public.eso_hunt_submissions set review_status=result_status,duplicate_of=original_id,
        reviewed_by=p_actor,reviewed_at=stamp,review_note=left(btrim(coalesce(p_data->>'note','')),500) where id=submission.id;
    else
      if exists(select 1 from public.eso_hunt_submissions s where s.event_id=event.id and s.review_status='pending') then
        raise exception 'Review every Hunt submission before finalizing';
      end if;
      if exists(select 1 from public.eso_hunt_submissions s left join public.eso_hunt_submissions original on original.id=s.duplicate_of
        where s.event_id=event.id and s.review_status='duplicate' and
          (original.id is null or original.event_id<>event.id or original.review_status<>'accepted' or original.id=s.id)) then
        raise exception 'Correct invalid duplicate references before finalizing';
      end if;
      update public.eso_hunt_events set status='final',review_locked_at=coalesce(review_locked_at,stamp),
        finalized_at=stamp,finalized_by=p_actor,updated_at=stamp where id=event.id;
    end if;
  else raise exception 'Unknown ESO Hunt action';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.eso_transition_hunt_v627(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.eso_transition_hunt_v627(uuid,uuid,text,jsonb) to service_role;

-- A report insert must finish its Hunt association before a moderator finalizes.
-- Use the same company lock as creation/moderation before reading event status.
create or replace function public.eso_hunt_capture_submission_v624()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_event_id uuid; v_team_id uuid;
begin
  if new.reclassified_to_voe then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text,626));
  select e.id,t.id into v_event_id,v_team_id from public.eso_hunt_events e
    join public.eso_hunt_event_teams et on et.event_id=e.id and et.company_id=e.company_id
    join public.eso_hunt_team_members tm on tm.team_id=et.team_id and tm.company_id=e.company_id
      and tm.fiscal_year=e.fiscal_year and tm.user_id=new.reporter_id
    join public.eso_hunt_teams t on t.id=tm.team_id and t.company_id=e.company_id and t.fiscal_year=e.fiscal_year
    where e.company_id=new.company_id and e.status='live'
      and new.reported_at>=e.starts_at and new.reported_at<e.ends_at
      and (e.scope_type='all' or (e.scope_type='plant' and e.plant_id=new.plant_id)
        or (e.scope_type='location' and e.location_id=new.location_id)) limit 1;
  if v_event_id is not null then
    insert into public.eso_hunt_submissions(company_id,event_id,team_id,report_id,reporter_id,submitted_at)
      values(new.company_id,v_event_id,v_team_id,new.id,new.reporter_id,new.reported_at)
      on conflict(event_id,report_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.eso_hunt_capture_submission_v624() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
