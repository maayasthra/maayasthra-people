// Run only in the isolated local test environment; no network or production credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { db, setup } from './harness.mjs';
await setup();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const token = 'local-sheet-export-fixture-only';
await q("insert into eod_export_config(id, token_hash) values(1,encode(sha256(convert_to($1,'UTF8')),'hex'))", [token]);
const insertEmployee = async email => (await q('insert into employees(email,name) values($1,$2) returning id', [email, 'Same Dummy Name']))[0].id;
const a = await insertEmployee('sheet-a@example.invalid'), b = await insertEmployee('sheet-b@example.invalid');
const rows = JSON.stringify([{ project: '=2+2', desc: '=1+1', hours: 1, subs: [] }]);
const insertReport = async (id, day) => q('insert into eod_reports(employee_id,day,rows,total_hours) values($1,$2,$3,1)', [id, day, rows]);
const changes = async () => (await q('select eod_export_changes($1) v', [token]))[0].v;
const month = async ym => (await q('select eod_export_month($1,$2) v', [token, ym]))[0].v;
const version = async ym => (await changes()).versions[ym];
await insertReport(a, '2026-10-01'); const v1 = await version('2026-10');
await insertReport(b, '2026-10-02'); const v2 = await version('2026-10');
assert.ok(BigInt(v2) > BigInt(v1));
const exported = await month('2026-10');
assert.deepEqual(new Set(exported.map(x => x.employee_id)), new Set([String(a), String(b)]));
assert.ok(exported.every(x => x.name === 'Same Dummy Name'));
console.log('PASS revision insert and stable identities for duplicate names');
await q("update eod_reports set rows=$1,updated_at='2000-01-01' where employee_id=$2", [rows, a]);
const v3 = await version('2026-10'); assert.ok(BigInt(v3) > BigInt(v2));
assert.equal((await q("select eod_export_changes($1, '2100-01-01') v", [token]))[0].v.versions['2026-10'], v3);
console.log('PASS revisions do not depend on report timestamps or saved time cursors');
await db.exec('begin'); await q('delete from eod_reports where employee_id=$1', [a]); await db.exec('rollback');
assert.equal(await version('2026-10'), v3); assert.equal((await month('2026-10')).length, 2);
console.log('PASS rolled-back report writes do not advance committed revisions');
await q('delete from eod_reports where employee_id=$1', [a]);
const v4 = await version('2026-10'); assert.ok(BigInt(v4) > BigInt(v3)); assert.equal((await month('2026-10')).length, 1);
await q('delete from eod_reports where employee_id=$1', [b]);
const v5 = await version('2026-10'); assert.ok(BigInt(v5) > BigInt(v4)); assert.deepEqual(await month('2026-10'), []);
assert.ok(!(await q('select eod_export_months($1) v', [token]))[0].v.includes('2026-10'));
assert.ok((await changes()).months.includes('2026-10'));
console.log('PASS partial and final-report deletes retain month invalidation without retaining report content');
await insertReport(a, '2026-11-01'); const beforeRename = await version('2026-11');
await q("update employees set name='Renamed Dummy',department='Design' where id=$1", [a]);
assert.ok(BigInt(await version('2026-11')) > BigInt(beforeRename));
assert.equal((await month('2026-11'))[0].name, 'Renamed Dummy');
const beforeMove = await version('2026-11');
await q("update eod_reports set day='2026-12-01' where employee_id=$1", [a]);
assert.ok(BigInt(await version('2026-11')) > BigInt(beforeMove)); assert.ok(await version('2026-12'));
const beforeCascade = await version('2026-12'); await q('delete from employees where id=$1', [a]);
assert.ok(BigInt(await version('2026-12')) > BigInt(beforeCascade)); assert.deepEqual(await month('2026-12'), []);
console.log('PASS directory rename, report move and employee cascade invalidation');
const retained = (await changes()).versions;
const migration = fs.readFileSync(new URL('../supabase/migrations/0047_eod_export_integrity.sql', import.meta.url), 'utf8');
await db.exec(migration); await db.exec(migration);
assert.deepEqual((await changes()).versions, retained);
console.log('PASS reapplying migration preserves counters and tombstones');
for (const role of ['anon', 'authenticated']) {
  await db.exec('begin; set local role ' + role);
  try { assert.deepEqual((await changes()).versions, retained); } finally { await db.exec('rollback'); }
  await db.exec('begin; set local role ' + role);
  try { await assert.rejects(q('select * from eod_export_revisions'), /permission denied/); } finally { await db.exec('rollback'); }
  await db.exec('begin; set local role ' + role);
  try { await assert.rejects(q("select touch_eod_export_month('2026-10-01')"), /permission denied/); } finally { await db.exec('rollback'); }
  await db.exec('begin; set local role ' + role);
  try { await assert.rejects(q("select eod_export_changes('wrong')"), /Not allowed/); } finally { await db.exec('rollback'); }
}
console.log('PASS anonymous/authenticated callers cannot access counters or bypass token');
await db.close();
