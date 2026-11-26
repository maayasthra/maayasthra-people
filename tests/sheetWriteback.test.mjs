import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const Utilities={DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,text,charset)=>Array.from(createHash(alg).update(text,charset).digest())};
const code=fs.readFileSync(new URL('../integrations/google-sheet/TwoWay.gs',import.meta.url),'utf8');
const ctx=vm.createContext({console,Utilities});vm.runInContext(code,ctx);
const plain=x=>JSON.parse(JSON.stringify(x));
const target={action:'create',employee:'101',day:'2026-11-15',revision:'0',main:null,sub:null,hasSubs:false};
function draft(id='draft-1',t=target){const r=plain(ctx.wbDraft(t,null,id));r[0]='READY';r[4]='Project';r[6]='Work';r[7]=2;return r;}
function adapter(initial){let records=structuredClone(initial),journals={},calls=[],serial=0,hook=null;return {
 rows:()=>structuredClone(records),find:id=>{const a=records.filter(r=>r[9]===id);return a.length===1?structuredClone(a[0]):null;},
 uuid:()=>`uuid-${++serial}`,getJournal:id=>journals[id]?structuredClone(journals[id]):null,saveJournal:(id,j)=>{journals[id]=plain(j);},removeJournal:id=>{delete journals[id];},
 write:(id,v)=>{const a=records.filter(r=>r[9]===id);if(a.length!==1)return;const r=a[0];if(v.state)r[0]=v.state;if(v.status)r[8]=v.status;if(v.request)r[11]=v.request;},
 mutate:(id,v)=>{assert.ok(Object.values(journals).some(j=>j.request===id),'request must be durable before RPC');calls.push({id,payload:plain(v)});return hook?hook(id,v):{revision:'2'};},
 get records(){return records;},get journals(){return journals;},get calls(){return calls;},set hook(v){hook=v;},sort:()=>records.reverse()};}

