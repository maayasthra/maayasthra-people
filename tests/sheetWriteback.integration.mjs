// Fresh in-memory database; only newly created synthetic people/worklogs. No network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
process.on('uncaughtException',e=>{console.error(e.message);console.error(e.where||e.stack?.split('\n').slice(0,3).join('\n'));process.exit(1);});
const db=new PGlite(), q=async(s,a=[]) => (await db.query(s,a)).rows;
await db.exec(`create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(),email text,last_sign_in_at timestamptz,created_at timestamptz default now());
create role anon; create role authenticated; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated;`);
for(const f of fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).sort()) await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
async function person(name,role='Employee'){
 const email='two-way-'+name+'@example.invalid';
 const id=(await q('insert into employees(email,name,role) values($1,$2,$3) returning id',[email,'Synthetic '+name,role]))[0].id;
 const uid=(await q('insert into auth.users(email) values($1) returning id',[email]))[0].id;
 return{id,uid,email};
}
const admin=await person('admin','Admin'), employee=await person('employee'), other=await person('outside'), pm=await person('manager','Project manager');
await person('second-admin','Admin');
const token='only-a-synthetic-write-token-32-characters',readToken='only-a-synthetic-export-token-32-characters';
const day=(await q('select today_ist()::text d'))[0].d,month=day.slice(0,7);
async function api(sql,args=[],role='anon'){
 await db.exec('begin; set local role '+role);
 try{const r=await q(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}
}
const snapshot=async(t=token)=>(await api('select eod_sheet_snapshot($1,$2) v',[t,month]))[0].v;
const mutate=async(o={})=>(await api('select eod_sheet_mutate($1,$2,$3,$4,$5,$6,$7,$8,$9) v',[
 o.token??token,o.request??randomUUID(),o.action??'create',o.employee??employee.id,o.day??day,o.revision??'0',o.main??null,o.sub??null,
 JSON.stringify(o.fields??{project:'Synthetic project',desc:'Synthetic work only',hours:2})]))[0].v;
const report=async(id=employee.id)=>(await q('select * from eod_reports where employee_id=$1 and day=$2',[id,day]))[0];
const revision=async(id=employee.id)=>(await snapshot()).revisions[id+'/'+day]??'0';
await test('disabled by default and no credential accepts writes',async()=>{await assert.rejects(snapshot(),/Not allowed/);await assert.rejects(mutate(),/Not allowed/);});
await q("insert into eod_sheet_config(token_hash,owner_id,allowed_employee_ids) values(encode(sha256(convert_to($1,'UTF8')),'hex'),$2,$3)",[token,admin.uid,[employee.id,pm.id]]);
await test('inactive credential and existing read-only export token cannot write',async()=>{
 await assert.rejects(mutate(),/Not allowed/);
 await q('update eod_sheet_config set active=true');
 await q("insert into eod_export_config(id,token_hash) values(1,encode(sha256(convert_to($1,'UTF8')),'hex'))",[readToken]);
 await assert.rejects(mutate({token:readToken}),/Not allowed/);
 await assert.rejects(mutate({token:'x'.repeat(513)}),/Not allowed/);
});
await test('scope excludes unrelated synthetic worklogs and directory entries',async()=>{
 await q('insert into eod_reports(employee_id,day,rows,total_hours) values($1,$2,$3,1)',[other.id,day,JSON.stringify([{project:'Outside',desc:'Must remain untouched',hours:1}])]);
 const s=await snapshot();assert(!s.employees.some(e=>e.id===String(other.id)));assert(!s.reports.some(e=>e.employee_id===String(other.id)));
 await assert.rejects(mutate({employee:other.id}),/Not allowed/);
});
let first;
await test('create report, audit and exact lost-response retry',async()=>{
 const request=randomUUID();first=await mutate({request});
 assert.equal((await report()).total_hours,'2.00');assert.equal((await report()).rows[0].desc,'Synthetic work only');
 assert.deepEqual(await mutate({request}),first);
 assert.equal((await q('select count(*)::int n from eod_sheet_audit'))[0].n,1);
 await assert.rejects(mutate({request,fields:{project:'Changed',desc:'Changed',hours:3}}),/Request ID already/);
});
await test('app edits invalidate sheet revision; stale create/update/delete are rejected',async()=>{
 await q("update eod_reports set rows=jsonb_set(rows,'{0,desc}','\"New app description\"') where employee_id=$1",[employee.id]);
 for(const action of ['create','update','delete'])await assert.rejects(mutate({action,revision:first.revision,main:action==='create'?null:0,fields:action==='delete'?{}:{desc:'Stale'}}),/Conflict/);
});
await test('update preserves unrelated fields and other lines',async()=>{
 await q('update eod_reports set rows=$1 where employee_id=$2',[JSON.stringify([{project:'Alpha',desc:'Original',hours:2,task:'existing-task-reference',custom:'keep'},{project:'Beta',desc:'Other line',hours:1}]),employee.id]);
 await mutate({action:'update',revision:await revision(),main:0,fields:{desc:'Edited in sheet',hours:4}});
 const r=await report();assert.equal(r.rows[0].task,'existing-task-reference');assert.equal(r.rows[0].custom,'keep');assert.equal(r.rows[1].desc,'Other line');assert.equal(r.total_hours,'5.00');
});
await test('retry returns original result without overwriting intervening app change',async()=>{
 const request=randomUUID(),rev=await revision(),input={request,action:'update',revision:rev,main:0,fields:{hours:3}};
 const saved=await mutate(input);await q("update eod_reports set rows=jsonb_set(rows,'{0,desc}','\"Intervening app edit\"') where employee_id=$1",[employee.id]);
 assert.deepEqual(await mutate(input),saved);assert.equal((await report()).rows[0].desc,'Intervening app edit');
});
await test('append project to existing daily report',async()=>{
 await mutate({revision:await revision(),fields:{project:'Append',desc:'Additional work',hours:1}});
 assert.equal((await report()).rows.length,3);
});
await test('invalid shapes, indexes, fields and totals leave reports/audit unchanged',async()=>{
 const before=await report(),audit=(await q('select count(*) n from eod_sheet_audit'))[0].n;
 const inputs=[{action:'update',main:-1,fields:{hours:2}},{action:'update',main:99,fields:{hours:2}},
  {action:'update',main:0,fields:{task:'forged'}},{action:'update',main:0,fields:{hours:'2'}},
  {action:'update',main:0,fields:{project:{nested:'bad'}}},{action:'update',main:0,fields:{desc:''}},
  {action:'update',main:0,fields:{hours:0}},{action:'update',main:0,fields:{hours:24}},
  {fields:{project:'X',desc:'a'.repeat(1001),hours:2}},{fields:{project:' ',desc:'X',hours:2}},
  {action:'delete',main:0,fields:{hours:1}},{action:'create',main:0}];
 for(const o of inputs)await assert.rejects(mutate({...o,revision:await revision()}));
 assert.deepEqual(await report(),before);assert.equal((await q('select count(*) n from eod_sheet_audit'))[0].n,audit);
});
await test('seven-day editing window and future dates enforced',async()=>{
 const dates=(await q("select (today_ist()-8)::text old,(today_ist()+1)::text future"))[0];
 for(const d of Object.values(dates))await assert.rejects(mutate({day:d}),/locked/);
});
await test('manager report remains zero-hour and rejects positive-hour import',async()=>{
 await assert.rejects(mutate({employee:pm.id}),/Invalid hours/);
 const r=await mutate({employee:pm.id,fields:{project:'Manager work',desc:'Synthetic planning',hours:0}});assert.equal(r.total_hours,0);
});
await test('nested updates preserve parent/task metadata and cannot edit calculated parent hours',async()=>{
 await q('update eod_reports set rows=$1 where employee_id=$2',[JSON.stringify([{project:'Nested',desc:'Parent',hours:0,task:'keep-parent-task',subs:[{title:'A',desc:'a',hours:1},{title:'B',desc:'b',hours:2}]}]),employee.id]);
 await assert.rejects(mutate({action:'update',revision:await revision(),main:0,fields:{hours:4}}),/subtask hours/);
 await mutate({action:'update',revision:await revision(),main:0,sub:1,fields:{title:'B edited',hours:3}});
 const r=await report();assert.equal(r.rows[0].task,'keep-parent-task');assert.equal(r.rows[0].subs[0].title,'A');assert.equal(r.total_hours,'4.00');
});
await test('delete subtask, then final subtask deletes report and leaves audit/tombstone',async()=>{
 await mutate({action:'delete',revision:await revision(),main:0,sub:0,fields:{}});
 assert.equal((await report()).rows[0].subs.length,1);
 const old=await revision(),r=await mutate({action:'delete',revision:old,main:0,sub:0,fields:{}});
 assert.equal(r.deleted,true);assert.equal(await report(),undefined);assert.notEqual(await revision(),old);
 const audit=(await q('select before_report,after_report from eod_sheet_audit where request_id=$1',[r.request_id]))[0];assert(audit.before_report);assert.equal(audit.after_report,null);
});
await test('delete/recreate cannot reuse absent zero revision or stale positions',async()=>{
 await assert.rejects(mutate(),/Conflict/);
 const tombstone=await revision();await mutate({revision:tombstone});
 await assert.rejects(mutate({action:'delete',revision:tombstone,main:0,fields:{}}),/Conflict/);
});
await test('deleted parent removes nested worklogs only when explicit delete is issued',async()=>{
 await mutate({action:'delete',revision:await revision(),main:0,fields:{}});assert.equal(await report(),undefined);
});
await test('owner demotion, exit, identity mismatch, expiry and disable revoke both APIs',async()=>{
 const cases=[['update profiles set active=false where id=$1','update profiles set active=true where id=$1'],
  ["update employees set role='Employee' where email=$1","update employees set role='Admin' where email=$1"],
  ["update employees set status='Exited' where email=$1","update employees set status='Full-time' where email=$1"]];
 for(const [off,on]of cases){await q(off,[off.includes('email=')?admin.email:admin.uid]);await assert.rejects(snapshot(),/Not allowed/);await assert.rejects(mutate(),/Not allowed/);await q(on,[on.includes('email=')?admin.email:admin.uid]);}
 await q("update auth.users set email='mismatch@example.invalid' where id=$1",[admin.uid]);await assert.rejects(snapshot(),/Not allowed/);await q('update auth.users set email=$2 where id=$1',[admin.uid,admin.email]);
 await q("update eod_sheet_config set expires_at=now()-interval '1 second'");await assert.rejects(mutate(),/Not allowed/);await q("update eod_sheet_config set expires_at=now()+interval '1 day',active=false");await assert.rejects(snapshot(),/Not allowed/);await q('update eod_sheet_config set active=true');
});
await test('private configuration, audit and revision functions are inaccessible to API roles',async()=>{
 for(const role of ['anon','authenticated'])for(const sql of ['select * from eod_sheet_config','select * from eod_sheet_versions','select * from eod_sheet_audit',"select eod_sheet_authority('fake')","select nextval('eod_sheet_revision_seq')"])
  await assert.rejects(api(sql,[],role),/permission denied/);
});
await test('transaction rollback preserves report, version and audit together',async()=>{
 const rev=await revision(),audit=(await q('select count(*) n from eod_sheet_audit'))[0].n;
 await db.exec('begin');await q('select eod_sheet_mutate($1,$2,$3,$4,$5,$6,null,null,$7)',[token,randomUUID(),'create',employee.id,day,rev,JSON.stringify({project:'Rollback',desc:'Not retained',hours:1})]);await db.exec('rollback');
 assert.equal(await report(),undefined);assert.equal(await revision(),rev);assert.equal((await q('select count(*) n from eod_sheet_audit'))[0].n,audit);
});
await test('oversized snapshot and invalid allowlist fail explicitly instead of truncating',async()=>{
 await assert.rejects(q('update eod_sheet_config set allowed_employee_ids=array[null]::bigint[]'),/check constraint/);
 await db.exec('begin');
 await q("update eod_reports set rows=jsonb_build_array(jsonb_build_object('project','Synthetic large fixture','desc',repeat('x',4194305),'hours',0)) where employee_id=$1",[pm.id]);
 await assert.rejects(q('select eod_sheet_snapshot($1,$2)',[token,month]),/too large/);
 await db.exec('rollback');
 assert.equal((await snapshot()).reports.find(r=>r.employee_id===String(pm.id)).rows[0].desc,'Synthetic planning');
});
await test('unrelated synthetic fixture remains byte-for-byte untouched',async()=>{const r=await report(other.id);assert.deepEqual(r.rows,[{project:'Outside',desc:'Must remain untouched',hours:1}]);assert.equal(r.total_hours,'1.00');});
console.log(`RESULT ${count} passed`);
await db.close();
