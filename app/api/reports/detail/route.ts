import { NextRequest, NextResponse } from 'next/server';
import { db,sessionUser } from '@/lib/server';
import { scopedReport } from '@/lib/eso-mutations';
import { canEditReport,canEditCompletion,canResolve,isAdmin } from '@/lib/eso-policy';
export async function GET(req:NextRequest) {
 const me:any=await sessionUser();if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});
 try {
  const r=await scopedReport(me,req.nextUrl.searchParams.get('reportId')||'');
  if(!r)return NextResponse.json({error:'ESO not found'},{status:404});
  const t=Array.isArray(r.maintenance_tasks)?r.maintenance_tasks[0]:r.maintenance_tasks;
  let aq=db.from('eso_audit_events').select('id,actor_id,action,old_values,new_values,created_at,employees(first_name,last_name)').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',r.id).order('id',{ascending:false}).limit(30);
  const before=req.nextUrl.searchParams.get('before');if(before&&/^\d+$/.test(before))aq=aq.lt('id',before);
  let photos:any,extra:any,audit:any,history:any;
  const modern=await Promise.all([
   // Do not reference removed_at here: this endpoint must also work before the
   // additive V6.2.1 migration exists. The legacy fallback below handles the
   // missing audit/additional-location tables.
   db.from('eso_attachments').select('id,storage_path,file_name,attachment_type,created_at').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',r.id).order('created_at'),
   db.from('eso_additional_locations').select('location_id,locations(name)').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',r.id),aq,
   db.from('eso_status_history').select('id,old_status,new_status,changed_by,note,changed_at,employees(first_name,last_name)').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',r.id).order('changed_at',{ascending:false}).limit(30)
  ]);
  if(modern.some((result:any)=>result.error)) {
   // V6.1.5 compatibility: the dashboard and legacy photos must remain usable
   // until the additive V6.2.1 migration has been applied.
   const legacy=await Promise.all([
    db.from('eso_attachments').select('id,storage_path,file_name,attachment_type,created_at').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',r.id).order('created_at'),
    db.from('eso_status_history').select('id,old_status,new_status,changed_by,note,changed_at,employees(first_name,last_name)').eq('company_id',me.company_id).eq('plant_id',r.plant_id).eq('eso_report_id',r.id).order('changed_at',{ascending:false}).limit(30)
   ]);
   if(legacy[0].error||legacy[1].error)throw new Error(legacy[0].error?.message||legacy[1].error?.message);
   photos=legacy[0];extra={data:[],error:null};audit={data:[],error:null};history=legacy[1];
  } else [photos,extra,audit,history]=modern;
  const paths=(photos.data||[]).map((p:any)=>p.storage_path);
  const signed=paths.length?await db.storage.from('eso-attachments').createSignedUrls(paths,3600):null;
  if(signed?.error)throw new Error(signed.error.message);
  const urls=new Map((signed?.data||[]).map(p=>[p.path,p.signedUrl]));
  const completed=['completed','closed'].includes(r.status),unassigned=!t?.assigned_to,available=unassigned||t?.assigned_to===me.id||isAdmin(me.role);
  const completedAt=t?.completed_at||r.completed_at;
  const completionTime=completedAt?new Date(completedAt).getTime():NaN;
  const mappedPhotos=(photos.data||[]).map((p:any)=>{
   // Some V6.1.5 records were saved with every upload labelled `report`.
   // Once the report was completed, uploads created at/after completion are
   // the After photos and should be displayed in that group.
   const createdTime=new Date(p.created_at).getTime();
   const type=p.attachment_type==='completion'||(p.attachment_type==='report'&&Number.isFinite(completionTime)&&createdTime>=completionTime)?'completion':p.attachment_type;
   return {id:p.id,name:p.file_name,type,url:urls.get(p.storage_path)};
  });
  return NextResponse.json({report:r,task:t||null,additionalLocations:extra.data||[],photos:mappedPhotos,audit:audit.data||[],nextBefore:audit.data?.length===30?String(audit.data[29].id):null,legacyHistory:history.data||[],permissions:{edit:canEditReport(me,r),editCompletion:completed&&canEditCompletion(me,r,t),take:!completed&&canResolve(me.role)&&unassigned,start:!completed&&canResolve(me.role)&&t?.assigned_to===me.id&&t?.status==='assigned',complete:!completed&&canResolve(me.role)&&available}},{headers:{'Cache-Control':'private, no-store'}});
 } catch(e:any){return NextResponse.json({error:e.message||'Could not load ESO detail'},{status:400});}
}
