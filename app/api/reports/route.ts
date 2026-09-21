import { NextResponse } from 'next/server';import { db,sessionUser,notifyRoles,isSuperAdmin } from '@/lib/server';
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});
 let form:FormData;try{form=await req.formData()}catch{return NextResponse.json({error:'Could not read the form/photo. Please try again or choose a smaller image.'},{status:400})}
 const locationId=String(form.get('locationId')||'');let plantId=me.plant_id;
 if(locationId){const{data:loc}=await db.from('locations').select('id,plant_id').eq('company_id',me.company_id).eq('id',locationId).single();if(!loc)return NextResponse.json({error:'Invalid location for this company.'},{status:400});if(!isSuperAdmin(me.role)&&loc.plant_id!==me.plant_id)return NextResponse.json({error:'Location belongs to another plant.'},{status:403});plantId=loc.plant_id}
 const description=String(form.get('description')||'').trim(),urgency=String(form.get('urgency')||'medium').toLowerCase(),category=String(form.get('category')||'safety').toLowerCase();if(description.length<5)return NextResponse.json({error:'Description is required.'},{status:400});
 const file=form.get('file');if(file instanceof File&&file.size>4_000_000)return NextResponse.json({error:'Photo is too large after processing. Please choose another photo.'},{status:413});
 const reportId=crypto.randomUUID();let uploadedPath:string|null=null;
 if(file instanceof File&&file.size){const safeExt=(file.type==='image/png'?'png':'jpg'),path=`${me.company_id}/${plantId}/${new Date().getFullYear()}/${reportId}/${crypto.randomUUID()}.${safeExt}`,buf=Buffer.from(await file.arrayBuffer());const up=await db.storage.from('eso-attachments').upload(path,buf,{contentType:file.type||'image/jpeg'});if(up.error)return NextResponse.json({error:`Photo upload failed: ${up.error.message}`},{status:400});uploadedPath=path}
 const{data:r,error}=await db.from('eso_reports').insert({id:reportId,company_id:me.company_id,plant_id:plantId,reporter_id:me.id,location_id:locationId||null,description,urgency,category}).select('id,report_no').single();
 if(error){if(uploadedPath)await db.storage.from('eso-attachments').remove([uploadedPath]);return NextResponse.json({error:error.message},{status:400})}
 if(uploadedPath&&file instanceof File){const ae=await db.from('eso_attachments').insert({company_id:me.company_id,plant_id:plantId,eso_report_id:r.id,storage_path:uploadedPath,file_name:file.name||'photo.jpg',mime_type:file.type||'image/jpeg',uploaded_by:me.id,attachment_type:'report'});if(ae.error){await db.storage.from('eso-attachments').remove([uploadedPath]);await db.from('eso_reports').delete().eq('id',r.id);return NextResponse.json({error:`Could not attach photo: ${ae.error.message}`},{status:400})}}
 await db.from('eso_status_history').insert({company_id:me.company_id,plant_id:plantId,eso_report_id:r.id,old_status:null,new_status:'open',changed_by:me.id,note:'ESO submitted'});
 if(urgency==='critical')await notifyRoles(me.company_id,plantId,['admin','super_admin','management'],'critical_eso','CRITICAL ESO reported',`${r.report_no} was reported as Critical. Immediate review required.`,r.id);
 else await notifyRoles(me.company_id,plantId,['admin','super_admin','management'],'new_eso','New ESO reported',`${r.report_no} was submitted.`,r.id);
 return NextResponse.json({ok:true,report:r});
}
