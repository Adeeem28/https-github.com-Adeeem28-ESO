import { db, sessionUser, notify, notifyRoles } from './server';
import { canReadReport, canEditReport, canEditCompletion, canResolve, canonicalCategory, canonicalUrgency, MAX_PHOTOS, MAX_UPLOAD_BYTES } from './eso-policy';
import { NextResponse } from 'next/server';

export async function scopedReport(me:any, id:string) {
 let q=db.from('eso_reports').select('*,maintenance_tasks(*)').eq('company_id',me.company_id).eq('id',id);
 if(me.role!=='super_admin') q=q.eq('plant_id',me.plant_id);
 const {data,error}=await q.maybeSingle();
 if(error) throw new Error(error.message);
 return data&&canReadReport(me,data)?data:null;
}

async function legacyMutation(me:any,id:string,action:string,payload:any,photos:any[],removed:any[],r:any,plantId:string){
 if(action==='create'){
  const {data,error}=await db.from('eso_reports').insert({id,company_id:me.company_id,plant_id:plantId,reporter_id:me.id,location_id:payload.location_id,description:payload.description,category:payload.category,urgency:payload.urgency}).select('id,report_no').single();
  if(error)throw new Error(error.message);r=data;
 } else if(action==='edit'){
  const {data,error}=await db.from('eso_reports').update({location_id:payload.location_id,description:payload.description,category:payload.category,urgency:payload.urgency}).eq('id',id).eq('company_id',me.company_id).eq('plant_id',plantId).select('id,report_no').single();
  if(error)throw new Error(error.message);r=data;
  if(removed.length){const del=await db.from('eso_attachments').delete().in('id',removed).eq('eso_report_id',id);if(del.error)throw new Error(del.error.message);}
 } else if(action==='take'||action==='start'){
  const {error}=await db.from('maintenance_tasks').upsert({company_id:me.company_id,plant_id:plantId,eso_report_id:id,assigned_to:me.id,assigned_by:me.id,status:'in_progress',assigned_at:new Date().toISOString(),started_at:new Date().toISOString()},{onConflict:'eso_report_id'});
  if(error)throw new Error(error.message);
  const up=await db.from('eso_reports').update({status:'in_progress'}).eq('id',id).eq('company_id',me.company_id).eq('plant_id',plantId);if(up.error)throw new Error(up.error.message);r={id,report_no:r?.report_no};
 } else if(action==='assign'){
  const due=bodyDue(payload);const {error}=await db.from('maintenance_tasks').upsert({company_id:me.company_id,plant_id:plantId,eso_report_id:id,assigned_to:payload.assignedTo,assigned_by:me.id,status:'assigned',assigned_at:new Date().toISOString(),due_at:due},{onConflict:'eso_report_id'});if(error)throw new Error(error.message);const up=await db.from('eso_reports').update({status:'assigned'}).eq('id',id).eq('company_id',me.company_id).eq('plant_id',plantId);if(up.error)throw new Error(up.error.message);r={id,report_no:r?.report_no};
 } else if(action==='complete'||action==='edit_completion'){
  const now=new Date().toISOString();const note=String(payload.correctiveAction||'').trim();if(!note)throw new Error('Corrective action is required.');
  const {data:task,error}=await db.from('maintenance_tasks').upsert({company_id:me.company_id,plant_id:plantId,eso_report_id:id,assigned_to:r?.assigned_to||me.id,assigned_by:r?.assigned_by||me.id,status:'completed',assigned_at:r?.assigned_at||now,started_at:r?.started_at||now,completed_at:action==='complete'?now:r?.completed_at,completed_by:action==='complete'?me.id:r?.completed_by,completion_note:note},{onConflict:'eso_report_id'}).select('id').single();if(error)throw new Error(error.message);
  const up=await db.from('eso_reports').update({status:'completed',completed_at:action==='complete'?now:r?.completed_at}).eq('id',id).eq('company_id',me.company_id).eq('plant_id',plantId);if(up.error)throw new Error(up.error.message);
  const ca=await db.from('corrective_actions').insert({company_id:me.company_id,plant_id:plantId,eso_report_id:id,maintenance_task_id:task.id,action_text:note,created_by:me.id});if(ca.error)throw new Error(ca.error.message);r={id,report_no:r?.report_no};
 } else throw new Error('V6.2.1 migration is required for this action.');
 if(photos.length){const {error}=await db.from('eso_attachments').insert(photos.map((p:any)=>({...p,company_id:me.company_id,plant_id:plantId,eso_report_id:id,uploaded_by:me.id,attachment_type:'report'})));if(error)throw new Error(error.message);}
 return r;
}

function bodyDue(payload:any){const d=new Date(String(payload.dueAt||''));if(Number.isNaN(d.getTime())||d.getTime()<=Date.now())throw new Error('Choose a future due date.');return d.toISOString();}

