import { NextResponse } from 'next/server';
import { db, sessionUser, canMaintain, canAdmin, notify, notifyRoles, isSuperAdmin } from '@/lib/server';

async function getReport(me:any, reportId:string){
  let q:any=db.from('eso_reports').select('id,status,report_no,plant_id,reporter_id').eq('company_id',me.company_id).eq('id',reportId);
  if(!isSuperAdmin(me.role)) q=q.eq('plant_id',me.plant_id);
  return (await q.single()).data as any;
}
async function history(companyId:string,plantId:string,reportId:string,oldStatus:string|null,newStatus:string,meId:string,note?:string){
  await db.from('eso_status_history').insert({company_id:companyId,plant_id:plantId,eso_report_id:reportId,old_status:oldStatus,new_status:newStatus,changed_by:meId,note:note||null});
}
function normalizeDueAt(value:any){
  if(!value) return null;
  const d=new Date(String(value));
  if(Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(req:Request){
  const me:any=await sessionUser();
  if(!me||!canMaintain(me.role)) return NextResponse.json({error:'Forbidden'},{status:403});
  const ct=req.headers.get('content-type')||'';

  if(ct.includes('multipart/form-data')){
    const form=await req.formData(), reportId=String(form.get('reportId')||''), r=await getReport(me,reportId);
    if(!r) return NextResponse.json({error:'ESO not found in your plant'},{status:404});
    const correctiveAction=String(form.get('correctiveAction')||'').trim();
    if(String(form.get('action')||'')!=='complete'||!correctiveAction) return NextResponse.json({error:'Corrective action required'},{status:400});
    const {data:t}=await db.from('maintenance_tasks').select('id,assigned_to,status').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',reportId).maybeSingle();
    if(!canAdmin(me.role)&&t?.assigned_to!==me.id) return NextResponse.json({error:'This task is assigned to another user'},{status:403});
    const now=new Date().toISOString();
    const file=form.get('file');
    let uploaded:{path:string,fileName:string,mimeType:string}|null=null;
    if(file instanceof File&&file.size){
      if(!String(file.type||'').startsWith('image/')) return NextResponse.json({error:'Completion attachment must be an image.'},{status:400});
      if(file.size>4_200_000) return NextResponse.json({error:'Photo is too large. Please choose a smaller photo (max 4 MB).'},{status:413});
      const safeExt=(file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'),path=`${me.company_id}/${r.plant_id}/completion/${new Date().getFullYear()}/${reportId}/${crypto.randomUUID()}.${safeExt}`,buf=Buffer.from(await file.arrayBuffer()),up=await db.storage.from('eso-attachments').upload(path,buf,{contentType:file.type||'image/jpeg',upsert:false});
      if(up.error) return NextResponse.json({error:`Photo upload failed: ${up.error.message}`},{status:400});
      uploaded={path,fileName:file.name,mimeType:file.type||'image/jpeg'};
    }
    const {error:taskError}=await db.from('maintenance_tasks').upsert({company_id:me.company_id,plant_id:r.plant_id,eso_report_id:reportId,assigned_to:t?.assigned_to||me.id,status:'completed',completed_at:now,completed_by:me.id,completion_note:correctiveAction},{onConflict:'eso_report_id'});
    if(taskError){if(uploaded)await db.storage.from('eso-attachments').remove([uploaded.path]);return NextResponse.json({error:taskError.message},{status:400})}
    const {error:actionError}=await db.from('corrective_actions').insert({company_id:me.company_id,plant_id:r.plant_id,eso_report_id:reportId,maintenance_task_id:t?.id||null,action_text:correctiveAction,created_by:me.id});
    if(actionError)return NextResponse.json({error:actionError.message},{status:400});
    const {error:reportUpdateError}=await db.from('eso_reports').update({status:'completed',completed_at:now}).eq('id',reportId);
    if(reportUpdateError)return NextResponse.json({error:reportUpdateError.message},{status:400});
    if(uploaded){
      const {error:attachmentError}=await db.from('eso_attachments').insert({company_id:me.company_id,plant_id:r.plant_id,eso_report_id:reportId,storage_path:uploaded.path,file_name:uploaded.fileName,mime_type:uploaded.mimeType,uploaded_by:me.id,attachment_type:'completion'});
      if(attachmentError)return NextResponse.json({error:attachmentError.message},{status:400});
    }
    await history(me.company_id,r.plant_id,reportId,t?.status||null,'completed',me.id,correctiveAction);
    await notifyRoles(me.company_id,r.plant_id,['admin','super_admin','management'],'task_completed','ESO task completed',`${r.report_no||'ESO'} corrective action was completed.`,reportId);if(r.reporter_id&&r.reporter_id!==me.id)await notify(r.reporter_id,'eso_completed','Your ESO has been completed',`${r.report_no||'ESO'} corrective action is complete. Open it to review the result.`,reportId,t?.id);
    return NextResponse.json({ok:true});
  }

  const {reportId,action,assignedTo,dueAt}=await req.json(), r=await getReport(me,reportId);
  if(!r) return NextResponse.json({error:'ESO not found in your plant'},{status:404});

  if(action==='assign'){
    if(!canAdmin(me.role)) return NextResponse.json({error:'Only Admin or Super Admin can assign tasks'},{status:403});
    const normalizedDueAt=normalizeDueAt(dueAt);
    if(!normalizedDueAt) return NextResponse.json({error:'Due date is required'},{status:400});
    if(new Date(normalizedDueAt).getTime()<=Date.now()) return NextResponse.json({error:'Due date must be in the future'},{status:400});
    const {data:assignee}=await db.from('employees').select('id,role,active,plant_id').eq('company_id',me.company_id).eq('id',assignedTo).single();
    if(!assignee?.active||assignee.plant_id!==r.plant_id||!['maintenance','supervisor'].includes(assignee.role)) return NextResponse.json({error:'Select active Maintenance/Supervisor from the same plant'},{status:400});
    const now=new Date().toISOString(), {data:task,error}=await db.from('maintenance_tasks').upsert({company_id:me.company_id,plant_id:r.plant_id,eso_report_id:reportId,assigned_to:assignedTo,assigned_by:me.id,status:'assigned',assigned_at:now,due_at:normalizedDueAt,started_at:null,completed_at:null,completed_by:null,completion_note:null},{onConflict:'eso_report_id'}).select('id').single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    await db.from('eso_reports').update({status:'assigned'}).eq('id',reportId);
    await history(me.company_id,r.plant_id,reportId,r.status||null,'assigned',me.id,`Task assigned • due ${normalizedDueAt}`);
    await notify(assignedTo,'task_assigned','New ESO task assigned',`${r.report_no||'ESO'} has been assigned to you. Due ${new Date(normalizedDueAt).toLocaleDateString()}.`,reportId,task?.id);
  }else if(action==='take'){
    if(!isSuperAdmin(me.role)&&me.plant_id!==r.plant_id) return NextResponse.json({error:'Wrong plant'},{status:403});
    const now=new Date().toISOString();
    await db.from('maintenance_tasks').upsert({company_id:me.company_id,plant_id:r.plant_id,eso_report_id:reportId,assigned_to:me.id,assigned_by:me.id,status:'in_progress',assigned_at:now,started_at:now},{onConflict:'eso_report_id'});
    await db.from('eso_reports').update({status:'in_progress'}).eq('id',reportId);
    await history(me.company_id,r.plant_id,reportId,r.status||null,'in_progress',me.id,'Task taken');
  }else if(action==='start'){
    const {data:t}=await db.from('maintenance_tasks').select('assigned_to,status').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',reportId).single();
    if(!canAdmin(me.role)&&t?.assigned_to!==me.id) return NextResponse.json({error:'This task is assigned to another user'},{status:403});
    await db.from('maintenance_tasks').update({status:'in_progress',started_at:new Date().toISOString()}).eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',reportId);
    await db.from('eso_reports').update({status:'in_progress'}).eq('id',reportId);
    await history(me.company_id,r.plant_id,reportId,t?.status||null,'in_progress',me.id,'Task started');
    await notifyRoles(me.company_id,r.plant_id,['admin','super_admin'],'task_started','ESO task started','An assigned ESO task is now in progress.',reportId);
  }else return NextResponse.json({error:'Unknown action'},{status:400});
  return NextResponse.json({ok:true});
}