test('snapshot flatten preserves main/sub indices, stable employee IDs and no double-counted hours',()=>{
 const rows=plain(ctx.wbFlatten({employees:[],reports:[{employee_id:'101',name:'Same',day:'2026-11-15',revision:'9',rows:[{project:'=1+1',desc:'p',hours:8,subs:[{title:'Sub',desc:'s',hours:2}]},{project:'B',desc:'b',hours:3}]}]}));
 assert.equal(rows.length,3);assert.equal(rows[0][6],'');assert.deepEqual(rows.map(r=>[r[8],r[9]]),[[0,''],[0,0],[1,'']]);assert.equal(rows[1][7],'9');
 const t=plain(ctx.wbTarget('update',rows[1]));const d=plain(ctx.wbDraft(t,rows[1],'id'));d[5]='Renamed';assert.deepEqual(plain(ctx.wbPayload(d)).p_fields,{title:'Renamed',desc:'s',hours:2});
 d[4]='Other project';assert.throws(()=>ctx.wbPayload(d),/parent/);
});
test('literal text never becomes a generated formula',()=>{for(const s of ['=1+1',' +1','@x','-1',"'x"])assert.equal(ctx.wbLiteral(s),"'"+s);assert.equal(ctx.wbLiteral('safe'),'safe');});
test('draft target mismatch rejected before HTTP',()=>{const r=draft();r[2]='202';const a=adapter([r]);ctx.wbProcess(a);assert.equal(a.calls.length,0);assert.equal(a.records[0][0],'ERROR');});
test('DRAFT rows are untouched, removing rows never creates a deletion',()=>{const r=draft();r[0]='DRAFT';const a=adapter([r]);ctx.wbProcess(a);assert.deepEqual(a.records,[r]);assert.equal(a.calls.length,0);assert.deepEqual(plain(ctx.wbProcess(adapter([]))),[]);});
test('create applies once and completed draft cannot be resubmitted as a new creation',()=>{const a=adapter([draft()]);ctx.wbProcess(a);assert.equal(a.records[0][0],'APPLIED');ctx.wbProcess(a);assert.equal(a.calls.length,1);a.records[0][0]='READY';ctx.wbProcess(a);assert.equal(a.calls.length,1);assert.equal(a.records[0][0],'ERROR');});
test('lost response retries exact request ID and immutable payload even after cell edits',()=>{const a=adapter([draft()]);a.hook=()=>{throw Error('response lost');};ctx.wbProcess(a);assert.equal(a.records[0][0],'READY');a.records[0][7]=4;a.hook=()=>({revision:'2'});ctx.wbProcess(a);assert.deepEqual(a.calls[0],a.calls[1]);assert.equal(a.records[0][7],4);assert.equal(a.records[0][0],'REVIEW');assert.equal(Object.keys(a.journals).length,0);});
test('malformed success response is retryable with the original ID',()=>{const a=adapter([draft()]);a.hook=()=>null;ctx.wbProcess(a);a.hook=()=>({revision:'2'});ctx.wbProcess(a);assert.equal(a.calls[0].id,a.calls[1].id);assert.equal(a.records[0][0],'APPLIED');});
test('concurrent cell edit during HTTP is preserved and flagged REVIEW',()=>{const a=adapter([draft()]);a.hook=()=>{a.records[0][6]='Changed during request';return {revision:'2'};};ctx.wbProcess(a);assert.equal(a.records[0][6],'Changed during request');assert.equal(a.records[0][0],'REVIEW');});
test('whole-row sorting during HTTP does not mark another draft applied',()=>{const second=draft('draft-2');second[0]='DRAFT';const a=adapter([draft(),second]);a.hook=()=>{a.sort();return {revision:'2'};};ctx.wbProcess(a);assert.equal(a.records[0][9],'draft-2');assert.equal(a.records[0][0],'DRAFT');assert.equal(a.records[1][0],'APPLIED');});
test('duplicate draft IDs never send an ambiguous command',()=>{const a=adapter([draft(),draft()]);ctx.wbProcess(a);assert.equal(a.calls.length,0);});
test('server conflict preserves all draft fields and immutable request',()=>{const r=draft(),a=adapter([r]);a.hook=()=>{const e=Error('Conflict: refresh report');e.httpStatus=400;throw e;};ctx.wbProcess(a);assert.equal(a.records[0][0],'CONFLICT');assert.deepEqual(a.records[0].slice(1,8),r.slice(1,8));assert.equal(a.journals['draft-1'],undefined);ctx.wbProcess(a);assert.equal(a.calls.length,1);});
test('delete sends no editable fields and requires the original explicit action',()=>{const r=draft('d',{...target,action:'delete',revision:'8',main:0});const p=plain(ctx.wbPayload(r));assert.deepEqual(p.p_fields,{});assert.equal(p.p_action,'delete');r[1]='CREATE';assert.throws(()=>ctx.wbPayload(r),/cannot change/);});
test('parent rows with subtasks cannot silently ignore entered hours',()=>{const r=draft('d',{...target,action:'update',revision:'8',main:0,hasSubs:true});assert.throws(()=>ctx.wbPayload(r),/subtasks/);r[7]='';assert.deepEqual(plain(ctx.wbPayload(r)).p_fields,{project:'Project',desc:'Work'});});
test('refresh updates only server views and preserves the Changes queue',()=>{
 const writes=[],c=vm.createContext({console});vm.runInContext(code,c);c.wbProps=()=>({getProperty:()=> '2026-11'});c.wbRpc=()=>({reports:[],employees:[{id:'101',name:'A',role:'Employee'}]});c.wbWriteView=(name,h,r)=>writes.push(name);c.wbRefresh();assert.deepEqual(writes,['Worklogs','People']);
});
test('copied workbook cannot use an existing connection',()=>{const c=vm.createContext({console,SpreadsheetApp:{getActiveSpreadsheet:()=>({getId:()=> 'other'})}});vm.runInContext(code,c);c.wbProps=()=>({getProperty:()=> 'bound'});assert.throws(()=>c.wbBook(),/dedicated workbook/);});
test('a later READY draft edited during an earlier request is not sent from stale batch values',()=>{const a=adapter([draft('first'),draft('second')]);a.hook=()=>{a.records[1][7]=5;return {revision:'2'};};ctx.wbProcess(a);assert.equal(a.calls.length,1);assert.equal(a.records[1][7],5);assert.equal(a.records[1][0],'REVIEW');});
test('a later draft changed to DRAFT during an earlier request is not sent',()=>{const a=adapter([draft('first'),draft('second')]);a.hook=()=>{a.records[1][0]='DRAFT';return {revision:'2'};};ctx.wbProcess(a);assert.equal(a.calls.length,1);assert.equal(a.records[1][0],'DRAFT');});

test('unicode worklog journal stays below Google property size limits',()=>{const r=draft();r[4]='😀'.repeat(200);r[6]='😀'.repeat(1000);const a=adapter([r]);a.hook=()=>{throw Error('response lost');};ctx.wbProcess(a);const j=a.journals['draft-1'];assert.equal(j.fingerprint.length,64);assert.ok(Buffer.byteLength(JSON.stringify(j))<9000);});

test('HTTP429 and408 keep immutable requests pending for a safe retry',()=>{for(const status of [429,408]){const a=adapter([draft()]);a.hook=()=>{const e=Error('Temporary failure');e.httpStatus=status;throw e;};ctx.wbProcess(a);assert.equal(a.records[0][0],'READY');a.hook=()=>({revision:'2'});ctx.wbProcess(a);assert.deepEqual(a.calls[0],a.calls[1]);assert.equal(a.records[0][0],'APPLIED');}});

