import { NextResponse } from 'next/server';
import { db,sessionUser } from '@/lib/server';
export async function POST(req:Request){
 const me:any=await sessionUser();if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json(),s=b?.subscription;if(!s?.endpoint||!s?.keys?.p256dh||!s?.keys?.auth)return NextResponse.json({error:'Invalid push subscription'},{status:400});
 const row={company_id:me.company_id,plant_id:me.plant_id,user_id:me.id,endpoint:s.endpoint,p256dh:s.keys.p256dh,auth:s.keys.auth,user_agent:req.headers.get('user-agent')||null,active:true,updated_at:new Date().toISOString()};
 const {error}=await db.from('push_subscriptions').upsert(row,{onConflict:'user_id,endpoint'});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true});
}
export async function DELETE(req:Request){const me:any=await sessionUser();if(!me)return NextResponse.json({error:'Unauthorized'},{status:401});const b=await req.json();if(b?.endpoint)await db.from('push_subscriptions').update({active:false,updated_at:new Date().toISOString()}).eq('user_id',me.id).eq('endpoint',b.endpoint);return NextResponse.json({ok:true});}
