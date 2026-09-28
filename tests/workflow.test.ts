import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { runInNewContext } from 'node:vm';
import { canReadReport,canEditReport,canEditCompletion,canonicalCategory,canonicalUrgency } from '../lib/eso-policy';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('service worker never intercepts private API or Storage responses',()=>{
 const handlers:Record<string,Function>={};
 runInNewContext(readFileSync('public/sw.js','utf8'),{self:{location:{origin:'https://eso.example'},addEventListener:(name:string,fn:Function)=>handlers[name]=fn},URL});
 for(const url of ['https://eso.example/api/data','https://eso.example/api/reports/detail?reportId=1','https://project.supabase.co/storage/v1/object/sign/private/photo']){
  let intercepted=false;handlers.fetch({request:{method:'GET',url},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
 }
});
test('canonical values and scope predicates',()=>{
 assert.equal(canonicalCategory('Okoliš'),'environmental');assert.equal(canonicalCategory('Medio ambiente'),'environmental');assert.equal(canonicalUrgency('Kritična'),'critical');
 const actor={id:id(1),company_id:id(20),plant_id:id(30),role:'employee'},r={reporter_id:id(1),company_id:id(20),plant_id:id(30)};
 assert.ok(canEditReport(actor,r));assert.ok(!canReadReport(actor,{...r,reporter_id:id(2)}));assert.ok(!canReadReport({...actor,role:'super_admin'},{...r,company_id:id(21)}));
 assert.ok(!canReadReport({...actor,role:'management'},{...r,plant_id:id(31)}));assert.ok(!canEditCompletion({...actor,role:'maintenance'},r,{assigned_to:id(2),completed_by:id(2)}));
});

test('SQL migration and transactional ESO workflows',async(t)=>{
 const db=new PGlite();
 // Isolated synthetic fixture matching the columns/constraints used in the live V6.1.5 schema.
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create table companies(id uuid primary key);
 create table plants(id uuid primary key,company_id uuid references companies,active boolean default true);
 create table employees(id uuid primary key,company_id uuid references companies,plant_id uuid references plants,role text,active boolean default true,first_name text,last_name text);
 create table locations(id uuid primary key,company_id uuid references companies,plant_id uuid references plants,active boolean default true);
 create table eso_reports(id uuid primary key default gen_random_uuid(),report_no text default 'ESO-TEST',company_id uuid references companies,plant_id uuid references plants,reporter_id uuid references employees,location_id uuid references locations,description text,category text check(category in ('safety','environmental')),urgency text check(urgency in ('low','medium','high','critical')),status text default 'open' check(status in ('open','assigned','in_progress','waiting','completed','closed')),reclassified_to_voe boolean default false,reported_at timestamptz default now(),completed_at timestamptz,closed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
 create table maintenance_tasks(id uuid primary key default gen_random_uuid(),company_id uuid references companies,plant_id uuid references plants,eso_report_id uuid unique references eso_reports,assigned_to uuid references employees,assigned_by uuid references employees,status text,assigned_at timestamptz,started_at timestamptz,completed_at timestamptz,completed_by uuid references employees,completion_note text,due_at timestamptz,updated_at timestamptz default now());
 create table eso_attachments(id uuid primary key default gen_random_uuid(),company_id uuid references companies,plant_id uuid references plants,eso_report_id uuid references eso_reports,storage_path text,file_name text,mime_type text,attachment_type text check(attachment_type in ('report','completion','corrective_action')),uploaded_by uuid references employees,created_at timestamptz default now());
 create table corrective_actions(id uuid primary key default gen_random_uuid(),company_id uuid references companies,plant_id uuid references plants,eso_report_id uuid references eso_reports,maintenance_task_id uuid references maintenance_tasks,action_text text,created_by uuid references employees,created_at timestamptz default now());
 create table eso_status_history(id bigint generated always as identity primary key,company_id uuid references companies,plant_id uuid references plants,eso_report_id uuid references eso_reports,old_status text,new_status text,changed_by uuid references employees,note text,changed_at timestamptz default now());
 grant usage on schema public to service_role,anon,authenticated;
 grant all on all tables in schema public to service_role;grant all on all sequences in schema public to service_role;
 insert into companies values('${id(20)}'),('${id(21)}');
 insert into plants(id,company_id) values('${id(30)}','${id(20)}'),('${id(31)}','${id(20)}'),('${id(32)}','${id(21)}');
 insert into employees(id,company_id,plant_id,role) values
 ('${id(1)}','${id(20)}','${id(30)}','employee'),('${id(2)}','${id(20)}','${id(30)}','maintenance'),('${id(3)}','${id(20)}','${id(30)}','supervisor'),('${id(4)}','${id(20)}','${id(30)}','management'),('${id(5)}','${id(20)}','${id(30)}','admin'),('${id(6)}','${id(20)}','${id(30)}','super_admin'),('${id(7)}','${id(20)}','${id(31)}','maintenance'),('${id(8)}','${id(21)}','${id(32)}','super_admin'),('${id(9)}','${id(20)}','${id(30)}','employee');
 insert into locations(id,company_id,plant_id) values('${id(40)}','${id(20)}','${id(30)}'),('${id(41)}','${id(20)}','${id(30)}'),('${id(42)}','${id(20)}','${id(31)}');
 `);
 await db.exec(readFileSync('supabase/migrations/20260928183757_eso_v621_editing_photos_locations.sql','utf8'));
 const base={plant_id:id(30),location_id:id(40),additional_locations:[id(41)],description:'Leaking equipment',urgency:'high',category:'safety',photos:[],remove_photos:[]};
 const call=async(actor:number,report:number,action:string,version:number|null,data:any={})=>{const result=await db.query<{result:any}>('select public.eso_mutate_v621($1,$2,$3,$4,$5::jsonb) as result',[id(actor),id(report),action,version,JSON.stringify(data)]);return result.rows[0].result;};
 const row=async(report:number)=>(await db.query<any>('select * from eso_reports where id=$1',[id(report)])).rows[0];
 const task=async(report:number)=>(await db.query<any>('select * from maintenance_tasks where eso_report_id=$1',[id(report)])).rows[0];
 const reject=async(p:Promise<any>,message:RegExp)=>assert.rejects(p,message);
 const photo=(report:number,name:string)=>({storage_path:`${id(20)}/${id(30)}/${id(report)}/${name}.jpg`,file_name:`${name}.jpg`,mime_type:'image/jpeg'});
 await db.exec('set role service_role');
 await t.test('create with multiple photos and additional location',async()=>{await call(1,100,'create',null,{...base,photos:[photo(100,'a'),photo(100,'b')]});assert.equal((await row(100)).revision,1);assert.equal((await db.query('select * from eso_attachments')).rows.length,2);});
 await t.test('reject cross-company, cross-plant and another author edits',async()=>{await reject(call(8,100,'edit',1,base),/scope/);await reject(call(7,100,'edit',1,base),/scope/);await reject(call(9,100,'edit',1,base),/cannot edit/);await reject(call(1,100,'edit',1,{...base,additional_locations:[id(42)]}),/report plant/);assert.equal((await row(100)).revision,1);});
 await t.test('invalid canonical values roll back',async()=>{await reject(call(1,100,'edit',1,{...base,category:'Okoliš'}),/canonical/);assert.equal((await row(100)).revision,1);});
 await t.test('edit audit and original timestamp',async()=>{const reported=(await row(100)).reported_at;await call(1,100,'edit',1,{...base,description:'Updated equipment description'});assert.equal(String((await row(100)).reported_at),String(reported));const e=(await db.query<any>("select * from eso_audit_events where action='edit'")).rows[0];assert.equal(e.old_values.report.description,base.description);assert.equal(e.new_values.report.description,'Updated equipment description');});
 await t.test('stale version rejects second writer',async()=>{await reject(call(1,100,'edit',1,base),/changed/);});
 await t.test('employee cannot resolve',async()=>{await reject(call(1,100,'complete',2,{correctiveAction:'Fixed'}),/Resolver/);});
 await t.test('maintenance self-take then prevent stealing',async()=>{await call(2,100,'take',2);await reject(call(3,100,'take',3),/another user/);await reject(call(5,100,'take',3),/another user/);assert.equal((await task(100)).assigned_to,id(2));});
 await t.test('invalid photo causes task/report/audit rollback',async()=>{await reject(call(2,100,'complete',3,{correctiveAction:'Fixed',photos:[{...photo(100,'bad'),storage_path:'another-company/file.jpg'}]}),/metadata/);assert.equal((await row(100)).status,'in_progress');assert.equal((await task(100)).status,'in_progress');});
 await t.test('complete with multiple after photos atomically',async()=>{await call(2,100,'complete',3,{correctiveAction:'Fixed safely',photos:[photo(100,'after1'),photo(100,'after2')]});assert.equal((await task(100)).completed_by,id(2));assert.equal((await row(100)).status,'completed');});
 await t.test('completed report cannot be taken or assigned',async()=>{await reject(call(3,100,'take',4),/already completed/);await reject(call(5,100,'assign',4,{assignedTo:id(3),dueAt:'2099-01-01'}),/already completed/);});
 await t.test('completion edit preserves resolver and date; unrelated manager denied',async()=>{const old=await task(100);await reject(call(4,100,'edit_completion',4,{correctiveAction:'Changed'}),/Only the assignee/);await call(2,100,'edit_completion',4,{correctiveAction:'Fixed and checked'});const edited=await task(100);assert.equal(edited.completed_by,old.completed_by);assert.equal(String(edited.completed_at),String(old.completed_at));});
 await t.test('author edits before photo without removing after photo',async()=>{const pics=await db.query<any>("select * from eso_attachments where eso_report_id=$1 and attachment_type='completion'",[id(100)]);await reject(call(1,100,'edit',5,{...base,remove_photos:[pics.rows[0].id]}),/Invalid photo/);const before=(await db.query<any>("select * from eso_attachments where eso_report_id=$1 and attachment_type='report'",[id(100)])).rows[0];await call(1,100,'edit',5,{...base,remove_photos:[before.id],photos:[photo(100,'replacement')]});assert.ok((await db.query<any>('select removed_at from eso_attachments where id=$1',[before.id])).rows[0].removed_at);});
 await t.test('management and supervisor self-resolve without assignment',async()=>{for(const actor of [3,4]){await call(actor,100+actor,'create',null,base);await call(actor,100+actor,'complete',1,{correctiveAction:'Immediately fixed'});assert.equal((await task(100+actor)).assigned_to,id(actor));assert.equal((await task(100+actor)).completed_by,id(actor));}});
 await t.test('admin completion retains assigned worker separately',async()=>{await call(1,110,'create',null,base);await call(5,110,'assign',1,{assignedTo:id(2),dueAt:'2099-01-01'});await call(5,110,'complete',2,{correctiveAction:'Verified completion'});assert.equal((await task(110)).assigned_to,id(2));assert.equal((await task(110)).completed_by,id(5));await call(2,110,'edit_completion',3,{correctiveAction:'Worker correction'});assert.equal((await task(110)).completed_by,id(5));});
 await t.test('photo limit rolls back newly created report',async()=>{await reject(call(1,120,'create',null,{...base,photos:Array.from({length:9},(_,i)=>photo(120,String(i)))}),/Maximum 8/);assert.equal(await row(120),undefined);});
 await t.test('primary duplicate and cross-plant creation rejected',async()=>{await reject(call(1,121,'create',null,{...base,additional_locations:[id(40)]}),/distinct additional/);await reject(call(1,121,'create',null,{...base,plant_id:id(31)}),/Invalid plant/);});
  await t.test('audit is append-only for server role',async()=>{await assert.rejects(db.exec("update eso_audit_events set action='tampered'"),/permission denied|append-only/);await assert.rejects(db.exec('delete from eso_audit_events'),/permission denied|append-only/);});
 await t.test('legacy completion with no recorded worker does not grant manager editing rights',async()=>{
  await call(1,130,'create',null,base);await call(5,130,'complete',1,{correctiveAction:'Legacy completion'});
  await db.query('update maintenance_tasks set assigned_to=null,completed_by=null where eso_report_id=$1',[id(130)]);
  await reject(call(4,130,'edit_completion',2,{correctiveAction:'Unrelated correction'}),/Only the assignee/);
  await call(5,130,'edit_completion',2,{correctiveAction:'Admin correction'});assert.equal((await task(130)).completed_by,null);
 });
 await t.test('anonymous and authenticated users cannot call privileged RPC or read audit',async()=>{for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await reject(call(5,100,'edit',6,base),/permission denied/);await assert.rejects(db.exec('select * from eso_audit_events'),/permission denied/);}});
 await db.close();
});
