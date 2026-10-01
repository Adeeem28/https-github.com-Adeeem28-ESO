// Review harness: executes the supplied TypeScript sources with synthetic sessions,
// mocked database/storage, and no production network or writes.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const localRequire=createRequire(path.join(root,'package.json'));
const ts=localRequire('typescript');
const {NextRequest,NextResponse}=localRequire('next/server');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let me,r,calls,rpcError,rpcData,attachments,cookieJar,cache,sessions,rateAllowed;
const findings=[];
function reset(role='maintenance'){
 me={id:id(1),role,company_id:id(20),plant_id:id(30),active:true,companies:{active:true},plants:{active:true,company_id:id(20)}};
 r={id:id(100),report_no:'ESO-SYNTHETIC',company_id:id(20),plant_id:id(30),reporter_id:id(9),revision:4,category:'safety',urgency:'medium',status:'open',reclassified_to_voe:false,maintenance_tasks:[]};
 sessions=[];rateAllowed=true;calls=[];rpcError=null;rpcData={id:r.id,report_no:r.report_no,revision:5};attachments=[];cookieJar={};cache={};
}
class Query{
 constructor(table){this.table=table;this.ops=[];this.method='select';this.fields='*';}
 select(fields='*',options){this.fields=fields;this.options=options;return this;}
 eq(...args){this.ops.push(['eq',...args]);return this;}
 in(...args){this.ops.push(['in',...args]);return this;}
 not(...args){this.ops.push(['not',...args]);return this;}
 or(...args){this.ops.push(['or',...args]);return this;}
 gt(...args){this.ops.push(['gt',...args]);return this;}
 range(...args){this.ops.push(['range',...args]);return this;}
 gte(...args){this.ops.push(['gte',...args]);return this;}
 lte(...args){this.ops.push(['lte',...args]);return this;}
 lt(...args){this.ops.push(['lt',...args]);return this;}
 order(...args){this.ops.push(['order',...args]);return this;}
 limit(...args){this.ops.push(['limit',...args]);return this;}
 is(...args){this.ops.push(['is',...args]);return this;}
 update(value){this.method='update';this.value=value;return this;}
 insert(value){this.method='insert';this.value=value;return this;}
 upsert(value,options){this.method='upsert';this.value=value;this.upsertOptions=options;return this;}
 delete(){this.method='delete';return this;}
 single(){this.one=true;return this;}
 maybeSingle(){this.one=true;return this;}
 then(ok,bad){return Promise.resolve().then(()=>reply(this)).then(ok,bad);}
}
function reply(q){
 calls.push({type:'query',table:q.table,method:q.method,fields:q.fields,ops:q.ops,value:q.value,options:q.options});
 let data=[];
 if(q.table==='eso_reports')data=q.one?r:[];
 if(q.table==='employees')data=q.one?me:[];
 if(q.table==='plants')data=q.one&&(q.ops.find(o=>o[0]==='eq'&&o[1]==='id')?.[2]===id(30))?{id:id(30),company_id:me?.company_id}:null;
 if(q.table==='locations')data=q.one?{id:id(40),plant_id:id(30),company_id:id(20)}:[];
 if(q.table==='maintenance_tasks')data=q.one?{id:id(200)}:[];
 if(q.table==='eso_attachments'){
  data=attachments.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>q.fields==='*'||q.fields.split(',').includes(k))));
 }
 if(q.table==='eso_sessions'){
  if(q.method==='insert')sessions.push({...q.value,id:crypto.randomUUID(),revoked_at:null});
  const token=q.ops.find(o=>o[0]==='eq'&&o[1]==='token_hash')?.[2];
  if(q.method==='update')sessions.filter(s=>s.token_hash===token).forEach(s=>Object.assign(s,q.value));
  data=sessions.find(s=>s.token_hash===token&&!s.revoked_at&&new Date(s.expires_at)>new Date())||null;
 }
 if(q.method==='insert'&&q.table==='employees')data={id:id(2)};
 if(q.method==='insert'&&q.table==='eso_reports')data={id:r.id,report_no:r.report_no};
 return {data,error:null,count:Array.isArray(data)?data.length:1};
}
const db={from:t=>new Query(t),rpc:async(name,args)=>{calls.push({type:'rpc',name,args});return {data:name==='eso_consume_login_limit_v622'?rateAllowed:rpcData,error:rpcError};},storage:{from:bucket=>({
 upload:async(p,data,options)=>{calls.push({type:'upload',path:p,options});return {error:null};},
 remove:async(paths)=>{calls.push({type:'remove',paths});return {error:null};},
 createSignedUrls:async(paths,seconds)=>{calls.push({type:'sign',paths,seconds});return {data:paths.map(p=>({path:p,signedUrl:'https://synthetic.invalid/'+p})),error:null};}
})}};
const policy=()=>load('lib/eso-policy.ts');
const helpers={db,sessionUser:async()=>me,platformOwnerSession:async()=>null,
 canAdmin:role=>['admin','super_admin'].includes(role),isSuperAdmin:role=>role==='super_admin',
 canMaintain:role=>['maintenance','supervisor','management','admin','super_admin'].includes(role),
 canViewAll:role=>['management','admin','super_admin'].includes(role),canManageLocations:role=>['admin','super_admin'].includes(role),
 targetPlant:async(m,p)=>{const x=m.role==='super_admin'&&p?p:m.plant_id;return x===id(30)?x:null;},scopePlant:(q,m,f='plant_id')=>m.role==='super_admin'?q:q.eq(f,m.plant_id),
 loginAllowed:async()=>rateAllowed,roleName:role=>role,setSession:async()=>{},setPlatformSession:async()=>{},clearSession:async()=>{},clearPlatformSession:async()=>{},
 notify:async()=>{},notifyRoles:async()=>{}};
