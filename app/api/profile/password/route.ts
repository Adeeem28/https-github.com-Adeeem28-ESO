import { NextResponse } from 'next/server';
import { db, sessionUser } from '@/lib/server';

export async function POST(req:Request){
  const me:any=await sessionUser();
  if(!me) return NextResponse.json({error:'Unauthorized'},{status:401});
  if(me.role==='employee') return NextResponse.json({error:'Employee accounts do not use passwords.'},{status:400});
  const {currentPassword,newPassword}=await req.json();
  if(String(newPassword||'').length<6) return NextResponse.json({error:'New password must be at least 6 characters.'},{status:400});
  const {error}=await db.rpc('change_eso_password',{p_user_id:me.id,p_current_password:String(currentPassword||''),p_new_password:String(newPassword||'')});
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}
