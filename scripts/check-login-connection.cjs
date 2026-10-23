// Live, read-only checks. Never prints credentials or employee records.
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const {randomUUID}=require('node:crypto');
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const checks=[
  ['employee and tenant lookup',()=>db.from('employees').select('id,active,company_id,plant_id,companies(active),plants(active,company_id)').limit(1)],
  ['session schema',()=>db.from('eso_sessions').select('id,employee_id,owner_key,credential_fingerprint,expires_at,password_setup,revoked_at,token_hash').limit(0)],
  ['login limiter schema',()=>db.from('eso_login_limits').select('*').limit(0)],
  ['login RPC rejects unknown identity',()=>db.rpc('eso_login_v626',{p_employee_no:'connection-check-'+randomUUID(),p_password:randomUUID(),p_company_code:null,p_plant_code:null})],
 ];
 for(const [label,run] of checks){const {error}=await run();if(error)throw new Error(label+': '+(error.code||'connection failure'));console.log('PASS '+label);}
 const res=await fetch(url+'/rest/v1/',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new Error('RPC schema discovery: HTTP '+res.status);
 const schema=await res.json();
 for(const name of ['eso_login_v626','eso_consume_login_limit_v622','eso_finish_password_setup_v626']){
  if(!schema.paths?.['/rpc/'+name])throw new Error('Missing RPC '+name);
  console.log('PASS available '+name);
 }
 console.log('Live read-only connection checks passed. Successful user login still requires a test account.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
