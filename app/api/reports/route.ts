import { NextResponse } from 'next/server'; import { db,sessionUser,notifyRoles } from '@/lib/server';
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});
 const form=await req.formData();const locationId=String(form.get('locationId')||'');const description=String(form.get('description')||'').trim();const urgency=String(form.get('urgency')||'medium').toLowerCase();const category=String(form.get('category')||'safety').toLowerCase();if(description.length<5)return NextResponse.json({error:'Description is required.'},{status:400});
 const {data:r,error}=await db.from('eso_reports').insert({reporter_id:me.id,location_id:locationId||null,description,urgency,category}).select('id,report_no').single();if(error)return NextResponse.json({error:error.message},{status:400});
 const file=form.get('file');if(file instanceof File&&file.size){const ext=file.name.split('.').pop()||'jpg';const path=`${new Date().getFullYear()}/${r.id}/${crypto.randomUUID()}.${ext}`;const buf=Buffer.from(await file.arrayBuffer());const up=await db.storage.from('eso-attachments').upload(path,buf,{contentType:file.type||'image/jpeg'});if(!up.error)await db.from('eso_attachments').insert({eso_report_id:r.id,storage_path:path,file_name:file.name,mime_type:file.type,uploaded_by:me.id,attachment_type:'report'});}
 await db.from('eso_status_history').insert({eso_report_id:r.id,old_status:null,new_status:'open',changed_by:me.id,note:'ESO submitted'});
 await notifyRoles(['admin','super_admin','management'],'new_eso',urgency==='critical'?'Critical ESO reported':'New ESO reported',`${r.report_no} was submitted.`,r.id);
 return NextResponse.json({ok:true,id:r.id,reportNo:r.report_no});
}
