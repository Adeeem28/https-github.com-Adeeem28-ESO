import webpush from 'web-push';
import { db } from '@/lib/server';

let configured=false;
function configure(){
  if(configured)return true;
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT||'mailto:admin@example.com';
  if(!publicKey||!privateKey)return false;
  webpush.setVapidDetails(subject,publicKey,privateKey);configured=true;return true;
}
export async function sendPushToUsers(userIds:string[],payload:{title:string;body?:string;url?:string;tag?:string}){
  if(!userIds.length||!configure())return {sent:0,disabled:true};
  const {data:subs}=await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id',userIds).eq('active',true);
  let sent=0;
  await Promise.all((subs||[]).map(async(s:any)=>{
    try{
      await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(payload),{TTL:60*60*24,urgency:'high'});
      sent++;
    }catch(e:any){
      if(e?.statusCode===404||e?.statusCode===410)await db.from('push_subscriptions').update({active:false,updated_at:new Date().toISOString()}).eq('id',s.id);
    }
  }));
  return {sent};
}
