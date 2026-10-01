import {NextResponse} from 'next/server';
import {db,setSession,roleName,loginAllowed} from '@/lib/server';
export async function POST(req:Request){
 try{
  const b=await req.json(),employeeId=String(b.employeeId||'').trim(),company=String(b.companyCode||'').trim(),plant=String(b.plantCode||'').trim(),password=String(b.password||'');
  if(!employeeId||employeeId.length>100||company.length>100||plant.length>100||Buffer.byteLength(password)>72)return NextResponse.json({error:'Invalid login details.'},{status:400});
  if(!await loginAllowed(req,`${company}:${plant}:${employeeId}`))return NextResponse.json({error:'Too many login attempts. Try again in 15 minutes.'},{status:429,headers:{'Retry-After':'900'}});
  const{data,error}=await db.rpc('verify_eso_login_tenant',{p_employee_no:employeeId,p_password:password||null,p_company_code:company||null,p_plant_code:plant||null});const u=data?.length===1?data[0]:null;
  if(error||!u)return NextResponse.json({error:'Invalid Employee ID, company code or password.'},{status:401});
  await setSession(u.id);return NextResponse.json({user:{id:u.id,employeeId:u.employee_no,name:`${u.first_name} ${u.last_name}`,department:u.department_name||'Unassigned',role:roleName(u.role),annualTarget:u.annual_eso_target,active:u.active,companyId:u.company_id,companyName:u.company_name,companyCode:u.company_code,plantId:u.plant_id,plantName:u.plant_name,plantCode:u.plant_code}});
 }catch{return NextResponse.json({error:'Login temporarily unavailable. Check the server configuration and database migration.'},{status:503});}
}