test('dedicated workbook setup pins IST and keeps employee IDs and dates as plain text',()=>{
 const calls=[],sheet=new Proxy({}, {get:(_,k)=> k==='getMaxRows'?()=>1000:k==='getMaxColumns'?()=>26:k==='getProtections'?()=>[]:k==='getRange'?(...args)=>new Proxy({}, {get:(_,method)=>(...v)=>{calls.push([method,args,...v]);return sheet;}}):()=>sheet});
 const c=vm.createContext({console,SpreadsheetApp:{ProtectionType:{SHEET:'sheet'},newDataValidation:()=>new Proxy({}, {get:(_,k)=>()=>k==='build'?{}:chain})}});
 const chain={requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return {};}};c.SpreadsheetApp.newDataValidation=()=>chain;
 vm.runInContext(code,c);c.wbBook=()=>({setSpreadsheetTimeZone:z=>calls.push(['timezone',z]),getSheetByName:()=>{throw Error('Must use owned People sheet');}});c.wbSheet=()=>sheet;c.wbSetup();
 assert.ok(calls.some(x=>x[0]==='timezone'&&x[1]==='Asia/Kolkata'));assert.equal(calls.filter(x=>x[0]==='setNumberFormat'&&x[2]==='@').length,3);
});

test('adding drafts expands a full queue instead of failing at the default row limit',()=>{
 let max=1000,writeRow=0;const s={getLastRow:()=>1000,getMaxRows:()=>max,insertRowsAfter:(at,n)=>{assert.equal(at,1000);max+=n;},getRange:(r,c,n,w)=>({setNumberFormat(){},setValues(){assert.ok(r<=max);writeRow=r;}})};
 const c=vm.createContext({console,Utilities:{getUuid:()=> 'draft-capacity'}});vm.runInContext(code,c);c.wbSheet=()=>s;c.wbBook=()=>({setActiveSheet(){}});c.wbAppendDraft(target,null);assert.equal(writeRow,1001);assert.equal(max,1100);
});

test('two-way RPC accepts publishable keys without bearer and refuses secret/service-role keys',()=>{
 const fetches=[],c=vm.createContext({console,Utilities:{base64DecodeWebSafe:s=>Buffer.from(s,'base64url'),newBlob:b=>({getDataAsString:()=>b.toString()})},UrlFetchApp:{fetch:(url,opt)=>{fetches.push(opt);return {getResponseCode:()=>200,getContentText:()=>'{"reports":[]}'};}}});vm.runInContext(code,c);
 const key=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.synthetic';
 c.wbRpc('eod_sheet_snapshot',{p_month:'2026-11'},{url:'https://dummy.invalid',key:'sb_publishable_dummy',token:'dummy'});
 assert.deepEqual(plain(fetches[0].headers),{apikey:'sb_publishable_dummy'});
 c.wbRpc('eod_sheet_snapshot',{}, {url:'https://dummy.invalid',key:key('anon'),token:'dummy'});assert.equal(fetches[1].headers.Authorization,'Bearer '+key('anon'));
 for(const bad of ['sb_secret_dummy',key('service_role'),key('authenticated')])assert.throws(()=>c.wbRpc('eod_sheet_mutate',{}, {url:'https://dummy.invalid',key:bad,token:'dummy'}),/never|anon public/);
 assert.equal(fetches.length,2);
});
test('editing hidden target metadata during an earlier request cannot send a stale target',()=>{
 const a=adapter([draft('first'),draft('second')]);a.hook=()=>{a.records[1][10]=JSON.stringify({...target,employee:'202'});return {revision:'2'};};ctx.wbProcess(a);assert.equal(a.calls.length,1);assert.equal(a.records[1][0],'REVIEW');
});

test('two-way refresh refuses a replacement same-name tab without clearing user data',()=>{
 const c=vm.createContext({console});vm.runInContext(code,c);const personal={getSheetId:()=>22},props={WB_TAB_Worklogs:'11'};
 c.wbProps=()=>({getProperty:k=>props[k]});c.wbBook=()=>({getSheetByName:()=>personal,getSheets:()=>[personal]});
 assert.throws(()=>c.wbSheet('Worklogs',[]),/not owned/);
});


test('queue refuses a replacement Worklogs tab before reading or drafting a worklog',()=>{
 const c=vm.createContext({console});vm.runInContext(code,c);
 const personal={getSheetId:()=>22,getName:()=> 'Worklogs',getActiveRange:()=>({getRow:()=>2,getNumRows:()=>1}),getRange:()=>{throw Error('Must not read replacement data');}};
 c.wbProps=()=>({getProperty:()=> '11'});c.wbBook=()=>({getActiveSheet:()=>personal,getSheetByName:()=>personal,getSheets:()=>[personal]});c.wbLock=fn=>fn();c.wbAppendDraft=()=>{throw Error('Must not stage a draft');};
 assert.throws(()=>c.wbQueue('update'),/not owned/);assert.throws(()=>c.wbQueue('delete'),/not owned/);
});
