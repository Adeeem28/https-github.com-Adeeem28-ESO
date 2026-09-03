import { NextResponse } from 'next/server';
import { db, sessionUser, roleName, canAdmin, canMaintain, canViewAll } from '@/lib/server';

export async function GET() {
  const me:any = await sessionUser();
  if (!me) return NextResponse.json({error:'Unauthorized'},{status:401});

  const [{data:deps},{data:locs},{data:emps}] = await Promise.all([
    db.from('departments').select('*').order('name'),
    db.from('locations').select('id,name,active,department_id,departments(name)').order('name'),
    db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,department_id,departments(name)').order('last_name')
  ]);

  const yearStart = new Date(new Date().getFullYear(),0,1).toISOString();
  const [{data:leaderRows,error:leaderError}] = await Promise.all([
    db.from('eso_reports').select('reporter_id,reported_at').gte('reported_at',yearStart)
  ]);
  if(leaderError) return NextResponse.json({error:leaderError.message},{status:400});

  let q:any = db.from('eso_reports')
    .select('*,locations(name),eso_attachments(id,storage_path,file_name,mime_type,attachment_type,created_at),maintenance_tasks(assigned_to,status,completed_by,completion_note),corrective_actions(action_text,created_at)')
    .order('reported_at',{ascending:false});

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
      assignedTo:task?.assigned_to||undefined,taskStatus:task?.status||undefined,correctiveAction:ca?.action_text||task?.completion_note||undefined,completedAt:r.completed_at
    };
  }));

  const current=users.find((u:any)=>u.id===me.id);
  const leaderCounts=new Map<string,number>();
  for(const row of leaderRows||[]) leaderCounts.set(row.reporter_id,(leaderCounts.get(row.reporter_id)||0)+1);
  const globalTop=users.filter((u:any)=>u.active).map((u:any)=>({id:u.id,name:u.name,employeeId:u.employeeId,count:leaderCounts.get(u.id)||0})).sort((a:any,b:any)=>b.count-a.count||a.name.localeCompare(b.name))[0]||null;
  const privilegedUsers=canAdmin(me.role)||canMaintain(me.role)||canViewAll(me.role);
  return NextResponse.json({
    currentUser:current,
    users:privilegedUsers?users:[current],
    reports:mapped,
    topEmployeeYtd:globalTop,
    departments:(deps||[]).map((d:any)=>({id:d.id,name:d.name,code:d.code||null,active:d.active})),
    locations:(locs||[]).map((l:any)=>({id:l.id,name:l.name,active:l.active,departmentId:l.department_id,departmentName:l.departments?.name||null}))
  });
}
