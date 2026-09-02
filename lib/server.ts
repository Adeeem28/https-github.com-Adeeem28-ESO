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
export async function sessionUser(){const raw=(await cookies()).get('eso_session')?.value;if(!raw)return null;const [id,sig]=raw.split('.');if(!id||!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(sign(id))))return null;const {data}=await db.from('employees').select('id,employee_no,first_name,last_name,role,annual_eso_target,active,departments(name)').eq('id',id).single();return data?.active?data:null;}
export function roleName(role:string){return role==='super_admin'?'Super Admin':role==='admin'?'Admin':role==='supervisor'?'Supervisor':role==='maintenance'?'Maintenance':'Employee'}
export function canAdmin(role:string){return role==='admin'||role==='super_admin'}
export function canMaintain(role:string){return role==='maintenance'||role==='supervisor'||canAdmin(role)}
