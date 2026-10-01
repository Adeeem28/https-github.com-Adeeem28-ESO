import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { digest, validSessionToken, SESSION_SECONDS, UUID } from './security';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
function sessionSecret(){const value=process.env.APP_SESSION_SECRET||'';if(Buffer.byteLength(value)<32||/replace|placeholder|change.?me|example/i.test(value))throw new Error('APP_SESSION_SECRET must contain at least 32 bytes.');return value;}
function tokenHash(token:string){return digest(`session:${token}`,sessionSecret());}
function ownerFingerprint(){const username=process.env.PLATFORM_OWNER_ID,password=process.env.PLATFORM_OWNER_PASSWORD;return username&&password?digest(`owner:${username}:${password}`,sessionSecret()):null;}
async function createSession(name:string,identity:{employee_id?:string;owner_key?:string}){
 const token=crypto.randomBytes(32).toString('hex');
 const{error}=await db.from('eso_sessions').insert({token_hash:tokenHash(token),...identity,credential_fingerprint:identity.owner_key==='env-owner'?ownerFingerprint():null,expires_at:new Date(Date.now()+SESSION_SECONDS*1000).toISOString()});
 if(error)throw new Error('Session service unavailable. Check the V6.2.2 database migration.');
 (await cookies()).set(name,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:SESSION_SECONDS});
}
async function getSession(name:string){
 const token=(await cookies()).get(name)?.value||'';if(!validSessionToken(token))return null;
 const{data,error}=await db.from('eso_sessions').select('id,employee_id,owner_key,credential_fingerprint,expires_at').eq('token_hash',tokenHash(token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(error)throw new Error('Session service unavailable.');return data;
}
async function revokeSession(name:string){
 const c=await cookies(),token=c.get(name)?.value||'';
 if(validSessionToken(token)){const{error}=await db.from('eso_sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',tokenHash(token)).is('revoked_at',null);if(error)throw new Error('Could not revoke session. Please try logging out again.');}
 c.delete(name);
}
export async function setSession(userId:string){await revokeSession('eso_session');await createSession('eso_session',{employee_id:userId});}
export async function clearSession(){await revokeSession('eso_session');}
export async function sessionUser(){
 const s=await getSession('eso_session');if(!s?.employee_id||s.owner_key)return null;
 const{data,error}=await db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,company_id,plant_id,departments(name),companies(name,code,active),plants(name,code,active,company_id)').eq('id',s.employee_id).maybeSingle();
 if(error)throw new Error('Could not verify session.');const u:any=data;
 return u?.active&&u.companies?.active&&u.plants?.active&&u.plants.company_id===u.company_id?u:null;
}
export async function setPlatformSession(ownerId:string){await revokeSession('eso_platform_session');await createSession('eso_platform_session',{owner_key:ownerId});}
export async function clearPlatformSession(){await revokeSession('eso_platform_session');}
export async function platformOwnerSession(){
 const s=await getSession('eso_platform_session');if(!s?.owner_key||s.employee_id)return null;
 if(s.owner_key==='env-owner'){const fingerprint=ownerFingerprint();if(!fingerprint||s.credential_fingerprint!==fingerprint)return null;const username=process.env.PLATFORM_OWNER_ID!;return{id:'env-owner',username,display_name:process.env.PLATFORM_OWNER_NAME||username,active:true};}
 if(!UUID.test(s.owner_key))return null;
 const{data,error}=await db.from('platform_owners').select('id,username,display_name,active').eq('id',s.owner_key).maybeSingle();if(error)throw new Error('Could not verify owner session.');return data?.active?data:null;
}
export async function loginAllowed(req:Request,identity:string,owner=false){
 // Vercel overwrites this header. Other hosts must configure a trusted proxy.
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';
 for(const[value,limit]of [[`ip:${ip}`,30],[`account:${identity.toLowerCase()}`,10]]as const){
  const{data,error}=await db.rpc('eso_consume_login_limit_v622',{p_key:digest(`${owner?'owner':'employee'}:${value}`,sessionSecret()),p_limit:limit,p_window_seconds:900});
  if(error)throw new Error('Login service unavailable. Check the V6.2.2 database migration.');if(!data)return false;
 }return true;
}
export function roleName(role:string){return role==='super_admin'?'Super Admin':role==='admin'?'Admin':role==='management'?'Management':role==='supervisor'?'Supervisor':role==='maintenance'?'Maintenance':'Employee'}
export function canAdmin(role:string){return role==='admin'||role==='super_admin'}
export function isSuperAdmin(role:string){return role==='super_admin'}
export function canMaintain(role:string){return role==='maintenance'||role==='supervisor'||role==='management'||canAdmin(role)}
export function canViewAll(role:string){return role==='management'||canAdmin(role)}
export function canManageLocations(role:string){return canAdmin(role)}
export function scopePlant(q:any,me:any,field='plant_id'){return isSuperAdmin(me.role)?q:q.eq(field,me.plant_id)}
export async function targetPlant(me:any,requested?:string|null){
 const id=isSuperAdmin(me.role)&&requested?requested:me.plant_id;if(!UUID.test(String(id)))return null;
 const{data,error}=await db.from('plants').select('id').eq('company_id',me.company_id).eq('id',id).eq('active',true).maybeSingle();if(error)throw new Error('Could not verify plant.');return data?.id||null;
}
export async function notify(userId:string,type:string,title:string,message?:string,esoReportId?:string,maintenanceTaskId?:string){const{data:u}=await db.from('employees').select('company_id,plant_id').eq('id',userId).eq('active',true).single();if(!u?.company_id||!u?.plant_id)return;await db.from('notifications').insert({company_id:u.company_id,plant_id:u.plant_id,user_id:userId,type,title,message:message||null,eso_report_id:esoReportId||null,maintenance_task_id:maintenanceTaskId||null});try{const{sendPushToUsers}=await import('@/lib/push');await sendPushToUsers([userId],{title,body:message,url:esoReportId?`/?eso=${esoReportId}`:'/',tag:type});}catch{}}
export async function notifyRoles(companyId:string,plantId:string,roles:string[],type:string,title:string,message?:string,esoReportId?:string){let q:any=db.from('employees').select('id,role,plant_id').eq('company_id',companyId).eq('active',true).in('role',roles);if(plantId)q=q.or(`plant_id.eq.${plantId},role.eq.super_admin`);const{data}=await q;if(data?.length){await db.from('notifications').insert(data.map((x:any)=>({company_id:companyId,plant_id:x.plant_id,user_id:x.id,type,title,message:message||null,eso_report_id:esoReportId||null})));try{const{sendPushToUsers}=await import('@/lib/push');await sendPushToUsers(data.map((x:any)=>x.id),{title,body:message,url:esoReportId?`/?eso=${esoReportId}`:'/',tag:type});}catch{}}}