// Storage objects stay private; only a successful transaction links them to a report.
export async function mutateReport(req:Request, fallback:string) {
 const me:any=await sessionUser();
 if(!me) return NextResponse.json({error:'Unauthorized'},{status:401});
 const uploaded:string[]=[];
 let rpcStarted=false;
 try {
  const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data');
  const form=multipart?await req.formData():null;
  const body:any=form?Object.fromEntries(form.entries()):await req.json();
  const action=fallback==='create'?'create':String(body.action||fallback);
  if(!['create','edit','edit_completion','take','start','assign','complete'].includes(action)) throw new Error('Unknown action.');
  const id=action==='create'?crypto.randomUUID():String(body.reportId||'');
  const r=action==='create'?null:await scopedReport(me,id);
  if(action!=='create'&&!r) return NextResponse.json({error:'ESO not found in your scope.'},{status:404});
  if(r){
   const t=Array.isArray(r.maintenance_tasks)?r.maintenance_tasks[0]:r.maintenance_tasks;
   if(r.reclassified_to_voe||(action==='edit'&&!canEditReport(me,r))||(action==='edit_completion'&&!canEditCompletion(me,r,t))||(!['edit','edit_completion'].includes(action)&&!canResolve(me.role))) return NextResponse.json({error:'This action is not allowed for your role.'},{status:403});
  }
  let plantId=r?.plant_id||me.plant_id;
  if(action==='create'&&body.locationId){
   const {data:loc}=await db.from('locations').select('plant_id').eq('company_id',me.company_id).eq('id',body.locationId).eq('active',true).maybeSingle();
   if(!loc||(me.role!=='super_admin'&&loc.plant_id!==me.plant_id)) throw new Error('Invalid location for your plant.');
   plantId=loc.plant_id;
  }
  const parseArray=(v:any)=>{const a=typeof v==='string'?JSON.parse(v):v||[];if(!Array.isArray(a))throw new Error('Expected a list.');return a;};
  const payload:any={...body,plant_id:plantId};
  delete payload.file;delete payload.files;
  if(['create','edit'].includes(action)) {
   payload.category=canonicalCategory(body.category);payload.urgency=canonicalUrgency(body.urgency);
   payload.description=String(body.description||'').trim();payload.location_id=body.locationId||null;
   payload.additional_locations=parseArray(body.additionalLocations);
  }
  payload.remove_photos=parseArray(body.removePhotos);
  const files=form?[...form.getAll('files'),...form.getAll('file')].filter((f):f is File=>f instanceof File&&f.size>0):[];
  if(files.length>MAX_PHOTOS||files.reduce((s,f)=>s+f.size,0)>MAX_UPLOAD_BYTES) return NextResponse.json({error:'Choose up to 8 photos, with a combined size below 3.5 MB.'},{status:413});
  const photos=[];
  for(const file of files) {
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WebP photos.');
   const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
   const path=`${me.company_id}/${plantId}/${id}/${crypto.randomUUID()}.${ext}`;
   const {error}=await db.storage.from('eso-attachments').upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type,upsert:false});
   if(error) throw new Error(`Photo upload failed: ${error.message}`);
   uploaded.push(path);photos.push({storage_path:path,file_name:file.name,mime_type:file.type});
  }
  payload.photos=photos;rpcStarted=true;
  // The server is authoritative for the current revision. This avoids blocking
  // a normal photo edit when the detail panel was open in another tab.
  const expectedVersion=action==='create'?null:(Number.isInteger(Number(r?.revision))?Number(r.revision):null);
  const {data,error}=await db.rpc('eso_mutate_v621',{p_actor:me.id,p_report:id,p_action:action,p_expected_version:expectedVersion,p_data:payload});
  if(error && (error.code==='PGRST202'||String(error.message||'').includes('schema cache')||String(error.message||'').includes('does not exist'))) {
   try { const legacy=await legacyMutation(me,id,action,payload,photos,payload.remove_photos||[],r,plantId); return NextResponse.json({ok:true,report:legacy,legacy:true}); }
   catch(legacyError:any){if(uploaded.length)await db.storage.from('eso-attachments').remove(uploaded);return NextResponse.json({error:legacyError.message},{status:400});}
  }
  if(error) {
   // SQL exceptions roll back. A transport error has an unknown commit outcome.
   if(error.code&&uploaded.length) await db.storage.from('eso-attachments').remove(uploaded);
   return NextResponse.json({error:error.message},{status:error.code==='40001'?409:error.code==='42501'?403:400});
  }
  try {
   if(action==='create'||action==='complete') await notifyRoles(me.company_id,plantId,['admin','super_admin','management'],action==='create'?(payload.urgency==='critical'?'critical_eso':'new_eso'):'task_completed',action==='create'?(payload.urgency==='critical'?'CRITICAL ESO reported':'New ESO reported'):'ESO task completed',data.report_no,id);
   if(action==='assign') await notify(String(body.assignedTo),'task_assigned','New ESO task assigned',data.report_no,id);
   if(action==='complete'&&r?.reporter_id!==me.id) await notify(r.reporter_id,'eso_completed','Your ESO has been completed',data.report_no,id);
  } catch { /* Notification failure must not cause a committed write to be retried. */ }
  return NextResponse.json({ok:true,report:data});
 } catch(e:any) {
  if(!rpcStarted&&uploaded.length) await db.storage.from('eso-attachments').remove(uploaded);
  return NextResponse.json({error:e.message||'Could not save ESO.'},{status:400});
 }
}
