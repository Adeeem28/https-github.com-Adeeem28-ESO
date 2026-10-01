import {NextResponse} from 'next/server';
import {db,sessionUser,canAdmin,scopePlant,targetPlant} from '@/lib/server';
const roles:Record<string,string>={Employee:'employee',Maintenance:'maintenance',Supervisor:'supervisor',Management:'management',Admin:'admin','Super Admin':'super_admin'};
async function save(req:Request,creating:boolean){
 try{
  const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await req.json(),payload:any={};let target:any=null;
  if(!creating){let q:any=db.from('employees').select('id,role,plant_id').eq('company_id',me.company_id).eq('id',String(b.id||''));q=scopePlant(q,me);const result=await q.maybeSingle();target=result.data;if(!target)return NextResponse.json({error:'Employee not found.'},{status:404});}
  const plant=await targetPlant(me,b.plantId||target?.plant_id);if(!plant)return NextResponse.json({error:'Invalid or inactive plant'},{status:400});payload.plant_id=plant;
  if(b.role!==undefined){if(!roles[b.role])return NextResponse.json({error:'Invalid role.'},{status:400});payload.role=roles[b.role];}
  if(me.role!=='super_admin'&&(target?.role==='super_admin'||payload.role==='super_admin'))return NextResponse.json({error:'Only Super Admin can manage this user or role.'},{status:403});
  if(b.name!==undefined){const parts=String(b.name||'').trim().split(/\s+/);payload.first_name=parts.shift()||'';payload.last_name=parts.join(' ')||'-';}
  if(creating)payload.employee_no=String(b.employeeId||'').trim();
  if(b.department!==undefined){payload.department_id=null;if(b.department){const{data:d}=await db.from('departments').select('id').eq('company_id',me.company_id).eq('plant_id',plant).eq('name',String(b.department)).maybeSingle();if(!d)return NextResponse.json({error:'Department is not available in the selected plant.'},{status:400});payload.department_id=d.id;}}
  if(b.annualTarget!==undefined)payload.annual_eso_target=Number(b.annualTarget);if(b.active!==undefined){if(typeof b.active!=='boolean')return NextResponse.json({error:'Invalid active value.'},{status:400});payload.active=b.active;}
  const password=creating?b.password:b.newPassword;if(password)payload.password=String(password);
  const{data,error}=await db.rpc('eso_save_employee_v622',{p_actor:me.id,p_user:creating?null:target.id,p_data:payload});
  if(error)return NextResponse.json({error:error.code==='P0001'?error.message:error.code==='42501'?'This user is outside your scope.':error.code==='PGRST202'?'V6.2.2 database upgrade required.':'Invalid or duplicate employee data.'},{status:error.code==='42501'?403:error.code==='PGRST202'?503:400});
  return NextResponse.json({ok:true,data});
 }catch{return NextResponse.json({error:'Could not save employee.'},{status:400});}
}
export async function POST(req:Request){return save(req,true);}
export async function PATCH(req:Request){return save(req,false);}
export async function DELETE(req:Request){
 const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});const b=await req.json();if(b.id===me.id)return NextResponse.json({error:'You cannot deactivate your own account.'},{status:400});
 const{error}=await db.rpc('eso_save_employee_v622',{p_actor:me.id,p_user:String(b.id||''),p_data:{active:false}});
 if(error)return NextResponse.json({error:'You cannot deactivate this user.'},{status:403});return NextResponse.json({ok:true,mode:'deactivated'});
}
