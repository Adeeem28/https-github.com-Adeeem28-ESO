import { NextResponse } from 'next/server';
import { db, sessionUser, roleName, canAdmin, canMaintain, canViewAll } from '@/lib/server';

const TZ='Europe/Sarajevo';
function localParts(value:Date|string){
  const d=value instanceof Date?value:new Date(value);
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const get=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);
  return {year:get('year'),month:get('month'),day:get('day')};
}
function monthKey(value:Date|string){const p=localParts(value);return `${p.year}-${String(p.month).padStart(2,'0')}`}

export async function GET() {
  const me:any = await sessionUser();
  if (!me) return NextResponse.json({error:'Unauthorized'},{status:401});

  const [{data:deps},{data:locs},{data:emps}] = await Promise.all([
    db.from('departments').select('*').eq('company_id',me.company_id).order('name'),
    db.from('locations').select('id,name,active,department_id,departments(name)').eq('company_id',me.company_id).order('name'),
    db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,department_id,departments(name)').eq('company_id',me.company_id).order('last_name')
  ]);

  const nowParts=localParts(new Date());
  const year=nowParts.year;
  // Broad UTC range, then exact Europe/Sarajevo calendar-year filtering below.
  const broadStart=`${year-1}-12-31T21:00:00.000Z`;
  const broadEnd=`${year+1}-01-02T02:00:00.000Z`;
  const [{data:trackingReports,error:trackingReportError},{data:completedTasks,error:taskTrackingError}] = await Promise.all([
    db.from('eso_reports').select('id,reporter_id,reported_at,completed_at,status').eq('company_id',me.company_id).gte('reported_at',broadStart).lt('reported_at',broadEnd),
    db.from('maintenance_tasks').select('eso_report_id,assigned_to,completed_by,completed_at,status').eq('company_id',me.company_id).eq('status','completed')
  ]);
  if(trackingReportError) return NextResponse.json({error:trackingReportError.message},{status:400});
  if(taskTrackingError) return NextResponse.json({error:taskTrackingError.message},{status:400});

  let q:any = db.from('eso_reports')
    .select('*,locations(name),eso_attachments(id,storage_path,file_name,mime_type,attachment_type,created_at),maintenance_tasks(assigned_to,status,completed_by,completed_at,completion_note),corrective_actions(action_text,created_at)')
    .eq('company_id',me.company_id).order('reported_at',{ascending:false});

  if (me.role === 'employee') q = q.eq('reporter_id',me.id);

  const {data:allReports,error:reportError} = await q;
  const reports=(me.role==='maintenance'||me.role==='supervisor')?(allReports||[]).filter((r:any)=>{
    const task=Array.isArray(r.maintenance_tasks)?r.maintenance_tasks[0]:r.maintenance_tasks;
    return r.reporter_id===me.id||task?.assigned_to===me.id;
  }):allReports;
  if(reportError) return NextResponse.json({error:reportError.message},{status:400});

  const users = (emps||[]).map((e:any)=>({
    id:e.id,employeeId:e.employee_no,name:`${e.first_name} ${e.last_name}`.trim(),department:e.departments?.name||'Unassigned',role:roleName(e.role),annualTarget:e.annual_eso_target,active:e.active
  }));
  const userById=new Map(users.map((u:any)=>[u.id,u]));

  const mapped = await Promise.all((reports||[]).map(async (r:any) => {
    const attachments=(r.eso_attachments||[]).slice().sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)));
    const reportAttachment=attachments.find((a:any)=>a.attachment_type==='report')||attachments.find((a:any)=>!a.attachment_type);
    const completionAttachment=[...attachments].reverse().find((a:any)=>a.attachment_type==='completion');
    const signed=async(a:any)=>{if(!a)return undefined;const {data}=await db.storage.from('eso-attachments').createSignedUrl(a.storage_path,3600);return data?.signedUrl};
    const [imageData,completionImageData]=await Promise.all([signed(reportAttachment),signed(completionAttachment)]);
    const ca=(r.corrective_actions||[]).slice().sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at))).at(-1);
    const task=Array.isArray(r.maintenance_tasks)?r.maintenance_tasks[0]:r.maintenance_tasks;
    return {
      id:r.id,esoNo:r.report_no,reporterId:r.reporter_id,createdAt:r.reported_at,location:r.locations?.name||'Unknown',
      category:r.category==='environmental'?'Environmental':'Safety',urgency:r.urgency[0].toUpperCase()+r.urgency.slice(1),description:r.description,
      imageData,imageName:reportAttachment?.file_name,completionImageData,completionImageName:completionAttachment?.file_name,
      status:r.status==='completed'||r.status==='closed'?'Completed':r.status==='in_progress'||r.status==='assigned'||r.status==='waiting'?'In Progress':'Open',
      assignedTo:task?.assigned_to||undefined,assignedToName:task?.assigned_to?(userById.get(task.assigned_to) as any)?.name:undefined,assignedToRole:task?.assigned_to?(userById.get(task.assigned_to) as any)?.role:undefined,
      resolvedBy:task?.completed_by||((task?.status==='completed')?task?.assigned_to:undefined),resolvedByName:(task?.completed_by||((task?.status==='completed')?task?.assigned_to:null))?(userById.get(task?.completed_by||task?.assigned_to) as any)?.name:undefined,resolvedByRole:(task?.completed_by||((task?.status==='completed')?task?.assigned_to:null))?(userById.get(task?.completed_by||task?.assigned_to) as any)?.role:undefined,taskStatus:task?.status||undefined,
      correctiveAction:ca?.action_text||task?.completion_note||undefined,completedAt:r.completed_at||task?.completed_at
    };
  }));

  // Global YTD reporter leaderboard, independent of what the logged-in role may view in the reports list.
  const leaderCounts=new Map<string,number>();
  for(const row of trackingReports||[]){
    if(!row.reported_at||localParts(row.reported_at).year!==year) continue;
    leaderCounts.set(row.reporter_id,(leaderCounts.get(row.reporter_id)||0)+1);
  }
  const globalTop=users.filter((u:any)=>u.active).map((u:any)=>({id:u.id,name:u.name,employeeId:u.employeeId,count:leaderCounts.get(u.id)||0})).sort((a:any,b:any)=>b.count-a.count||a.name.localeCompare(b.name))[0]||null;

  // Calendar-month tracking: each bucket is 1st day of the month through (but not including) the 1st of the next month in Europe/Sarajevo.
  const labels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthly=labels.map((label,i)=>({month:i+1,label,reported:0,resolved:0}));
  for(const r of trackingReports||[]){
    if(r.reported_at){const p=localParts(r.reported_at);if(p.year===year) monthly[p.month-1].reported++;}
  }
  for(const t of completedTasks||[]){
    if(t.completed_at){const p=localParts(t.completed_at);if(p.year===year) monthly[p.month-1].resolved++;}
  }

  // Resolver leaderboard uses the person who actually completed the task. For legacy rows without completed_by,
  // assigned_to is used as a fallback only when that task is marked completed.
  const reportCompletionById=new Map((trackingReports||[]).map((r:any)=>[r.id,r.completed_at]));
  const resolverCounts=new Map<string,{ytd:number;month:number}>();
  for(const t of completedTasks||[]){
    const resolver=t.completed_by||t.assigned_to;
    const completedAt=t.completed_at||reportCompletionById.get(t.eso_report_id);
    if(!resolver||!completedAt) continue;
    const p=localParts(completedAt);
    if(p.year!==year) continue;
    const cur=resolverCounts.get(resolver)||{ytd:0,month:0};
    cur.ytd++;
    if(p.month===nowParts.month) cur.month++;
    resolverCounts.set(resolver,cur);
  }
  const reporterCounts=new Map<string,{ytd:number;month:number}>();
  for(const r of trackingReports||[]){
    if(!r.reporter_id||!r.reported_at) continue;
    const p=localParts(r.reported_at);
    if(p.year!==year) continue;
    const cur=reporterCounts.get(r.reporter_id)||{ytd:0,month:0};
    cur.ytd++;
    if(p.month===nowParts.month) cur.month++;
    reporterCounts.set(r.reporter_id,cur);
  }
  const reporterLeaderboard=Array.from(reporterCounts.entries()).map(([id,c])=>{
    const u:any=userById.get(id);
    return {id,name:u?.name||'Unknown user',employeeId:u?.employeeId||'',department:u?.department||'—',role:u?.role||'—',reportedYtd:c.ytd,reportedThisMonth:c.month};
  }).sort((a:any,b:any)=>b.reportedYtd-a.reportedYtd||b.reportedThisMonth-a.reportedThisMonth||a.name.localeCompare(b.name));

  const resolverLeaderboard=Array.from(resolverCounts.entries()).map(([id,c])=>{
    const u:any=userById.get(id);
    return {id,name:u?.name||'Unknown user',employeeId:u?.employeeId||'',department:u?.department||'—',role:u?.role||'—',resolvedYtd:c.ytd,resolvedThisMonth:c.month};
  }).sort((a:any,b:any)=>b.resolvedYtd-a.resolvedYtd||b.resolvedThisMonth-a.resolvedThisMonth||a.name.localeCompare(b.name));

  const current=users.find((u:any)=>u.id===me.id);
  const privilegedUsers=canAdmin(me.role)||canMaintain(me.role)||canViewAll(me.role);
  return NextResponse.json({
    currentUser:{...current,companyId:me.company_id,companyName:me.companies?.name||'',companyCode:me.companies?.code||''},
    users:privilegedUsers?users:[current],
    reports:mapped,
    topEmployeeYtd:globalTop,
    tracking:{year,currentMonth:nowParts.month,monthly,reporterLeaderboard,resolverLeaderboard},
    departments:(deps||[]).map((d:any)=>({id:d.id,name:d.name,code:d.code||null,active:d.active})),
    locations:(locs||[]).map((l:any)=>({id:l.id,name:l.name,active:l.active,departmentId:l.department_id,departmentName:l.departments?.name||null}))
  });
}
