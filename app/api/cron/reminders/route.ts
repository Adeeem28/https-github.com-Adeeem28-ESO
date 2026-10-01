import { NextResponse } from 'next/server';
import { db } from '@/lib/server';
import {safeEqual} from '@/lib/security';
import { sendPushToUsers } from '@/lib/push';

async function notifyUsers(t:any,userIds:string[],key:string,title:string,message:string){
 if(!userIds.length)return;
 const {data,error}=await db.rpc('eso_queue_task_reminder_v622',{p_task:t.id,p_key:key,p_users:[...new Set(userIds)],p_title:title,p_message:message});
 if(error)throw new Error('Could not queue task reminder.');
 if(data)await sendPushToUsers(userIds,{title,body:message,url:`/?eso=${t.eso_report_id}`,tag:`task-${t.id}-${key}`});
}
export async function GET(req:Request){
 const auth=req.headers.get('authorization')||'',secret=process.env.CRON_SECRET;if(!secret)return NextResponse.json({error:'Cron is not configured.'},{status:503});if(!safeEqual(auth,`Bearer ${secret}`))return NextResponse.json({error:'Unauthorized'},{status:401});
 await db.rpc('eso_cleanup_auth_v622');
 const now=Date.now(),{data:tasks,error}=await db.from('maintenance_tasks').select('id,company_id,plant_id,eso_report_id,assigned_to,due_at,status,eso_reports!inner(report_no,reclassified_to_voe),companies!inner(active),plants!inner(active)').not('due_at','is',null).in('status',['assigned','in_progress']).eq('eso_reports.reclassified_to_voe',false).eq('companies.active',true).eq('plants.active',true);if(error)return NextResponse.json({error:error.message},{status:500});
 for(const t of tasks||[]){const due=new Date(t.due_at).getTime(),hours=(due-now)/3600000,reportNo=(t as any).eso_reports?.report_no||'ESO';
   if(hours>0&&hours<=24)await notifyUsers(t,[t.assigned_to].filter(Boolean),'due_24h','ESO task due soon',`${reportNo} is due within 24 hours.`);
   if(hours<=0){await notifyUsers(t,[t.assigned_to].filter(Boolean),'overdue_assignee','ESO task overdue',`${reportNo} is overdue. Please complete the corrective action.`);
     const overdueH=-hours;const {data:staff}=await db.from('employees').select('id,role').eq('company_id',t.company_id).eq('plant_id',t.plant_id).eq('active',true).in('role',['supervisor','admin','management']);
     if(overdueH>=24)await notifyUsers(t,(staff||[]).filter((x:any)=>['supervisor','admin'].includes(x.role)).map((x:any)=>x.id),'escalate_24h','Overdue ESO escalation',`${reportNo} has been overdue for more than 24 hours.`);
     if(overdueH>=48){const {data:supers}=await db.from('employees').select('id').eq('company_id',t.company_id).eq('active',true).eq('role','super_admin');await notifyUsers(t,[...(staff||[]).filter((x:any)=>x.role==='management').map((x:any)=>x.id),...(supers||[]).map((x:any)=>x.id)],'escalate_48h','Overdue ESO escalation',`${reportNo} has been overdue for more than 48 hours.`);}
   }
 }
 return NextResponse.json({ok:true,checked:(tasks||[]).length});
}
