import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sessionSecret = process.env.APP_SESSION_SECRET!;
export const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
function sign(value:string){return crypto.createHmac('sha256',sessionSecret).update(value).digest('hex')}
export async function setSession(userId:string){const c=await cookies();c.set('eso_session',`${userId}.${sign(userId)}`,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*12});}
export async function clearSession(){(await cookies()).delete('eso_session')}
export async function sessionUser(){const raw=(await cookies()).get('eso_session')?.value;if(!raw)return null;const[id,sig]=raw.split('.');if(!id||!sig)return null;const expected=sign(id);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const{data}=await db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,company_id,plant_id,departments(name),companies(name,code),plants(name,code)').eq('id',id).single();return data?.active?data:null;}
export function roleName(role:string){return role==='super_admin'?'Super Admin':role==='admin'?'Admin':role==='management'?'Management':role==='supervisor'?'Supervisor':role==='maintenance'?'Maintenance':'Employee'}
export function canAdmin(role:string){return role==='admin'||role==='super_admin'}
export function isSuperAdmin(role:string){return role==='super_admin'}
export function canMaintain(role:string){return role==='maintenance'||role==='supervisor'||canAdmin(role)}
export function canViewAll(role:string){return role==='management'||canAdmin(role)}
export function canManageLocations(role:string){return canAdmin(role)}
export function scopePlant(q:any,me:any,field='plant_id'){return isSuperAdmin(me.role)?q:q.eq(field,me.plant_id)}
export function targetPlant(me:any,requested?:string|null){return isSuperAdmin(me.role)&&requested?requested:me.plant_id}
export async function notify(userId:string,type:string,title:string,message?:string,esoReportId?:string,maintenanceTaskId?:string){const{data:u}=await db.from('employees').select('company_id,plant_id').eq('id',userId).single();if(!u?.company_id||!u?.plant_id)return;await db.from('notifications').insert({company_id:u.company_id,plant_id:u.plant_id,user_id:userId,type,title,message:message||null,eso_report_id:esoReportId||null,maintenance_task_id:maintenanceTaskId||null});}
export async function notifyRoles(companyId:string,plantId:string,roles:string[],type:string,title:string,message?:string,esoReportId?:string){let q:any=db.from('employees').select('id,role,plant_id').eq('company_id',companyId).eq('active',true).in('role',roles);if(plantId)q=q.or(`plant_id.eq.${plantId},role.eq.super_admin`);const{data}=await q;if(data?.length)await db.from('notifications').insert(data.map((x:any)=>({company_id:companyId,plant_id:x.plant_id,user_id:x.id,type,title,message:message||null,eso_report_id:esoReportId||null})));}
export async function setPlatformSession(ownerId:string){const c=await cookies();const value=`platform:${ownerId}`;c.set('eso_platform_session',`${ownerId}.${sign(value)}`,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*12});}
export async function clearPlatformSession(){(await cookies()).delete('eso_platform_session')}
export async function platformOwnerSession(){const raw=(await cookies()).get('eso_platform_session')?.value;if(!raw)return null;const[id,sig]=raw.split('.');if(!id||!sig)return null;const expected=sign(`platform:${id}`);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;if(id==='env-owner'){const username=process.env.PLATFORM_OWNER_ID||'';if(!username)return null;return{id:'env-owner',username,display_name:process.env.PLATFORM_OWNER_NAME||username,active:true};}const{data}=await db.from('platform_owners').select('id,username,display_name,active').eq('id',id).single();return data?.active?data:null;}
