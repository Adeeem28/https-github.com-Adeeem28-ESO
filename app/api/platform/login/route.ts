import {NextResponse} from 'next/server';
import {setPlatformSession,loginAllowed} from '@/lib/server';
import {safeEqual} from '@/lib/security';
export async function POST(req:Request){
 try{
  const b=await req.json(),username=String(b.username||'').trim(),password=String(b.password||''),expectedUser=process.env.PLATFORM_OWNER_ID||'',expectedPass=process.env.PLATFORM_OWNER_PASSWORD||'';
  if(!expectedUser||expectedPass.length<12||/replace|placeholder|change.?me|example/i.test(expectedUser+' '+expectedPass))return NextResponse.json({error:'Platform Owner credentials are not configured.'},{status:503});
  if(username.length>100||password.length>1024)return NextResponse.json({error:'Invalid login details.'},{status:400});
  if(!await loginAllowed(req,username,true))return NextResponse.json({error:'Too many login attempts. Try again in 15 minutes.'},{status:429,headers:{'Retry-After':'900'}});
  if(!safeEqual(username,expectedUser)||!safeEqual(password,expectedPass))return NextResponse.json({error:'Invalid Platform Owner credentials.'},{status:401});
  await setPlatformSession('env-owner');return NextResponse.json({owner:{id:'env-owner',username:expectedUser,name:process.env.PLATFORM_OWNER_NAME||expectedUser}});
 }catch{return NextResponse.json({error:'Owner login temporarily unavailable.'},{status:503});}
}
