import {NextResponse} from 'next/server';
import {db,sessionUser,canAdmin,scopePlant} from '@/lib/server';

export async function POST(req:Request){
 const me:any=await sessionUser();
 if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!(canAdmin(me.role)||me.role==='management'))return NextResponse.json({error:'Only Management, Admin or Super Admin can award ESO Stars.'},{status:403});
 const body=await req.json().catch(()=>({})),reportId=String(body.reportId||''),starred=Boolean(body.starred);
 if(!reportId)return NextResponse.json({error:'Report ID is required.'},{status:400});
 let check:any=db.from('eso_reports').select('id').eq('id',reportId).eq('company_id',me.company_id);check=scopePlant(check,me);
 const{data:report,error:checkError}=await check.maybeSingle();
 if(checkError)return NextResponse.json({error:checkError.message},{status:400});
 if(!report)return NextResponse.json({error:'ESO report not found in your scope.'},{status:404});
 const update=starred?{is_starred:true,starred_by:me.id,starred_at:new Date().toISOString()}:{is_starred:false,starred_by:null,starred_at:null};
 const{error}=await db.from('eso_reports').update(update).eq('id',reportId).eq('company_id',me.company_id);
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,starred});
}
