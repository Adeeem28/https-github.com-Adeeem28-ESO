import { NextResponse } from 'next/server';
import { db, sessionUser, canAdmin } from '@/lib/server';

function cleanCode(value:any){
  const code=String(value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');
  return code || null;
}

export async function POST(req:Request){
  const me:any=await sessionUser();
  if(!me||!canAdmin(me.role)) return NextResponse.json({error:'Forbidden'},{status:403});
  const {name,code}=await req.json();
  const cleanName=String(name||'').trim();
  if(!cleanName) return NextResponse.json({error:'Department name is required'},{status:400});
  const {error}=await db.from('departments').insert({name:cleanName,code:cleanCode(code),active:true});
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}

export async function PATCH(req:Request){
  const me:any=await sessionUser();
  if(!me||!canAdmin(me.role)) return NextResponse.json({error:'Forbidden'},{status:403});
  const body=await req.json();
  if(!body.id) return NextResponse.json({error:'Department ID is required'},{status:400});
  const update:any={};
  if(body.name!==undefined){
    const cleanName=String(body.name||'').trim();
    if(!cleanName) return NextResponse.json({error:'Department name is required'},{status:400});
    update.name=cleanName;
  }
  if(body.code!==undefined) update.code=cleanCode(body.code);
  if(body.active!==undefined) update.active=!!body.active;
  if(Object.keys(update).length===0) return NextResponse.json({error:'Nothing to update'},{status:400});
  const {error}=await db.from('departments').update(update).eq('id',body.id);
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}
