import { NextResponse } from 'next/server';
import { db,sessionUser,canManageLocations } from '@/lib/server';
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me||!canManageLocations(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
 const b=await req.json();const name=String(b.name||'').trim();if(!name)return NextResponse.json({error:'Location name is required'},{status:400});
 const {error}=await db.from('locations').insert({name,department_id:b.departmentId||null,active:true});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true});
}
export async function PATCH(req:Request){
 const me:any=await sessionUser();if(!me||!canManageLocations(me.role))return NextResponse.json({error:'Forbidden'},{status:403});
 const b=await req.json();const updates:any={};if(b.name!==undefined)updates.name=String(b.name).trim();if(b.departmentId!==undefined)updates.department_id=b.departmentId||null;if(b.active!==undefined)updates.active=!!b.active;
 const {error}=await db.from('locations').update(updates).eq('id',b.id);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true});
}
