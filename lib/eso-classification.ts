import {NextResponse} from 'next/server';
import {db,sessionUser,canViewAll} from './server';
import {scopedReport} from './eso-mutations';
export async function classify(req:Request,action:'star'|'reclassify'){
 try{
  const me:any=await sessionUser();if(!me||!canViewAll(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await req.json(),id=String(action==='star'?b.reportId||'':b.esoId||''),r=await scopedReport(me,id);
  if(!r)return NextResponse.json({error:'ESO not found in your scope.'},{status:404});
  if(action==='star'&&typeof b.starred!=='boolean')return NextResponse.json({error:'Invalid star value.'},{status:400});
  if(action==='star'){
   const{data,error}=await db.rpc('eso_toggle_star_v625',{p_actor:me.id,p_report:id,p_starred:b.starred});
   if(error)return NextResponse.json({error:error.code==='PGRST202'?'V6.2.5 database upgrade required.':error.code==='42501'?'This action is not allowed.':error.code==='P0001'?error.message:'Could not update ESO.'},{status:error.code==='PGRST202'?503:error.code==='42501'?403:400});
   return NextResponse.json({ok:true,starred:data.starred,starCount:data.star_count,revision:data.revision});
  }
  const version=Number(b.version);if(!Number.isInteger(version)||version<1)return NextResponse.json({error:'Refresh the ESO detail before saving.'},{status:400});
  const{data,error}=await db.rpc('eso_classify_v622',{p_actor:me.id,p_report:id,p_expected_version:version,p_action:action,p_data:{reason:String(b.reason||'').trim(),category:String(b.category||'other')}});
  if(error)return NextResponse.json({error:error.code==='40001'?'ESO changed. Refresh and review before saving.':error.code==='PGRST202'?'V6.2.2 database upgrade required.':error.code==='42501'?'This action is not allowed.':error.code==='P0001'?error.message:'Could not update ESO.'},{status:error.code==='40001'?409:error.code==='PGRST202'?503:error.code==='42501'?403:400});
  return NextResponse.json({ok:true,voeId:data.voe_id,revision:data.revision});
 }catch{return NextResponse.json({error:'Could not update ESO.'},{status:400});}
}
