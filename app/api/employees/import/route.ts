import {NextResponse} from 'next/server';
import {db,sessionUser,canAdmin,isSuperAdmin} from '@/lib/server';
import {readEmployeeRows} from '@/lib/spreadsheet';
import {fetchAll} from '@/lib/pagination';
const roles:Record<string,string>={employee:'employee',maintenance:'maintenance',supervisor:'supervisor',management:'management',admin:'admin','super admin':'super_admin',super_admin:'super_admin'};
function pick(row:any,...keys:string[]){for(const k of keys){const found=Object.keys(row).find(x=>x.trim().toLowerCase()===k.toLowerCase());if(found&&row[found]!=null)return String(row[found]).trim();}return '';}
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
 try{
  const form=await req.formData(),file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'XLSX or CSV file is required.'},{status:400});
  const rows=await readEmployeeRows(Buffer.from(await file.arrayBuffer()),file.name.toLowerCase().endsWith('.csv'));
  const [ps,ds]=await Promise.all([fetchAll(db.from('plants').select('id,code').eq('company_id',me.company_id).eq('active',true).order('id')),fetchAll(db.from('departments').select('id,name,plant_id').eq('company_id',me.company_id).eq('active',true).order('id'))]);
  if(ps.error||ds.error)throw new Error('Could not load import scope.');const plantMap=new Map((ps.data||[]).map((p:any)=>[p.code.toLowerCase(),p.id]));
  const errors:any[]=[],valid:any[]=[];
  for(const {row:rowNumber,values:row} of rows){
   const employeeNo=pick(row,'Employee ID','EmployeeID','ID'),fullName=pick(row,'Full Name','Name'),parts=fullName.split(/\s+/),first=fullName?parts.shift():pick(row,'First Name'),last=fullName?(parts.join(' ')||'-'):(pick(row,'Last Name')||'-'),department=pick(row,'Department'),role=roles[(pick(row,'Role')||'Employee').toLowerCase()],target=Number(pick(row,'Annual Target','ESO Target','Target')||12),password=pick(row,'Password'),plantCode=pick(row,'Plant Code','Plant')||me.plants?.code||'',plantId=isSuperAdmin(me.role)?plantMap.get(plantCode.toLowerCase()):me.plant_id,dep=(ds.data||[]).find((d:any)=>d.plant_id===plantId&&d.name.toLowerCase()===department.toLowerCase());
   if(!employeeNo||!first||!plantId||!dep||!role||!Number.isInteger(target)||target<0||target>10000){errors.push({row:rowNumber,error:'Invalid plant, Employee ID, name, department, role or annual target.'});continue;}
   if(me.role!=='super_admin'&&role==='super_admin'){errors.push({row:rowNumber,error:'Only Super Admin can import Super Admin users.'});continue;}
   valid.push({row:rowNumber,data:{employee_no:employeeNo,first_name:first,last_name:last,department_id:dep.id,role,annual_eso_target:target,active:true,plant_id:plantId,...(password?{password}:{})}});
  }
  const{data,error}=await db.rpc('eso_import_employees_v622',{p_actor:me.id,p_rows:valid});if(error)throw new Error('Employee import unavailable. Check the V6.2.2 database migration.');
  return NextResponse.json({ok:true,imported:data.imported,updated:data.updated,errors:[...errors,...data.errors].sort((a,b)=>a.row-b.row),total:rows.length});
 }catch(e:any){return NextResponse.json({error:e.message||'Could not import employees.'},{status:400});}
}
