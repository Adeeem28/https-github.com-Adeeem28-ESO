import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sessionSecret = process.env.APP_SESSION_SECRET!;
export const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

function sign(value:string){return crypto.createHmac('sha256',sessionSecret).update(value).digest('hex')}
export async function setSession(userId:string){const c=await cookies(); const v=`${userId}.${sign(userId)}`; c.set('eso_session',v,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*12});}
export async function clearSession(){(await cookies()).delete('eso_session')}
export async function sessionUser(){
  const raw=(await cookies()).get('eso_session')?.value;if(!raw)return null;
  const [id,sig]=raw.split('.');if(!id||!sig)return null;
  const expected=sign(id);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
  const {data}=await db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,company_id,departments(name),companies(name,code)').eq('id',id).single();
  return data?.active?data:null;
}
export function roleName(role:string){return role==='super_admin'?'Super Admin':role==='admin'?'Admin':role==='management'?'Management':role==='supervisor'?'Supervisor':role==='maintenance'?'Maintenance':'Employee'}
export function canAdmin(role:string){return role==='admin'||role==='super_admin'}
export function canMaintain(role:string){return role==='maintenance'||role==='supervisor'||canAdmin(role)}
export function canViewAll(role:string){return role==='management'||canAdmin(role)}
export function canManageLocations(role:string){return canAdmin(role)}
export async function notify(userId:string,type:string,title:string,message?:string,esoReportId?:string,maintenanceTaskId?:string){
  const {data:u}=await db.from('employees').select('company_id').eq('id',userId).single(); if(!u?.company_id)return;
  await db.from('notifications').insert({company_id:u.company_id,user_id:userId,type,title,message:message||null,eso_report_id:esoReportId||null,maintenance_task_id:maintenanceTaskId||null});
}
export async function notifyRoles(companyId:string,roles:string[],type:string,title:string,message?:string,esoReportId?:string){
  const {data}=await db.from('employees').select('id').eq('company_id',companyId).eq('active',true).in('role',roles);
  if(data?.length) await db.from('notifications').insert(data.map(x=>({company_id:companyId,user_id:x.id,type,title,message:message||null,eso_report_id:esoReportId||null})));
}
