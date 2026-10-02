import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db, isSuperAdmin, sessionUser } from '@/lib/server';
import { fiscalYearInfo } from '@/lib/fiscal-year';

const COLORS = new Set(['blue','green','yellow','red','purple','orange','teal','pink','black']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_SELECT = 'id,company_id,fiscal_year,title,scope_type,plant_id,location_id,status,starts_at,ends_at,created_by,moderator_id,review_locked_at,finalized_at,finalized_by,created_at,updated_at';

function fail(message:string,status=400){return NextResponse.json({error:message},{status});}
function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function sameIds(values:string[]){return new Set(values).size===values.length;}

async function loadRows(me:any,year:number){
 const [{data:events,error:eventError},{data:teams,error:teamError},{data:members,error:memberError}]=await Promise.all([
  db.from('eso_hunt_events').select(EVENT_SELECT).eq('company_id',me.company_id).eq('fiscal_year',year).order('created_at',{ascending:false}),
  db.from('eso_hunt_teams').select('id,company_id,fiscal_year,name,color_key,active,created_at').eq('company_id',me.company_id).eq('fiscal_year',year).eq('active',true).order('name'),
  db.from('eso_hunt_team_members').select('id,company_id,fiscal_year,team_id,user_id,assigned_at').eq('company_id',me.company_id).eq('fiscal_year',year).order('assigned_at')
 ]);
 if(eventError||teamError||memberError)throw new Error(eventError?.message||teamError?.message||memberError?.message||'Could not load ESO Hunt.');
 let eventList:any[]=events||[];
 const now=Date.now();
 for(const event of eventList){
  if(event.status==='live'&&event.ends_at&&new Date(event.ends_at).getTime()<=now){
   const {error}=await db.from('eso_hunt_events').update({status:'review',review_locked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',event.id).eq('company_id',me.company_id).eq('status','live');
   if(!error){event.status='review';event.review_locked_at=event.review_locked_at||new Date().toISOString();}
  }
 }
 const eventIds=eventList.map(x=>x.id);
 const [{data:eventTeams,error:eventTeamError},{data:submissions,error:submissionError}]=await Promise.all([
  eventIds.length?db.from('eso_hunt_event_teams').select('event_id,company_id,fiscal_year,team_id,added_at').eq('company_id',me.company_id).in('event_id',eventIds):Promise.resolve({data:[],error:null} as any),
  eventIds.length?db.from('eso_hunt_submissions').select('id,company_id,event_id,team_id,report_id,reporter_id,submitted_at,review_status,duplicate_of,reviewed_by,reviewed_at,review_note').eq('company_id',me.company_id).in('event_id',eventIds).order('submitted_at') :Promise.resolve({data:[],error:null} as any)
 ]);
 if(eventTeamError||submissionError)throw new Error(eventTeamError?.message||submissionError?.message||'Could not load Hunt statistics.');
 const submissionRows:any[]=submissions||[];
 const reportIds=Array.from(new Set(submissionRows.map(x=>x.report_id).filter(Boolean)));
 const reporterIds=Array.from(new Set([...((members||[]).map((x:any)=>x.user_id)),...submissionRows.map(x=>x.reporter_id)].filter(Boolean)));
 const [{data:reports,error:reportError},{data:employees,error:employeeError}]=await Promise.all([
  reportIds.length?db.from('eso_reports').select('id,report_no,reported_at,location_id,description,category,urgency,status,plant_id').in('id',reportIds):Promise.resolve({data:[],error:null} as any),
  reporterIds.length?db.from('employees').select('id,employee_no,first_name,last_name,role,department_id,plant_id,active').eq('company_id',me.company_id).in('id',reporterIds):Promise.resolve({data:[],error:null} as any)
 ]);
 if(reportError||employeeError)throw new Error(reportError?.message||employeeError?.message||'Could not load Hunt participants.');
 const employeeMap=new Map((employees||[]).map((x:any)=>[x.id,{id:x.id,employeeId:x.employee_no,name:`${x.first_name||''} ${x.last_name||''}`.trim(),role:x.role,plantId:x.plant_id,active:x.active}]));
 const reportMap=new Map((reports||[]).map((x:any)=>[x.id,x]));
 const eventMap=new Map(eventList.map(x=>[x.id,x]));
 const teamMap=new Map((teams||[]).map((x:any)=>[x.id,x]));
 const memberships=(members||[]).map((m:any)=>({...m,user:employeeMap.get(m.user_id)||null}));
 const links=(eventTeams||[]) as any[];
 const byEvent=new Map<string,any[]>();for(const link of links)byEvent.set(link.event_id,[...(byEvent.get(link.event_id)||[]),link]);
 const byEventTeam=new Map<string,any[]>();for(const s of submissionRows)byEventTeam.set(`${s.event_id}:${s.team_id}`,[...(byEventTeam.get(`${s.event_id}:${s.team_id}`)||[]),s]);
 const validForCount=(submission:any,event:any)=>event?.status==='final'?submission.review_status==='accepted':submission.review_status!=='duplicate'&&submission.review_status!=='not_eso';
 const eventLeaderboard=(event:any)=> (byEvent.get(event.id)||[]).map((link:any)=>{
  const team=teamMap.get(link.team_id),rows=byEventTeam.get(`${event.id}:${link.team_id}`)||[],accepted=rows.filter(x=>x.review_status==='accepted').length,excluded=rows.filter(x=>x.review_status==='duplicate'||x.review_status==='not_eso').length;
  return {teamId:link.team_id,name:team?.name||'Unknown team',colorKey:team?.color_key||'blue',members:memberships.filter(x=>x.team_id===link.team_id).map(x=>x.user).filter(Boolean),memberCount:memberships.filter(x=>x.team_id===link.team_id).length,submissions:rows.filter(x=>validForCount(x,event)).length,accepted,excluded};
 }).sort((a:any,b:any)=>b.submissions-a.submissions||a.name.localeCompare(b.name));
 const annualMap=new Map<string,any>();
 for(const event of eventList){for(const row of eventLeaderboard(event)){const key=row.teamId,prev=annualMap.get(key)||{teamId:key,name:row.name,colorKey:row.colorKey,events:0,submissions:0,accepted:0};prev.events++;prev.submissions+=row.submissions;prev.accepted+=row.accepted;annualMap.set(key,prev)}}
 const latest=eventList.find(x=>x.status==='live')||eventList.find(x=>x.status==='draft')||eventList[0]||null;
 const latestLinks=latest?byEvent.get(latest.id)||[]:[];
 const ownMembership=latest?memberships.find(x=>latestLinks.some((l:any)=>l.team_id===x.team_id)&&x.user_id===me.id):null;
 const ownTeamId=ownMembership?.team_id||null;
 const allowedTeamIds=new Set(isSuperAdmin(me.role)?latestLinks.map((x:any)=>x.team_id):(ownTeamId?[ownTeamId]:[]));
 const visibleSubmissions=latest?submissionRows.filter(x=>x.event_id===latest.id&&(isSuperAdmin(me.role)||allowedTeamIds.has(x.team_id))).map(x=>({...x,report:reportMap.get(x.report_id)||null,reporter:employeeMap.get(x.reporter_id)||null,reviewer:employeeMap.get(x.reviewed_by)||null})):[];
 const visibleTeams=latest?eventLeaderboard(latest).filter((x:any)=>isSuperAdmin(me.role)||x.teamId===ownTeamId).map((x:any)=>({...x,members:isSuperAdmin(me.role)||x.teamId===ownTeamId?x.members:[]})):[];
 const publicEvents=eventList.map(event=>({id:event.id,title:event.title,status:event.status,startsAt:event.starts_at,endsAt:event.ends_at,createdAt:event.created_at,finalizedAt:event.finalized_at,scopeType:event.scope_type,plantId:event.plant_id,locationId:event.location_id}));
 const leaderboard=latest?eventLeaderboard(latest):[];const publicLeaderboard=isSuperAdmin(me.role)?leaderboard:leaderboard.map(({members,...team}:any)=>({...team,members:[]}));
 return {year,events:publicEvents,event:latest?{...latest,startsAt:latest.starts_at,endsAt:latest.ends_at,scopeType:latest.scope_type,plantId:latest.plant_id,locationId:latest.location_id}:null,teams:visibleTeams,leaderboard:publicLeaderboard,annualLeaderboard:Array.from(annualMap.values()).sort((a,b)=>b.submissions-a.submissions||a.name.localeCompare(b.name)),submissions:visibleSubmissions,ownTeamId,moderatorId:latest?.moderator_id||null,isModerator:isSuperAdmin(me.role)};
}

export async function GET(){
 const me:any=await sessionUser();if(!me)return fail('Unauthorized',401);
 try{return NextResponse.json(await loadRows(me,fiscalYearInfo().year));}catch(error:any){console.error('ESO Hunt load failed',error);return fail('ESO Hunt is not available yet. Apply the V6.2.4 database migration.',503)}
}

async function requireModerator(){
 const me:any=await sessionUser();
 if(!me)return {error:fail('Unauthorized',401)};
 if(!isSuperAdmin(me.role))return {error:fail('Only a Super Admin can moderate ESO Hunt.',403)};
 return {me};
}

export async function POST(request:Request){
 const auth=await requireModerator();if(auth.error)return auth.error;const me:any=auth.me;
 let body:any;try{body=await request.json()}catch{return fail('Invalid request body.')}
 const action=clean(body?.action,32);const fy=fiscalYearInfo().year;
 try{
  if(action==='create'){
   const title=clean(body.title,120),scopeType=clean(body.scopeType,16)||'all',plantId=clean(body.plantId,80)||null,locationId=clean(body.locationId,80)||null;
   if(!title)return fail('Enter an event name.');
   if(!['all','plant','location'].includes(scopeType))return fail('Choose a valid event scope.');
   if(scopeType==='all'&&(plantId||locationId))return fail('An all-company Hunt cannot have a plant or location.');
   if(scopeType!=='all'&&!UUID.test(plantId||''))return fail('Choose a valid plant.');
   if(scopeType==='location'&&!UUID.test(locationId||''))return fail('Choose a valid location.');
   if(scopeType==='plant'||scopeType==='location'){
    const{data:plant}=await db.from('plants').select('id').eq('id',plantId).eq('company_id',me.company_id).eq('active',true).maybeSingle();if(!plant)return fail('The selected plant is not in your company.');
   }
   if(scopeType==='location'){
    const{data:location}=await db.from('locations').select('id').eq('id',locationId).eq('company_id',me.company_id).eq('plant_id',plantId).eq('active',true).maybeSingle();if(!location)return fail('The selected location is not in your company.');
   }
   const{data:live}=await db.from('eso_hunt_events').select('id').eq('company_id',me.company_id).eq('status','live').maybeSingle();if(live)return fail('Finish the active ESO Hunt before creating another event.',409);
   const rawTeams=Array.isArray(body.teams)?body.teams:[];if(rawTeams.length<2||rawTeams.length>20)return fail('Create between 2 and 20 teams.');
   const seenUsers:string[]=[];const seenColors=new Set<string>();
   for(const raw of rawTeams){const name=clean(raw?.name,80),color=clean(raw?.colorKey,32).toLowerCase(),ids:Array<string>=Array.isArray(raw?.memberIds)?raw.memberIds.filter((x:any):x is string=>typeof x==='string'):[];if(!name||!COLORS.has(color))return fail('Every team needs a name and a supported color.');if(seenColors.has(color))return fail('Each team must have a different color.');seenColors.add(color);if(!ids.length)return fail('Every team needs at least one member.');if(!sameIds(ids)||ids.some((x:string)=>!UUID.test(x)))return fail('Team members are invalid.');seenUsers.push(...ids)}
   if(!sameIds(seenUsers))return fail('A user can belong to only one ESO Hunt team.');
   const{data:people,error:peopleError}=await db.from('employees').select('id,company_id,plant_id,active,role').eq('company_id',me.company_id).in('id',seenUsers);if(peopleError)return fail('Could not verify team members.',503);if((people||[]).length!==seenUsers.length||people.some((x:any)=>!x.active||x.role==='super_admin'))return fail('Teams may include only active non-moderator employees.');
   const eventId=randomUUID();const{error:eventError}=await db.from('eso_hunt_events').insert({id:eventId,company_id:me.company_id,fiscal_year:fy,title,scope_type:scopeType,plant_id:plantId,location_id:locationId,status:'draft',created_by:me.id});if(eventError)return fail('Could not create the Hunt event.',503);
   const createdTeamIds:string[]=[];
   try{
    for(const raw of rawTeams){const name=clean(raw.name,80),color=clean(raw.colorKey,32).toLowerCase(),teamId=UUID.test(raw.id||'')?raw.id:randomUUID();if(raw.id){const{data:existing}=await db.from('eso_hunt_teams').select('id,name,color_key').eq('id',teamId).eq('company_id',me.company_id).eq('fiscal_year',fy).eq('active',true).maybeSingle();if(!existing)throw new Error('One selected team is not available for this fiscal year.');if(existing.color_key!==color||existing.name!==name)throw new Error('Existing team names and colors cannot be changed here.');}else{const{error}=await db.from('eso_hunt_teams').insert({id:teamId,company_id:me.company_id,fiscal_year:fy,name,color_key:color,created_by:me.id});if(error)throw new Error('Team name or color is already in use.');createdTeamIds.push(teamId)}
     const ids:Array<string>=Array.isArray(raw.memberIds)?raw.memberIds:[];
     const{data:existingMembers}=await db.from('eso_hunt_team_members').select('user_id,team_id').eq('company_id',me.company_id).eq('fiscal_year',fy).in('user_id',ids);
     if((existingMembers||[]).some((x:any)=>x.team_id!==teamId))throw new Error('A selected user is already assigned to another team.');
     const missing=ids.filter(id=>!(existingMembers||[]).some((x:any)=>x.user_id===id&&x.team_id===teamId));
     if(missing.length){const{error}=await db.from('eso_hunt_team_members').insert(missing.map(userId=>({company_id:me.company_id,fiscal_year:fy,team_id:teamId,user_id:userId,assigned_by:me.id})));if(error)throw new Error('Could not save team membership.');}
     const{error:linkError}=await db.from('eso_hunt_event_teams').insert({event_id:eventId,company_id:me.company_id,fiscal_year:fy,team_id:teamId});if(linkError)throw new Error('Could not link a team to the event.');
    }
   }catch(error:any){await db.from('eso_hunt_event_teams').delete().eq('event_id',eventId);await db.from('eso_hunt_events').delete().eq('id',eventId);if(createdTeamIds.length)await db.from('eso_hunt_team_members').delete().in('team_id',createdTeamIds);for(const id of createdTeamIds)await db.from('eso_hunt_teams').delete().eq('id',id);return fail(error?.message||'Could not create the Hunt event.',400)}
   return NextResponse.json({ok:true,eventId});
  }
  if(!UUID.test(body?.eventId||''))return fail('Choose a valid Hunt event.');
  const{data:event,error:eventError}=await db.from('eso_hunt_events').select(EVENT_SELECT).eq('id',body.eventId).eq('company_id',me.company_id).maybeSingle();if(eventError)return fail('Could not load the Hunt event.',503);if(!event)return fail('Hunt event not found.',404);
  if(action==='start'){
   if(event.status!=='draft')return fail('Only a draft event can be started.');
   const{data:links,error:linkError}=await db.from('eso_hunt_event_teams').select('team_id').eq('event_id',event.id).eq('company_id',me.company_id);if(linkError)return fail('Could not verify the teams.',503);if((links||[]).length<2)return fail('A Hunt needs at least two teams.');
   const teamIds=(links||[]).map((x:any)=>x.team_id);const{data:members}=await db.from('eso_hunt_team_members').select('team_id').eq('company_id',me.company_id).eq('fiscal_year',fy).in('team_id',teamIds);if(new Set((members||[]).map((x:any)=>x.team_id)).size!==teamIds.length)return fail('Every team needs at least one member.');
   const{data:live}=await db.from('eso_hunt_events').select('id').eq('company_id',me.company_id).eq('status','live').maybeSingle();if(live)return fail('Another ESO Hunt is already live.',409);
   const startsAt=new Date(),endsAt=new Date(startsAt.getTime()+60*60*1000);const{error}=await db.from('eso_hunt_events').update({status:'live',starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),moderator_id:me.id,updated_at:startsAt.toISOString()}).eq('id',event.id).eq('status','draft');if(error)return fail('Could not start ESO Hunt.',503);return NextResponse.json({ok:true,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()});
  }
  if(action==='cancel'){
   if(event.status!=='draft')return fail('Only a draft event can be cancelled.');const{error}=await db.from('eso_hunt_events').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',event.id).eq('status','draft');if(error)return fail('Could not cancel the Hunt.',503);return NextResponse.json({ok:true});
  }
  if(action==='review'){
   const submissionId=body.submissionId;if(!UUID.test(submissionId||''))return fail('Choose a valid Hunt submission.');const status=clean(body.reviewStatus,20);if(!['accepted','duplicate','not_eso'].includes(status))return fail('Choose a valid review result.');
   if(event.status==='live'){if(!event.ends_at||new Date(event.ends_at).getTime()>Date.now())return fail('The 60-minute Hunt is still running.');await db.from('eso_hunt_events').update({status:'review',review_locked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',event.id).eq('status','live');event.status='review';}
   if(event.status!=='review')return fail('Only a Hunt in review can be moderated.');const{data:submission,error:submissionError}=await db.from('eso_hunt_submissions').select('id,event_id,report_id,review_status').eq('id',submissionId).eq('company_id',me.company_id).eq('event_id',event.id).maybeSingle();if(submissionError||!submission)return fail('Hunt submission not found.',404);
   let duplicateOf:null|string=null;if(status==='duplicate'){duplicateOf=body.duplicateOf;if(!UUID.test(duplicateOf||'')||duplicateOf===submissionId)return fail('Choose the accepted original submission.');const{data:original}=await db.from('eso_hunt_submissions').select('id,review_status').eq('id',duplicateOf).eq('company_id',me.company_id).eq('event_id',event.id).maybeSingle();if(!original||original.review_status!=='accepted')return fail('Duplicates must point to an accepted original submission.');}
   const{error}=await db.from('eso_hunt_submissions').update({review_status:status,duplicate_of:duplicateOf,reviewed_by:me.id,reviewed_at:new Date().toISOString(),review_note:clean(body.note,500)}).eq('id',submissionId).eq('event_id',event.id);if(error)return fail('Could not save the Hunt review.',503);return NextResponse.json({ok:true});
  }
  if(action==='finalize'){
   if(event.status==='live'){if(!event.ends_at||new Date(event.ends_at).getTime()>Date.now())return fail('The 60-minute Hunt is still running.');await db.from('eso_hunt_events').update({status:'review',review_locked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',event.id).eq('status','live');event.status='review';}
   if(event.status!=='review')return fail('Only a Hunt in review can be finalized.');const{data:pending}=await db.from('eso_hunt_submissions').select('id').eq('event_id',event.id).eq('review_status','pending').limit(1);if((pending||[]).length)return fail('Review every Hunt submission before finalizing.');const now=new Date().toISOString();const{error}=await db.from('eso_hunt_events').update({status:'final',review_locked_at:event.review_locked_at||now,finalized_at:now,finalized_by:me.id,updated_at:now}).eq('id',event.id).eq('status','review');if(error)return fail('Could not finalize the Hunt.',503);return NextResponse.json({ok:true});
  }
  return fail('Unknown ESO Hunt action.');
 }catch(error:any){console.error('ESO Hunt mutation failed',error);return fail('ESO Hunt is not available yet. Apply the V6.2.4 database migration.',503)}
}
