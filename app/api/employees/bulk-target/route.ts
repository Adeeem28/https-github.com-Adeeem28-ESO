import {NextResponse} from 'next/server';
import {db,sessionUser,canAdmin,scopePlant} from '@/lib/server';

const MAX_ANNUAL_TARGET=10000;

export async function POST(req:Request){
 try{
  const me:any=await sessionUser();
  if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
  const body=await req.json().catch(()=>null);
  const raw=body?.target??body?.annualTarget;
  const target=typeof raw==='number'?raw:(typeof raw==='string'&&/^\d+$/.test(raw.trim())?Number(raw):NaN);
  if(!Number.isInteger(target)||target<0||target>MAX_ANNUAL_TARGET)return NextResponse.json({error:`Annual target must be a whole number between 0 and ${MAX_ANNUAL_TARGET}.`},{status:400});

  let query:any=db.from('employees').update({annual_eso_target:target}).eq('company_id',me.company_id).eq('active',true);
  if(me.role!=='super_admin')query=query.not('role','eq','super_admin');
  query=scopePlant(query,me);
  const{data,error}=await query.select('id');
  if(error)return NextResponse.json({error:'Could not update annual targets.'},{status:400});
  return NextResponse.json({ok:true,target,updated:Array.isArray(data)?data.length:0,scope:me.role==='super_admin'?'company':'plant'});
 }catch{return NextResponse.json({error:'Could not update annual targets.'},{status:400});}
}
