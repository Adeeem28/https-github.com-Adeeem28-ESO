import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db,sessionUser,canAdmin } from '@/lib/server';

const roles:any={employee:'employee',maintenance:'maintenance',supervisor:'supervisor',management:'management',admin:'admin','super admin':'super_admin',super_admin:'super_admin'};
function pick(row:any,...keys:string[]){for(const k of keys){const found=Object.keys(row).find(x=>x.trim().toLowerCase()===k.toLowerCase());if(found&&row[found]!==undefined&&row[found]!==null)return String(row[found]).trim()}return ''}
function splitName(v:string){const p=v.trim().split(/\s+/);return {first:p.shift()||'',last:p.join(' ')||'-'}}
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
 const form=await req.formData();const file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'Excel file is required'},{status:400});
 const wb=XLSX.read(Buffer.from(await file.arrayBuffer()),{type:'buffer'});const ws=wb.Sheets[wb.SheetNames[0]];const rows:any[]=XLSX.utils.sheet_to_json(ws,{defval:''});
 const {data:deps}=await db.from('departments').select('id,name').eq('active',true);const depMap=new Map((deps||[]).map((d:any)=>[d.name.toLowerCase(),d.id]));
 const errors:any[]=[];let imported=0,updated=0;
 for(let i=0;i<rows.length;i++){
   const row=rows[i],employeeNo=pick(row,'Employee ID','EmployeeID','ID'),fullName=pick(row,'Full Name','Name'),first=pick(row,'First Name'),last=pick(row,'Last Name'),department=pick(row,'Department'),roleRaw=(pick(row,'Role')||'Employee').toLowerCase(),target=Number(pick(row,'Annual Target','ESO Target','Target')||12),password=pick(row,'Password');
   const n=fullName?splitName(fullName):{first,last:last||'-'};const role=roles[roleRaw];const depId=depMap.get(department.toLowerCase());
   if(!employeeNo||!n.first||!department||!depId||!role){errors.push({row:i+2,error:'Missing/invalid Employee ID, name, department or role'});continue}
   if(me.role!=='super_admin'&&role==='super_admin'){errors.push({row:i+2,error:'Only Super Admin can import Super Admin users'});continue}
   const {data:existing}=await db.from('employees').select('id,role').eq('employee_no',employeeNo).maybeSingle();
   if(existing){
     if(existing.role==='employee'&&role!=='employee'&&password.length<6){errors.push({row:i+2,error:'Password (6+ chars) required when changing Employee to a privileged role'});continue}
     const update:any={first_name:n.first,last_name:n.last,department_id:depId,role,annual_eso_target:Number.isFinite(target)?target:12,active:true};
     if(role==='employee')update.password_hash=null;
     const {error}=await db.from('employees').update(update).eq('id',existing.id);if(error){errors.push({row:i+2,error:error.message});continue}
     if(password&&role!=='employee')await db.rpc('admin_set_eso_password',{p_user_id:existing.id,p_new_password:password});updated++;
   }else{
     if(role!=='employee'&&password.length<6){errors.push({row:i+2,error:'Password (6+ chars) required for privileged roles'});continue}
     const {data:newUser,error}=await db.from('employees').insert({employee_no:employeeNo,first_name:n.first,last_name:n.last,department_id:depId,role,annual_eso_target:Number.isFinite(target)?target:12,active:true,password_hash:null}).select('id').single();if(error){errors.push({row:i+2,error:error.message});continue}
     if(role!=='employee'){const pw=await db.rpc('admin_set_eso_password',{p_user_id:newUser.id,p_new_password:password});if(pw.error){await db.from('employees').delete().eq('id',newUser.id);errors.push({row:i+2,error:pw.error.message});continue}}
     imported++;
   }
 }
 return NextResponse.json({ok:true,imported,updated,errors,total:rows.length});
}
