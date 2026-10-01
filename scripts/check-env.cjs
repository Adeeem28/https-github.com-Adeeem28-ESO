// Validate configuration without printing any credentials.
require('@next/env').loadEnvConfig(process.cwd());
const invalid=[];
const placeholder=value=>/replace|placeholder|change.?me|example/i.test(value||'');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error();}catch{invalid.push('NEXT_PUBLIC_SUPABASE_URL: valid Supabase project URL required');}
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
if(!key||placeholder(key))invalid.push('SUPABASE_SECRET_KEY: server secret or service_role key required');
if(key.startsWith('sb_publishable_'))invalid.push('SUPABASE_SECRET_KEY: a public/publishable key cannot authorize server operations');
if(key.split('.').length===3){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='service_role')invalid.push('SUPABASE_SECRET_KEY: JWT role must be service_role');}catch{invalid.push('SUPABASE_SECRET_KEY: invalid JWT');}}
const session=process.env.APP_SESSION_SECRET||'';
if(Buffer.byteLength(session)<32||placeholder(session))invalid.push('APP_SESSION_SECRET: random secret with at least 32 bytes required');
const ownerId=process.env.PLATFORM_OWNER_ID||'',ownerPass=process.env.PLATFORM_OWNER_PASSWORD||'';
if(ownerId||ownerPass){if(!ownerId||ownerPass.length<12||placeholder(ownerId)||placeholder(ownerPass))invalid.push('Owner: ID and a unique password of at least 12 characters required');}
const cron=process.env.CRON_SECRET||'';
if(cron&&(cron.length<16||placeholder(cron)))invalid.push('CRON_SECRET: random secret with at least 16 characters required');
const publicPush=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privatePush=process.env.VAPID_PRIVATE_KEY;
if(Boolean(publicPush)!==Boolean(privatePush))invalid.push('Push: public and private VAPID keys must both be configured');
if(invalid.length){console.error('Configuration errors:\n'+invalid.map(x=>' - '+x).join('\n'));process.exitCode=1;}
else console.log('Server configuration valid. Credentials are not displayed.');
