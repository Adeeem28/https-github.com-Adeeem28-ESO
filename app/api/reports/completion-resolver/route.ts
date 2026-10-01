import {NextResponse} from 'next/server';
import {db,sessionUser,canAdmin} from '@/lib/server';
import {UUID} from '@/lib/security';

export async function POST(req:Request){
  try{
    const me:any=await sessionUser();
    if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});
    if(!canAdmin(me.role))return NextResponse.json({error:'Only an Admin or Super Admin can set Completed by.'},{status:403});
    const body:any=await req.json();
    const reportId=String(body.reportId||''),resolverId=String(body.resolverId||''),version=Number(body.version);
    if(!UUID.test(reportId)||!UUID.test(resolverId)||!Number.isInteger(version)||version<1){
      return NextResponse.json({error:'A valid ESO, employee and report version are required.'},{status:400});
    }
    const{data,error}=await db.rpc('eso_set_completion_resolver_v622',{p_actor:me.id,p_report:reportId,p_expected_version:version,p_resolver:resolverId});
    if(error){
      if(error.code==='PGRST202')return NextResponse.json({error:'Database upgrade required. Apply the latest ESO migration.'},{status:503});
      if(error.code==='40001')return NextResponse.json({error:'ESO changed. Refresh the detail and try again.'},{status:409});
      if(error.code==='42501')return NextResponse.json({error:'This employee or ESO is outside your allowed scope.'},{status:403});
      return NextResponse.json({error:error.code==='P0001'?error.message:'Could not set Completed by.'},{status:error.code?400:503});
    }
    return NextResponse.json({ok:true,report:data});
  }catch(e:any){
    return NextResponse.json({error:e instanceof SyntaxError?'Invalid request.':e?.message||'Could not set Completed by.'},{status:400});
  }
}
