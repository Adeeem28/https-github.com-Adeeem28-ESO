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
let me,r,calls,rpcError,rpcData,attachments,cookieJar,cache,sessions,rateAllowed,huntEvents;
const findings=[];
function reset(role='maintenance'){
 me={id:id(1),role,company_id:id(20),plant_id:id(30),active:true,companies:{active:true},plants:{active:true,company_id:id(20)}};
 r={id:id(100),report_no:'ESO-SYNTHETIC',company_id:id(20),plant_id:id(30),reporter_id:id(9),revision:4,category:'safety',urgency:'medium',status:'open',reclassified_to_voe:false,maintenance_tasks:[]};
 sessions=[];huntEvents=[];rateAllowed=true;calls=[];rpcError=null;rpcData={id:r.id,report_no:r.report_no,revision:5};attachments=[];cookieJar={};cache={};
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
 if(q.table==='voe_reports'){calls.push({type:'query',table:q.table,method:q.method,fields:q.fields,ops:q.ops,value:q.value});if(q.method==='insert')return {data:{id:id(200)},error:null};if(q.one)return {data:q.method==='update'?(q.ops.some(o=>o[1]==='updated_at'&&o[2]==='2026-01-01T00:00:00Z')?{id:id(200)}:null):{id:id(200),status:'new',updated_at:'2026-01-01T00:00:00Z'},error:null};return {data:[],error:null};}

 calls.push({type:'query',table:q.table,method:q.method,fields:q.fields,ops:q.ops,value:q.value,options:q.options});
 let data=[];
 if(q.table==='eso_hunt_events')data=huntEvents;
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
 return {data,error:null,count:q.options?.head?1205:(Array.isArray(data)?data.length:1)};
}
const db={from:t=>new Query(t),rpc:async(name,args)=>{calls.push({type:'rpc',name,args});return {data:name==='eso_consume_login_limit_v622'?rateAllowed:name==='eso_metrics_v628'?{year:2027,currentMonth:10,reporters:[],resolvers:[],monthly:[],closureRates:{},plants:[]}:rpcData,error:rpcError};},storage:{from:bucket=>({
 upload:async(p,data,options)=>{calls.push({type:'upload',path:p,options});return {error:null};},
 remove:async(paths)=>{calls.push({type:'remove',paths});return {error:null};},
 createSignedUrls:async(paths,seconds)=>{calls.push({type:'sign',paths,seconds});return {data:paths.map(p=>({path:p,signedUrl:'https://synthetic.invalid/'+p})),error:null};}
})}};
const policy=()=>load('lib/eso-policy.ts');
const helpers={db,sessionUser:async()=>me,platformOwnerSession:async()=>null,passwordSetupRequired:async()=>false,finishPasswordSetup:async()=>({data:null,error:null}),
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
 await record('37 protected API methods reject requests without a session','control',async()=>{
  const publicPaths=new Set(['api/login','api/platform/login','api/logout','api/platform/logout','api/push/public-key','api/cron/reminders','api/profile/password/setup']);let count=0;
  for(const file of walk(path.join(root,'app/api')).filter(x=>x.endsWith('route.ts'))){const rel=path.relative(path.join(root,'app'),path.dirname(file)).replaceAll(path.sep,'/');if(publicPaths.has(rel))continue;const exports=load(path.relative(root,file));me=null;for(const method of ['GET','POST','PATCH','DELETE'])if(exports[method]){const result=await exports[method](req(method));assert.ok([401,403].includes(result.status),file+' '+method);count++;}}
 assert.equal(count,37);
 });
 await record('ESO star writes through the multi-vote RPC','control',async()=>{me.role='management';const result=await load('app/api/reports/star/route.ts').POST(req('POST',{reportId:r.id,starred:true}));assert.equal(result.status,200);const call=calls.find(x=>x.type==='rpc');assert.equal(call.name,'eso_toggle_star_v625');assert.equal(call.args.p_actor,me.id);assert.equal(call.args.p_report,r.id);assert.equal(call.args.p_starred,true);});
 await record('bulk annual target update is scoped and leaves inactive users alone','control',async()=>{
  me.role='admin';
  const result=await load('app/api/employees/bulk-target/route.ts').POST(req('POST',{target:24}));
  assert.equal(result.status,200);
  const update=calls.find(x=>x.table==='employees'&&x.method==='update');
  assert.ok(update);
  assert.ok(update.ops.some(o=>o[0]==='eq'&&o[1]==='company_id'&&o[2]===me.company_id));
  assert.ok(update.ops.some(o=>o[0]==='eq'&&o[1]==='active'&&o[2]===true));
  assert.ok(update.ops.some(o=>o[0]==='not'&&o[1]==='role'&&o[2]==='eq'&&o[3]==='super_admin'));
  assert.ok(update.ops.some(o=>o[0]==='eq'&&o[1]==='plant_id'&&o[2]===me.plant_id));
  reset('super_admin');
  const invalid=await load('app/api/employees/bulk-target/route.ts').POST(req('POST',{target:-1}));
  assert.equal(invalid.status,400);
  assert.equal(calls.filter(x=>x.table==='employees'&&x.method==='update').length,0);
 });
 await record('ESO Hunt GET is tenant-scoped and returns an empty season safely','control',async()=>{const result=await load('app/api/hunt/route.ts').GET(req('GET'));assert.equal(result.status,200);const body=await result.json();assert.equal(body.event,null);assert.deepEqual(body.events,[]);assert.deepEqual(body.annualLeaderboard,[]);});



 await record('elapsed Hunt GET derives review status without writing to the database','control',async()=>{
  huntEvents=[{id:id(500),company_id:me.company_id,status:'live',ends_at:'2001-01-01T00:00:00Z'}];
  const response=await load('app/api/hunt/route.ts').GET();assert.equal(response.status,200);
  assert.equal((await response.json()).event.status,'review');
  assert.equal(calls.filter(x=>['insert','update','delete'].includes(x.method)).length,0);
 });
 await record('dashboard retains tenant filters and uses scoped database metrics','control',async()=>{
  me.role='employee';const response=await load('app/api/data/route.ts').GET();assert.equal(response.status,200);
  const reads=calls.filter(x=>x.type==='query');assert.ok(reads.length>=5);
  for(const q of reads)assert.ok(q.ops.some(o=>o[0]==='eq'&&o[1]==='company_id'&&o[2]===me.company_id),q.table);
  assert.ok(calls.some(x=>x.type==='rpc'&&x.name==='eso_metrics_v628'&&x.args.p_actor===me.id));
  const reports=reads.find(x=>x.table==='eso_reports'&&x.fields.includes('eso_attachments'));
  assert.ok(reports.ops.some(o=>o[0]==='eq'&&o[1]==='reporter_id'&&o[2]===me.id));
  assert.ok(!reports.fields.includes('storage_path'));
  assert.ok(reports.ops.some(o=>o[0]==='limit'&&o[1]===10),'bootstrap is bounded to ten full reports');
  assert.ok(!reports.ops.some(o=>o[0]==='range'),'bootstrap does not page through history');
  const body=await response.json();assert.equal(body.dashboard.ytd,1205);assert.equal(body.dashboard.completed,1205);
  for(const count of reads.filter(q=>q.options?.head)){
    assert.ok(count.ops.some(o=>o[0]==='eq'&&o[1]==='reporter_id'&&o[2]===me.id));
    assert.ok(count.ops.some(o=>o[0]==='eq'&&o[1]==='plant_id'&&o[2]===me.plant_id));
  }
  const overdue=reads.find(q=>q.options?.head&&q.fields.includes('maintenance_tasks'));
  assert.ok(overdue.ops.some(o=>o[0]==='not'&&o[1]==='status'&&o[3]==='(completed,closed)'));
 });

 await record('lazy history and single-report notification reads stay tenant and author scoped','control',async()=>{
  me.role='employee';const route=load('app/api/reports/history/route.ts');
  const response=await route.GET(new Request('http://test/api/reports/history?id='+id(100)));assert.equal(response.status,200);
  const query=calls.find(c=>c.table==='eso_reports');
  for(const [key,value] of [['company_id',me.company_id],['plant_id',me.plant_id],['reporter_id',me.id],['id',id(100)]])assert.ok(query.ops.some(o=>o[0]==='eq'&&o[1]===key&&o[2]===value));
  const before=calls.length;
  assert.equal((await route.GET(new Request('http://test/api/reports/history?id=bad'))).status,400);assert.equal(calls.length,before);
 });
 await record('report paging binds actor and rejects invalid dates/pages','control',async()=>{
  const route=load('app/api/reports/page/route.ts');rpcData={ids:[],total:0};
  assert.equal((await route.GET(new Request('http://test/api/reports/page?page=2&mine=true&q=warehouse'))).status,200);
  const rpc=calls.find(x=>x.type==='rpc');assert.equal(rpc.name,'eso_report_page_v628');assert.equal(rpc.args.p_actor,me.id);assert.equal(rpc.args.p_offset,0);assert.equal(rpc.args.p_limit,1);assert.equal(calls.filter(x=>x.type==='rpc').length,4);assert.equal(rpc.args.p_filter.mine,true);
  for(const query of ['page=-1','page=1.2','from=2026-02-30','from=2026-02-10&to=2026-01-01'])assert.equal((await route.GET(new Request('http://test/api/reports/page?'+query))).status,400);
 });
 await record('Hunt transitions call one scoped transaction and surface state conflicts','control',async()=>{
  me.role='super_admin';const route=load('app/api/hunt/route.ts');
  for(const action of ['start','cancel','finalize','review']){
   calls=[];const response=await route.POST(req('POST',{action,eventId:id(500),submissionId:id(501),reviewStatus:'accepted',actorId:id(999)}));
   assert.equal(response.status,200);const rpc=calls.find(x=>x.type==='rpc');
   assert.equal(rpc.name,'eso_transition_hunt_v627');assert.equal(rpc.args.p_actor,me.id);assert.equal(rpc.args.p_event,id(500));
   assert.equal(calls.filter(x=>['insert','update','delete'].includes(x.method)).length,0);
  }
  rpcError={code:'P0001',message:'Review every Hunt submission before finalizing'};
  assert.equal((await route.POST(req('POST',{action:'finalize',eventId:id(500)}))).status,409);
  rpcError={code:'PGRST202',message:'Missing RPC'};
  assert.equal((await route.POST(req('POST',{action:'start',eventId:id(500)}))).status,503);
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
 await record('login rate limit blocks credential verification','control',async()=>{rateAllowed=false;const res=await load('app/api/login/route.ts').POST(req('POST',{employeeId:'TEST',password:'SyntheticPassword123'}));assert.equal(res.status,429);assert.equal(calls.filter(x=>x.type==='rpc').length,0);});
 await record('login database failure returns service unavailable, not invalid credentials','control',async()=>{rpcError={code:'PGRST202'};const res=await load('app/api/login/route.ts').POST(req('POST',{employeeId:'TEST',password:'SyntheticPassword123'}));assert.equal(res.status,503);});
 await record('login selects tenant-safe RPC, never the LIMIT 1 shortcut','control',async()=>{rpcData={id:me.id,password_setup:false};const res=await load('app/api/login/route.ts').POST(req('POST',{employeeId:'TEST',password:'SyntheticPassword123',companyCode:'TEST-A'}));assert.equal(res.status,200);assert.equal(calls.find(x=>x.type==='rpc').name,'eso_login_v626');});
 const setup=()=>{process.env.APP_SESSION_SECRET='SyntheticSessionSecretWithMoreThan32Bytes';process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54399';process.env.SUPABASE_SECRET_KEY='SyntheticKeyOnly';return load('lib/server.ts',true);};
 await record('actual session is random, server-stored and invalid after logout','control',async()=>{const server=setup();await server.setSession(me.id);const token=cookieJar.eso_session;assert.match(token,/^[0-9a-f]{64}$/);assert.ok(await server.sessionUser());assert.equal(sessions[0].token_hash.length,64);assert.notEqual(sessions[0].token_hash,token);await server.clearSession();cookieJar.eso_session=token;assert.equal(await server.sessionUser(),null);});
 await record('setup session cannot authenticate application APIs and expires in 15 minutes','control',async()=>{
  const server=setup();await server.setSession(me.id,true);
  assert.equal(await server.sessionUser(),null);assert.equal(await server.passwordSetupRequired(),true);
  assert.ok(new Date(sessions[0].expires_at)-Date.now()<=900000);
 });
 await record('setup endpoint rejects a regular or absent session','control',async()=>{
  const route=load('app/api/profile/password/setup/route.ts');
  assert.equal((await route.GET()).status,200);
  assert.equal((await route.POST(req('POST',{newPassword:'SyntheticPassword123',confirmPassword:'SyntheticPassword123'}))).status,401);
 });
 await record('actual session rejects server-expired or deactivated-tenant cookies','control',async()=>{const server=setup();await server.setSession(me.id);me.companies.active=false;assert.equal(await server.sessionUser(),null);me.companies.active=true;me.plants.active=false;assert.equal(await server.sessionUser(),null);me.plants.active=true;sessions[0].expires_at=new Date(Date.now()-1000).toISOString();assert.equal(await server.sessionUser(),null);});
 await record('malformed Unicode session is rejected without an exception','control',async()=>{const server=setup();cookieJar.eso_session='é'.repeat(64);assert.equal(await server.sessionUser(),null);assert.equal(calls.filter(x=>x.table==='eso_sessions').length,0);});
 await record('Owner session is revoked by logout or credential change','control',async()=>{const server=setup();process.env.PLATFORM_OWNER_ID='synthetic-owner';process.env.PLATFORM_OWNER_PASSWORD='SyntheticOwnerPassword';await server.setPlatformSession('env-owner');const token=cookieJar.eso_platform_session;assert.equal((await server.platformOwnerSession()).id,'env-owner');process.env.PLATFORM_OWNER_PASSWORD='ChangedOwnerPassword';assert.equal(await server.platformOwnerSession(),null);process.env.PLATFORM_OWNER_PASSWORD='SyntheticOwnerPassword';await server.clearPlatformSession();cookieJar.eso_platform_session=token;assert.equal(await server.platformOwnerSession(),null);delete process.env.PLATFORM_OWNER_ID;delete process.env.PLATFORM_OWNER_PASSWORD;});
 await record('actual server validates selected company and active plant','control',async()=>{const server=setup();me.role='super_admin';assert.equal(await server.targetPlant(me,id(999)),null);assert.equal(await server.targetPlant(me,id(30)),id(30));assert.ok(calls.filter(x=>x.table==='plants').every(x=>x.ops.some(o=>o[0]==='eq'&&o[1]==='company_id'&&o[2]===me.company_id)));});
 await record('VoE reclassification uses one RPC and returns failures','control',async()=>{me.role='management';rpcError={code:'23514',message:'Invalid data'};assert.equal((await load('app/api/reclassify/route.ts').POST(req('POST',{esoId:r.id,version:4,reason:'Synthetic reason'}))).status,400);assert.equal(calls.filter(x=>x.type==='rpc').length,1);assert.equal(calls.filter(x=>['insert','update'].includes(x.method)).length,0);});

 await record('VOE direct submission binds session author and scope, ignoring spoofed ESO source','control',async()=>{const response=await load('app/api/voe/route.ts').POST(req('POST',{category:'other',description:'Synthetic employee suggestion',reporter_id:id(99),company_id:id(99),source_eso_report_id:r.id}));assert.equal(response.status,200);const v=calls.find(c=>c.table==='voe_reports'&&c.method==='insert').value;assert.equal(v.reporter_id,me.id);assert.equal(v.company_id,me.company_id);assert.equal(v.plant_id,me.plant_id);assert.equal(v.source_eso_report_id,undefined);});
 await record('VOE employee list is scoped and employee cannot manage status','control',async()=>{const route=load('app/api/voe/route.ts');assert.equal((await route.GET()).status,200);const q=calls.find(c=>c.table==='voe_reports');for(const [key,val]of [['company_id',me.company_id],['plant_id',me.plant_id],['reporter_id',me.id]])assert.ok(q.ops.some(o=>o[0]==='eq'&&o[1]===key&&o[2]===val));assert.equal((await route.PATCH(req('PATCH',{}))).status,403);});
 await record('VOE review preserves tenant scope and rejects stale updates','control',async()=>{me.role='management';const route=load('app/api/voe/route.ts');const body={id:id(200),category:'other',status:'Closed',adminNote:'Employee response',updatedAt:'2026-01-01T00:00:00Z'};assert.equal((await route.PATCH(req('PATCH',body))).status,200);const q=calls.find(c=>c.table==='voe_reports'&&c.method==='update');assert.equal(q.value.closed_by,me.id);assert.ok(q.ops.some(o=>o[1]==='plant_id'&&o[2]===me.plant_id));assert.equal((await route.PATCH(req('PATCH',{...body,updatedAt:'2025-01-01T00:00:00Z'}))).status,409);});
 console.log(`API CHECKS: ${findings.length} passed; ${37} protected methods verified; no production writes.`);
}
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.join(p,d.name)]);}
reset();main().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1;});


