import {db,sessionUser,notify,notifyRoles,targetPlant} from './server';
import {canReadReport,canEditReport,canEditCompletion,canResolve,isAdmin,canonicalCategory,canonicalUrgency,MAX_PHOTOS,MAX_UPLOAD_BYTES} from './eso-policy';
import {UUID,photoMatchesMime} from './security';
import {NextResponse} from 'next/server';
export async function scopedReport(me:any,id:string){
 if(!UUID.test(id))return null;
 let q=db.from('eso_reports').select('*,maintenance_tasks(*)').eq('company_id',me.company_id).eq('id',id);
 if(me.role!=='super_admin')q=q.eq('plant_id',me.plant_id);
 const{data,error}=await q.maybeSingle();if(error)throw new Error('Could not load ESO.');return data&&canReadReport(me,data)?data:null;
}
function array(value:any){const a=typeof value==='string'?JSON.parse(value):value||[];if(!Array.isArray(a))throw new Error('Expected a list.');return a;}
const failure=(error:string,status=400)=>NextResponse.json({error},{status});
export async function mutateReport(req:Request,fallback:string){
 const uploaded:string[]=[];let rpcStarted=false;
 try{
  const me:any=await sessionUser();if(!me)return failure('Unauthorized',401);
  const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data'),form=multipart?await req.formData():null;
  const body:any=form?Object.fromEntries(form.entries()):await req.json(),action=fallback==='create'?'create':String(body.action||fallback);
  if(!['create','edit','edit_completion','take','start','assign','complete'].includes(action))return failure('Unknown action.');
  const id=action==='create'?crypto.randomUUID():String(body.reportId||''),r=action==='create'?null:await scopedReport(me,id);
  if(action!=='create'&&!r)return failure('ESO not found in your scope.',404);
  const expectedVersion=action==='create'?null:Number(body.version);
  if(r){
   if(!Number.isInteger(expectedVersion)||expectedVersion!<1)return failure('A valid report version is required. Refresh the detail.');
   if(r.revision!==expectedVersion)return failure('ESO changed. Refresh the detail and review your changes before saving again.',409);
   const t=Array.isArray(r.maintenance_tasks)?r.maintenance_tasks[0]:r.maintenance_tasks,completed=['completed','closed'].includes(r.status);
   if(r.reclassified_to_voe||(action==='edit'&&!canEditReport(me,r))||(action==='edit_completion'&&!canEditCompletion(me,r,t))||(!['edit','edit_completion'].includes(action)&&!canResolve(me.role)))return failure('This action is not allowed for your role.',403);
   if(action==='assign'&&!isAdmin(me.role))return failure('Only an admin can assign tasks.',403);
   if(!['edit','edit_completion'].includes(action)&&completed)return failure('ESO is already completed.',409);
   if(action==='edit_completion'&&!completed)return failure('Complete this ESO before editing completion.');
   if(['take','start','complete'].includes(action)&&t?.assigned_to&&t.assigned_to!==me.id&&(action==='take'||!isAdmin(me.role)))return failure('Task already assigned to another user.',403);
  }
  let plantId=r?.plant_id||me.plant_id;
  if(action==='create'){
   if(body.locationId){const{data:loc,error}=await db.from('locations').select('plant_id').eq('company_id',me.company_id).eq('id',body.locationId).eq('active',true).maybeSingle();if(error||!loc||(me.role!=='super_admin'&&loc.plant_id!==me.plant_id))return failure('Invalid location for your plant.');plantId=loc.plant_id;}
   if(!await targetPlant(me,plantId))return failure('Invalid or inactive plant.');
  }
  const payload:any={plant_id:plantId};
  if(['create','edit'].includes(action)){
   payload.category=canonicalCategory(body.category);payload.urgency=canonicalUrgency(body.urgency);payload.description=String(body.description||'').trim();payload.location_id=body.locationId||null;
   if(payload.description.length<5||payload.description.length>10000)return failure('Description must contain 5 to 10000 characters.');
   // Omitted fields preserve saved locations; the form sends an explicit list.
   if(action==='create'||body.additionalLocations!==undefined){payload.additional_locations=array(body.additionalLocations);if(payload.additional_locations.length>20||payload.additional_locations.some((id:any)=>typeof id!=='string'||!UUID.test(id)))return failure('Choose up to 20 valid additional locations.');}
  }
  if(action==='assign'){payload.assignedTo=String(body.assignedTo||'');payload.dueAt=String(body.dueAt||'');if(!UUID.test(payload.assignedTo))return failure('Choose a valid assignee.');}
  if(['complete','edit_completion'].includes(action)){payload.correctiveAction=String(body.correctiveAction||'').trim();if(!payload.correctiveAction||payload.correctiveAction.length>10000)return failure('Corrective action must contain 1 to 10000 characters.');}
  payload.remove_photos=array(body.removePhotos);
  if(payload.remove_photos.length>8||payload.remove_photos.some((id:any)=>typeof id!=='string'||!UUID.test(id)))return failure('Invalid photo removal.');
  const files=form?[...form.getAll('files'),...form.getAll('file')].filter((f):f is File=>f instanceof File&&f.size>0):[];
  if(files.length>MAX_PHOTOS||files.reduce((s,f)=>s+f.size,0)>MAX_UPLOAD_BYTES)return failure('Choose up to 8 photos, with a combined size below 3.5 MB.',413);
  if(!['create','edit','complete','edit_completion'].includes(action)&&(files.length||payload.remove_photos.length))return failure('Photos are not supported for this action.');
  const buffers=await Promise.all(files.map(f=>f.arrayBuffer().then(b=>Buffer.from(b))));
  if(files.some((f,i)=>!photoMatchesMime(buffers[i],f.type)))return failure('Use valid JPG, PNG or WebP photos.');
  const photos=[];
  for(let i=0;i<files.length;i++){
   const file=files[i],ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=`${me.company_id}/${plantId}/${id}/${crypto.randomUUID()}.${ext}`;
   const{error}=await db.storage.from('eso-attachments').upload(path,buffers[i],{contentType:file.type,upsert:false});if(error)throw new Error('Photo upload failed. Please try again.');
   uploaded.push(path);photos.push({storage_path:path,file_name:file.name.replace(/[\x00-\x1f]/g,'').slice(0,255)||`photo.${ext}`,mime_type:file.type});
  }
  payload.photos=photos;rpcStarted=true;
  const{data,error}=await db.rpc('eso_mutate_v621',{p_actor:me.id,p_report:id,p_action:action,p_expected_version:expectedVersion,p_data:payload});
  if(error){
   // A database exception rolls back; a network timeout has an unknown outcome.
   if(error.code&&uploaded.length)await db.storage.from('eso-attachments').remove(uploaded);
   if(error.code==='PGRST202')return failure('Database upgrade required. Apply the V6.2.2 migrations before saving.',503);
   if(error.code==='40001')return failure('ESO changed. Refresh the detail and review your changes before saving again.',409);
   if(error.code==='42501')return failure('This action is not allowed in your scope.',403);
   return failure(error.code==='P0001'?error.message:'Could not save ESO. Check the data and try again.',error.code?400:503);
  }
  try{
   if(['create','complete','take','start'].includes(action))await notifyRoles(me.company_id,plantId,['admin','super_admin','management'],action==='create'?(payload.urgency==='critical'?'critical_eso':'new_eso'):action==='complete'?'task_completed':'task_started',action==='create'?(payload.urgency==='critical'?'CRITICAL ESO reported':'New ESO reported'):action==='complete'?'ESO task completed':'ESO task started',data.report_no,id);
   if(action==='assign')await notify(String(body.assignedTo),'task_assigned','New ESO task assigned',data.report_no,id);
   if(action==='complete'&&r?.reporter_id!==me.id)await notify(r.reporter_id,'eso_completed','Your ESO has been completed',data.report_no,id);
  }catch{/* A committed write must not be retried because notifications failed. */}
  return NextResponse.json({ok:true,report:data});
 }catch(e:any){if(!rpcStarted&&uploaded.length)await db.storage.from('eso-attachments').remove(uploaded);return failure(e instanceof SyntaxError?'Invalid request.':e.message||'Could not save ESO.');}
}