function load(file,actualServer=false){
 const key=file+(actualServer?'actual':'');if(cache[key])return cache[key];
 const mod={exports:{}};cache[key]=mod.exports;
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const requireMock=n=>{
  if(n==='server-only')return {};
  if(n==='@/lib/server'||n==='./server')return helpers;
  if(n==='@/lib/eso-mutations')return load('lib/eso-mutations.ts');
  if(n==='@/lib/eso-policy'||n==='./eso-policy')return policy();
  if(n==='@/lib/push')return {sendPushToUsers:async()=>({sent:0})};
  if(n==='next/headers')return {cookies:async()=>({get:n=>cookieJar[n]?{value:cookieJar[n]}:undefined,set:(n,v)=>{cookieJar[n]=v;},delete:n=>delete cookieJar[n]})};
  if(n==='@supabase/supabase-js')return {createClient:()=>db};
  if(n.startsWith('@/'))return load(n.slice(2)+'.ts');
  if(n.startsWith('.')){const relative=path.relative(root,path.resolve(root,path.dirname(file),n))+'.ts';if(fs.existsSync(path.join(root,relative)))return load(relative);}
  return localRequire(n);
 };
 vm.runInNewContext(code,{exports:mod.exports,module:mod,require:requireMock,Buffer,crypto,process,console,File,FormData,Request,Response,URL,setTimeout,clearTimeout},{filename:path.join(root,file)});
 return mod.exports;
}
function req(method='POST',body={}){return new NextRequest('http://review.invalid/api?reportId='+r.id,{method,...(method==='GET'?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})});}
async function record(name,kind,run){reset();await run();findings.push({name,status:'PASS'});console.log('PASS: '+name);}
async function mutate(action,body={}){return load('lib/eso-mutations.ts').mutateReport(req('POST',{reportId:r.id,version:r.revision,action,...body}),'take');}
async function main(){
 await record('31 protected API methods reject requests without a session','control',async()=>{
  const publicPaths=new Set(['api/login','api/platform/login','api/logout','api/platform/logout','api/push/public-key','api/cron/reminders']);let count=0;
  for(const file of walk(path.join(root,'app/api')).filter(x=>x.endsWith('route.ts'))){const rel=path.relative(path.join(root,'app'),path.dirname(file)).replaceAll(path.sep,'/');if(publicPaths.has(rel))continue;const exports=load(path.relative(root,file));me=null;for(const method of ['GET','POST','PATCH','DELETE'])if(exports[method]){const result=await exports[method](req(method));assert.ok([401,403].includes(result.status),file+' '+method);count++;}}
  assert.equal(count,32);
 });
 await record('missing migration fails closed and does not write directly','control',async()=>{rpcError={code:'PGRST202',message:'Missing RPC'};const res=await mutate('take');assert.equal(res.status,503);assert.equal(calls.filter(x=>['insert','upsert','update','delete'].includes(x.method)).length,0);});
 await record('resolver cannot steal assigned task or assign to somebody else','control',async()=>{r.maintenance_tasks=[{assigned_to:id(2)}];assert.equal((await mutate('take')).status,403);assert.equal((await mutate('assign',{assignedTo:id(2)})).status,403);assert.equal(calls.filter(x=>x.type==='rpc').length,0);});
 await record('resolver cannot complete another worker task or reopen closed ESO','control',async()=>{r.maintenance_tasks=[{assigned_to:id(2)}];assert.equal((await mutate('complete',{correctiveAction:'Test'})).status,403);r.status='closed';assert.equal((await mutate('take')).status,409);});
 await record('stale client version rejected before storage/RPC','control',async()=>{me.role='management';assert.equal((await mutate('edit',{version:1,description:'Stale edit'})).status,409);assert.equal(calls.filter(x=>x.type==='rpc'||x.type==='upload').length,0);});
 await record('current client version is forwarded to the transaction','control',async()=>{me.role='management';const res=await mutate('edit',{description:'Current edit',category:'environmental',urgency:'high'});assert.equal(res.status,200);assert.equal(calls.find(x=>x.type==='rpc').args.p_expected_version,4);});
 await record('omitted additional locations are preserved in RPC payload','control',async()=>{me.role='management';await mutate('edit',{description:'Current edit'});assert.ok(!Object.hasOwn(calls.find(x=>x.type==='rpc').args.p_data,'additional_locations'));});
 await record('soft-deleted photo is neither signed nor returned','control',async()=>{attachments=[{id:id(500),storage_path:'removed.jpg',file_name:'removed.jpg',attachment_type:'report',created_at:'2026-01-01',removed_at:'2026-02-01'}];const res=await load('app/api/reports/detail/route.ts').GET(req('GET'));assert.equal(res.status,200);assert.equal((await res.json()).photos.length,0);assert.equal(calls.filter(x=>x.type==='sign').length,0);});
 await record('foreign company plant rejected on employee and location create','control',async()=>{me.role='super_admin';for(const file of ['app/api/employees/route.ts','app/api/locations/route.ts'])assert.equal((await load(file).POST(req('POST',{plantId:id(999),name:'Bad plant',employeeId:'BAD',role:'Employee'}))).status,400);assert.equal(calls.filter(x=>x.type==='rpc'||x.method==='insert').length,0);});
 await record('cron missing secret fails closed; wrong secret rejected','control',async()=>{delete process.env.CRON_SECRET;assert.equal((await load('app/api/cron/reminders/route.ts').GET(req('GET'))).status,503);process.env.CRON_SECRET='SyntheticCronOnly';assert.equal((await load('app/api/cron/reminders/route.ts').GET(req('GET'))).status,401);delete process.env.CRON_SECRET;});
 await record('multipart photos are bounded and must match MIME bytes','control',async()=>{const form=new FormData();form.set('action','edit');form.set('version','4');form.set('reportId',r.id);form.set('description','Synthetic report');form.append('files',new File(['<script>bad</script>'],'fake.png',{type:'image/png'}));me.role='management';const res=await load('lib/eso-mutations.ts').mutateReport(new Request('http://review.invalid',{method:'PATCH',body:form}),'edit');assert.equal(res.status,400);assert.equal(calls.filter(x=>x.type==='upload').length,0);});
 await record('failed database transaction cleans up uploaded objects','control',async()=>{me.role='management';const form=new FormData();form.set('action','edit');form.set('version','4');form.set('reportId',r.id);form.set('description','Synthetic report');form.append('files',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUg==','base64')],'valid.png',{type:'image/png'}));rpcError={code:'40001',message:'Conflict'};const res=await load('lib/eso-mutations.ts').mutateReport(new Request('http://review.invalid',{method:'PATCH',body:form}),'edit');assert.equal(res.status,409);assert.equal(calls.filter(x=>x.type==='upload').length,1);assert.equal(calls.filter(x=>x.type==='remove').length,1);});
 await record('login rate limit blocks credential verification','control',async()=>{rateAllowed=false;const res=await load('app/api/login/route.ts').POST(req('POST',{employeeId:'TEST'}));assert.equal(res.status,429);assert.equal(calls.filter(x=>x.type==='rpc').length,0);});
 await record('login selects tenant-safe RPC, never the LIMIT 1 shortcut','control',async()=>{rpcData=[{...me,employee_no:'TEST',first_name:'Test',last_name:'User'}];const res=await load('app/api/login/route.ts').POST(req('POST',{employeeId:'TEST',companyCode:'TEST-A'}));assert.equal(res.status,200);assert.equal(calls.find(x=>x.type==='rpc').name,'verify_eso_login_tenant');});
 const setup=()=>{process.env.APP_SESSION_SECRET='SyntheticSessionSecretWithMoreThan32Bytes';process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54399';process.env.SUPABASE_SECRET_KEY='SyntheticKeyOnly';return load('lib/server.ts',true);};
 await record('actual session is random, server-stored and invalid after logout','control',async()=>{const server=setup();await server.setSession(me.id);const token=cookieJar.eso_session;assert.match(token,/^[0-9a-f]{64}$/);assert.ok(await server.sessionUser());assert.equal(sessions[0].token_hash.length,64);assert.notEqual(sessions[0].token_hash,token);await server.clearSession();cookieJar.eso_session=token;assert.equal(await server.sessionUser(),null);});
 await record('actual session rejects server-expired or deactivated-tenant cookies','control',async()=>{const server=setup();await server.setSession(me.id);me.companies.active=false;assert.equal(await server.sessionUser(),null);me.companies.active=true;me.plants.active=false;assert.equal(await server.sessionUser(),null);me.plants.active=true;sessions[0].expires_at=new Date(Date.now()-1000).toISOString();assert.equal(await server.sessionUser(),null);});
 await record('malformed Unicode session is rejected without an exception','control',async()=>{const server=setup();cookieJar.eso_session='é'.repeat(64);assert.equal(await server.sessionUser(),null);assert.equal(calls.filter(x=>x.table==='eso_sessions').length,0);});
 await record('Owner session is revoked by logout or credential change','control',async()=>{const server=setup();process.env.PLATFORM_OWNER_ID='synthetic-owner';process.env.PLATFORM_OWNER_PASSWORD='SyntheticOwnerPassword';await server.setPlatformSession('env-owner');const token=cookieJar.eso_platform_session;assert.equal((await server.platformOwnerSession()).id,'env-owner');process.env.PLATFORM_OWNER_PASSWORD='ChangedOwnerPassword';assert.equal(await server.platformOwnerSession(),null);process.env.PLATFORM_OWNER_PASSWORD='SyntheticOwnerPassword';await server.clearPlatformSession();cookieJar.eso_platform_session=token;assert.equal(await server.platformOwnerSession(),null);delete process.env.PLATFORM_OWNER_ID;delete process.env.PLATFORM_OWNER_PASSWORD;});
 await record('actual server validates selected company and active plant','control',async()=>{const server=setup();me.role='super_admin';assert.equal(await server.targetPlant(me,id(999)),null);assert.equal(await server.targetPlant(me,id(30)),id(30));assert.ok(calls.filter(x=>x.table==='plants').every(x=>x.ops.some(o=>o[0]==='eq'&&o[1]==='company_id'&&o[2]===me.company_id)));});
 await record('VoE reclassification uses one RPC and returns failures','control',async()=>{me.role='management';rpcError={code:'23514',message:'Invalid data'};assert.equal((await load('app/api/reclassify/route.ts').POST(req('POST',{esoId:r.id,version:4,reason:'Synthetic reason'}))).status,400);assert.equal(calls.filter(x=>x.type==='rpc').length,1);assert.equal(calls.filter(x=>['insert','update'].includes(x.method)).length,0);});
 console.log(`API CHECKS: ${findings.length} passed; ${32} protected methods verified; no production writes.`);
}
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.join(p,d.name)]);}
reset();main().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1;});
