import { NextResponse } from 'next/server';
import { db,sessionUser,canAdmin } from '@/lib/server';
const roleMap:any={'Employee':'employee','Maintenance':'maintenance','Supervisor':'supervisor','Management':'management','Admin':'admin','Super Admin':'super_admin'};
function names(name:string){const parts=String(name||'').trim().split(/\s+/);return {first:parts.shift()||'',last:parts.join(' ')||'-'}}
function canManageTarget(me:any,targetRole?:string,newRole?:string){
  if(me.role==='super_admin') return true;
  if(me.role!=='admin') return false;
  if(targetRole==='super_admin'||newRole==='super_admin') return false;
  return true;
}
export async function POST(req:Request){
  const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await req.json();if(me.role!=='super_admin'&&b.role==='Super Admin')return NextResponse.json({error:'Only Super Admin can create another Super Admin.'},{status:403});
  const n=names(b.name);const dep=await db.from('departments').select('id').eq('name',b.department).single();const dbRole=roleMap[b.role]||'employee';
  if(dbRole!=='employee'&&String(b.password||'').length<6)return NextResponse.json({error:'Password must be at least 6 characters for privileged roles.'},{status:400});
  const {data,error}=await db.from('employees').insert({employee_no:String(b.employeeId||'').trim(),first_name:n.first,last_name:n.last,department_id:dep.data?.id||null,role:dbRole,annual_eso_target:Number(b.annualTarget||12),active:true,password_hash:null}).select('id').single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  if(dbRole!=='employee'){const pw=await db.rpc('admin_set_eso_password',{p_user_id:data.id,p_new_password:String(b.password)});if(pw.error){await db.from('employees').delete().eq('id',data.id);return NextResponse.json({error:pw.error.message},{status:400});}}
  return NextResponse.json({ok:true,data});
}
export async function PATCH(req:Request){
  const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await req.json();if(!b.id)return NextResponse.json({error:'Employee is required'},{status:400});
  const {data:target}=await db.from('employees').select('id,role').eq('id',b.id).single();
  const nextRole=roleMap[b.role]||target?.role;
  if(!target||!canManageTarget(me,target.role,nextRole))return NextResponse.json({error:'You cannot modify this user or role.'},{status:403});
  const updates:any={};
  if(b.name!==undefined){const n=names(b.name);if(!n.first)return NextResponse.json({error:'Name is required'},{status:400});updates.first_name=n.first;updates.last_name=n.last;}
  if(b.department){const {data:dep}=await db.from('departments').select('id').eq('name',b.department).single();updates.department_id=dep?.id||null;}
  if(b.role){updates.role=nextRole;if(nextRole==='employee')updates.password_hash=null;}
  if(b.annualTarget!==undefined)updates.annual_eso_target=Math.max(0,Number(b.annualTarget)||0);
  if(b.active!==undefined)updates.active=!!b.active;
  const {error}=await db.from('employees').update(updates).eq('id',b.id);if(error)return NextResponse.json({error:error.message},{status:400});
  if(b.newPassword&&nextRole!=='employee'){
    const pw=await db.rpc('admin_set_eso_password',{p_user_id:b.id,p_new_password:String(b.newPassword)});if(pw.error)return NextResponse.json({error:pw.error.message},{status:400});
  }
  return NextResponse.json({ok:true});
}
export async function DELETE(req:Request){
  const me:any=await sessionUser();if(!me||!canAdmin(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await req.json();if(!b.id)return NextResponse.json({error:'Employee is required'},{status:400});if(b.id===me.id)return NextResponse.json({error:'You cannot delete your own account.'},{status:400});
  const {data:target}=await db.from('employees').select('id,role').eq('id',b.id).single();if(!target||!canManageTarget(me,target.role))return NextResponse.json({error:'You cannot delete this user.'},{status:403});
  const {error}=await db.from('employees').update({active:false}).eq('id',b.id);if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,mode:'deactivated'});
}
