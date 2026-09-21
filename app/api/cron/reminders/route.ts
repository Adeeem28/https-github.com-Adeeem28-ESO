import { NextResponse } from 'next/server';
import { db } from '@/lib/server';
import { sendPushToUsers } from '@/lib/push';

async function already(taskId:string,key:string){const {data}=await db.from('task_reminder_events').select('id').eq('maintenance_task_id',taskId).eq('event_key',key).maybeSingle();return !!data}
async function record(t:any,key:string){await db.from('task_reminder_events').insert({company_id:t.company_id,plant_id:t.plant_id,maintenance_task_id:t.id,event_key:key});}
async function notifyUsers(t:any,userIds:string[],key:string,title:string,message:string){if(!userIds.length||await already(t.id,key))return;await db.from('notifications').insert(userIds.map(user_id=>({company_id:t.company_id,plant_id:t.plant_id,user_id,type:'task_reminder',title,message,eso_report_id:t.eso_report_id,maintenance_task_id:t.id})));await sendPushToUsers(userIds,{title,body:message,url:`/?eso=${t.eso_report_id}`,tag:`task-${t.id}-${key}`});await record(t,key)}
export async function GET(req:Request){
 const auth=req.headers.get('authorization');if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const now=Date.now(),{data:tasks,error}=await db.from('maintenance_tasks').select('id,company_id,plant_id,eso_report_id,assigned_to,due_at,status,eso_reports(report_no)').not('due_at','is',null).in('status',['assigned','in_progress']);if(error)return NextResponse.json({error:error.message},{status:500});
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
