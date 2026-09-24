import { NextRequest, NextResponse } from 'next/server';
import { db, sessionUser, scopePlant } from '@/lib/server';

export async function GET(req: NextRequest) {
  const me:any = await sessionUser();
  if (!me) return NextResponse.json({error:'Unauthorized'},{status:401});
  const reportId = req.nextUrl.searchParams.get('reportId');
  if (!reportId) return NextResponse.json({error:'Missing reportId'},{status:400});

  let q:any = db.from('eso_reports')
    .select('id,reporter_id,maintenance_tasks(assigned_to),eso_attachments(storage_path,file_name,attachment_type,created_at)')
    .eq('id',reportId).eq('company_id',me.company_id);
  q = scopePlant(q,me);
  const {data:r,error} = await q.maybeSingle();
  if (error) return NextResponse.json({error:error.message},{status:400});
  if (!r) return NextResponse.json({error:'Report not found'},{status:404});

  const task = Array.isArray(r.maintenance_tasks) ? r.maintenance_tasks[0] : r.maintenance_tasks;
  if ((me.role==='employee' && r.reporter_id!==me.id) || ((me.role==='maintenance'||me.role==='supervisor') && r.reporter_id!==me.id && task?.assigned_to!==me.id)) {
    return NextResponse.json({error:'Forbidden'},{status:403});
  }
  const attachments=(r.eso_attachments||[]).slice().sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)));
  const reportAttachment=attachments.find((a:any)=>a.attachment_type==='report')||attachments.find((a:any)=>!a.attachment_type);
  const completionAttachment=[...attachments].reverse().find((a:any)=>a.attachment_type==='completion');
  const signed=async(a:any)=>{if(!a)return undefined;const {data}=await db.storage.from('eso-attachments').createSignedUrl(a.storage_path,3600);return data?.signedUrl};
  const [imageData,completionImageData]=await Promise.all([signed(reportAttachment),signed(completionAttachment)]);
  return NextResponse.json({imageData,completionImageData,imageName:reportAttachment?.file_name,completionImageName:completionAttachment?.file_name},{headers:{'Cache-Control':'private, max-age=300'}});
}
