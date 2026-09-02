import { NextResponse } from 'next/server';
import { db, sessionUser, roleName, canAdmin, canMaintain } from '@/lib/server';

export async function GET() {
  const me:any = await sessionUser();
  if (!me) return NextResponse.json({error:'Unauthorized'},{status:401});

  const [{data:deps},{data:locs},{data:emps}] = await Promise.all([
    db.from('departments').select('*').order('name'),
    db.from('locations').select('*').eq('active',true).order('name'),
    db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,department_id,departments(name)').order('last_name')
  ]);

  let q:any = db.from('eso_reports')
    .select('*,locations(name),eso_attachments(id,storage_path,file_name,mime_type,attachment_type,created_at),maintenance_tasks(assigned_to,status,completed_by,completion_note),corrective_actions(action_text,created_at)')
    .order('reported_at',{ascending:false});

  if (me.role === 'employee') q = q.eq('reporter_id',me.id);
  else if (me.role === 'maintenance' || me.role === 'supervisor') q = q.or(`reporter_id.eq.${me.id},maintenance_tasks.assigned_to.eq.${me.id}`);

  const {data:reports,error:reportError} = await q;
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
    return {
      id:r.id,esoNo:r.report_no,reporterId:r.reporter_id,createdAt:r.reported_at,location:r.locations?.name||'Unknown',
      category:r.category==='environmental'?'Environmental':'Safety',urgency:r.urgency[0].toUpperCase()+r.urgency.slice(1),description:r.description,
      imageData,imageName:reportAttachment?.file_name,completionImageData,completionImageName:completionAttachment?.file_name,
      status:r.status==='completed'||r.status==='closed'?'Completed':r.status==='in_progress'||r.status==='assigned'||r.status==='waiting'?'In Progress':'Open',
      assignedTo:r.maintenance_tasks?.[0]?.assigned_to||undefined,taskStatus:r.maintenance_tasks?.[0]?.status||undefined,correctiveAction:ca?.action_text||r.maintenance_tasks?.[0]?.completion_note||undefined,completedAt:r.completed_at
    };
  }));

  const current=users.find((u:any)=>u.id===me.id);
  return NextResponse.json({
    currentUser:current,
    users:canAdmin(me.role)||canMaintain(me.role)?users:[current],
    reports:mapped,
    departments:(deps||[]).map((d:any)=>({id:d.id,name:d.name,active:d.active})),
    locations:(locs||[]).map((l:any)=>({id:l.id,name:l.name}))
  });
}
