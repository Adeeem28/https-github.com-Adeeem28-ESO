import {fetchAll} from '@/lib/pagination';
import {NextResponse} from 'next/server';
import {db,sessionUser,scopePlant,canViewAll} from '@/lib/server';
import {UUID} from '@/lib/security';
import {VOE_CATEGORIES,VOE_STATUSES,voeNotes} from '@/lib/voe';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 const me:any=await sessionUser();if(!me)return fail('Unauthorized',401);
 let q:any=scopePlant(db.from('voe_reports').select('id,reporter_id,plant_id,category,description,status,admin_note,source_eso_report_id,created_at,updated_at,plants(name)').eq('company_id',me.company_id).order('created_at',{ascending:false}),me);
 if(!canViewAll(me.role))q=q.eq('reporter_id',me.id);
 const {data,error}=await fetchAll(q.order('id'));if(error)return fail('Could not load Voice of Employee. Please retry.',500);
 const rows:any[]=data||[],ids=[...new Set(rows.map(r=>r.reporter_id))],sourceIds=[...new Set(rows.map(r=>r.source_eso_report_id).filter(Boolean))];
 const employees:any[]=[],sources:any[]=[],history:any[]=[];
 // Keep each enrichment request bounded, and scoped to this company.
 for(let offset=0;offset<ids.length;offset+=100){const result=await db.from('employees').select('id,employee_no,first_name,last_name,departments(name)').eq('company_id',me.company_id).in('id',ids.slice(offset,offset+100));if(result.error)return fail('Could not load report authors. Please retry.',500);employees.push(...result.data||[])}
 for(let offset=0;offset<sourceIds.length;offset+=100){
  const batch=sourceIds.slice(offset,offset+100);
  const [s,h]=await Promise.all([db.from('eso_reports').select('id,report_no').eq('company_id',me.company_id).in('id',batch),db.from('report_reclassification_history').select('voe_report_id,reason,changed_at').eq('company_id',me.company_id).in('eso_report_id',batch).order('changed_at',{ascending:false})]);
  if(s.error||h.error)return fail('Could not load transfer history. Please retry.',500);sources.push(...s.data||[]);history.push(...h.data||[]);
 }
 const em=new Map(employees.map(e=>[e.id,e])),sm=new Map(sources.map(s=>[s.id,s]));
 return NextResponse.json({reports:rows.map(r=>{const e=em.get(r.reporter_id),h=history.find(h=>h.voe_report_id===r.id);return {id:r.id,reporterId:r.reporter_id,reporterName:`${e?.first_name||''} ${e?.last_name||''}`.trim(),employeeId:e?.employee_no||'',department:e?.departments?.name||'',plantId:r.plant_id,plantName:r.plants?.name||'',category:r.category,description:r.description,status:VOE_STATUSES[r.status],...voeNotes(r.admin_note,r.source_eso_report_id,h?.reason),sourceEsoReportId:r.source_eso_report_id||undefined,sourceEsoReportNumber:sm.get(r.source_eso_report_id)?.report_no,transferredAt:h?.changed_at,createdAt:r.created_at,updatedAt:r.updated_at}})});
}
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me)return fail('Unauthorized',401);
 const b=await req.json().catch(()=>null);if(!b)return fail('Invalid request.');
 const category=String(b.category||''),description=String(b.description||'').trim();
 if(!Object.hasOwn(VOE_CATEGORIES,category)||description.length<5||description.length>10000)return fail('Choose a category and enter 5–10000 characters.');
 const {data,error}=await db.from('voe_reports').insert({company_id:me.company_id,plant_id:me.plant_id,reporter_id:me.id,category,description,status:'new'}).select('id').single();
 if(error)return fail('Could not submit Voice of Employee. Please retry.',500);return NextResponse.json({ok:true,id:data.id});
}
export async function PATCH(req:Request){
 const me:any=await sessionUser();if(!me)return fail('Unauthorized',401);if(!canViewAll(me.role))return fail('Forbidden',403);
 const b=await req.json().catch(()=>null);if(!b||!UUID.test(String(b.id)))return fail('Invalid report.');
 const status=String(b.status||'').toLowerCase().replaceAll(' ','_'),category=String(b.category||''),note=String(b.adminNote||'').trim();
 if(!Object.hasOwn(VOE_STATUSES,status)||!Object.hasOwn(VOE_CATEGORIES,category)||note.length>10000||typeof b.updatedAt!=='string'||!Number.isFinite(Date.parse(b.updatedAt)))return fail('Invalid status, category or report version.');
 const current=await scopePlant(db.from('voe_reports').select('id,status,updated_at').eq('id',b.id).eq('company_id',me.company_id),me).maybeSingle();
 if(current.error)return fail('Could not load report. Please retry.',500);if(!current.data)return fail('Voice of Employee not found.',404);
 const now=new Date().toISOString(),patch:any={status,category,admin_note:note||null,updated_at:now};
 if(current.data.status!==status){patch.closed_at=status==='closed'?now:null;patch.closed_by=status==='closed'?me.id:null}
 const result=await scopePlant(db.from('voe_reports').update(patch).eq('id',b.id).eq('company_id',me.company_id).eq('updated_at',b.updatedAt),me).select('id').maybeSingle();
 if(result.error)return fail('Could not save changes. Please retry.',500);if(!result.data)return fail('This report changed. Refresh before saving again.',409);
 return NextResponse.json({ok:true});
}
