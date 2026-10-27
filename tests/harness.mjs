import { build } from 'esbuild'; import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = path.resolve(HERE, '..');
export const db = new PGlite();
const U = {};
export const ids = {};
export async function setup() {
  await db.exec(`create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, last_sign_in_at timestamptz, created_at timestamptz default now());
  create role authenticated; create role anon;
  create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.uid', true), '')::uuid \$\$;
  grant usage on schema public, auth to authenticated, anon;`);
  for (const f of fs.readdirSync(P + '/supabase/migrations').sort()) await db.exec(fs.readFileSync(P + '/supabase/migrations/' + f, 'utf8'));
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated; grant select on public.leave_away to authenticated;
  grant execute on function public.is_admin(), public.is_staff(), public.my_employee_id(), public.today_ist(), public.now_ms(), public.cancel_leave(bigint), public.check_in(text), public.check_out(bigint), public.admin_set_day(bigint,date,jsonb), public.update_my_profile(text,text,text,text,text) to authenticated;`);
  // the real staff list
  const rows = fs.readFileSync(path.join(HERE, 'staff-fixture.csv'), 'utf8').trim().split('\n').slice(1);
  for (const r of rows) { const c = r.split(','); await db.query('insert into staff_import values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', c); }
  await db.exec('select public.import_staff()');
  for (const e of (await db.query('select id, email from employees')).rows) { const u = (await db.query('insert into auth.users(email) values ($1) returning id', [e.email])).rows[0].id; const n = e.email.split('@')[0]; U[n] = u; ids[n] = e.id; }
}
globalThis.__as = 'abines';
export const as = n => { globalThis.__as = n; };
const pk = { employee_private: 'employee_id', holidays: 'day' };
const fix = v => v instanceof Date ? (isNaN(v) ? null : v.toISOString()) : v;
globalThis.__q = async (sql, params) => { const u = U[globalThis.__as]; await db.exec('begin'); await db.exec("set local role authenticated; select set_config('request.uid','" + u + "',true)"); try { const r = await db.query(sql, params); await db.exec('commit'); return { rows: r.rows, error: null }; } catch (e) { await db.exec('rollback'); return { rows: [], error: { message: e.message } }; } };
export const shimSrc = `
const pk = ${JSON.stringify(pk)};
const norm = r => { const o = {}; for (const k in r) { let v = r[k]; if (v instanceof Date) { v = k.endsWith('_at') ? v.toISOString() : v.toISOString().slice(0, 10); } o[k] = v; } return o; };
const par = v => (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
function builder(t) {
  const q = { t, op: 'select', conds: [], order: null, range: null, limit: null, single: false, maybe: false, ret: false, cols: '*', body: null };
  const add = (c, op, v) => { q.conds.push({ c, op, v }); return api; };
  const api = {
    select: (c) => { q.cols = c || '*'; if (q.op !== 'select') q.ret = true; return api; },
    insert: b => { q.op = 'insert'; q.body = b; return api; }, update: b => { q.op = 'update'; q.body = b; return api; }, upsert: b => { q.op = 'upsert'; q.body = b; return api; }, delete: () => { q.op = 'delete'; return api; },
    eq: (c, v) => add(c, '=', v), neq: (c, v) => add(c, '<>', v), gte: (c, v) => add(c, '>=', v), lte: (c, v) => add(c, '<=', v),
    in: (c, vs) => add(c, 'in', vs),
    order: (c, o) => { q.order = c + (o && o.ascending === false ? ' desc' : ''); return api; }, range: (a, b) => { q.range = [a, b]; return api; }, limit: n => { q.limit = n; return api; },
    single: () => { q.single = true; return api; }, maybeSingle: () => { q.maybe = true; return api; },
    then: (res, rej) => run(q).then(res, rej)
  };
  return api;
}
async function run(q) {
  const params = [];
  const P = v => { params.push(par(v)); return '$' + params.length; };
  const keys = o => Object.keys(o);
  let sql, whereSql = '';
  const where = () => q.conds.length ? ' where ' + q.conds.map(x => x.op === 'in' ? x.c + '::text = any(' + P('{' + x.v.map(v => '"' + String(v).replace(/"/g, '\\"') + '"').join(',') + '}') + '::text[])' : x.c + ' ' + x.op + ' ' + P(x.v)).join(' and ') : '';
  if (q.op === 'select') { sql = 'select ' + q.cols + ' from ' + q.t + where() + (q.order ? ' order by ' + q.order : '') + (q.range ? ' limit ' + (q.range[1] - q.range[0] + 1) + ' offset ' + q.range[0] : q.limit ? ' limit ' + q.limit : ''); }
  else if (q.op === 'insert' || q.op === 'upsert') {
    const rows = Array.isArray(q.body) ? q.body : [q.body], ks = keys(rows[0]);
    const tuples = rows.map(r => '(' + ks.map(k => P(r[k])).join(',') + ')');
    sql = 'insert into ' + q.t + ' (' + ks.join(',') + ') values ' + tuples.join(',') + (q.op === 'upsert' ? ' on conflict (' + pk[q.t] + ') do update set ' + ks.filter(k => k !== pk[q.t]).map(k => k + ' = excluded.' + k).join(',') : '') + ' returning *';
  } else if (q.op === 'update') { const ks = keys(q.body); const sets = ks.map(k => k + ' = ' + P(q.body[k])).join(','); sql = 'update ' + q.t + ' set ' + sets + where() + ' returning *'; }
  else if (q.op === 'delete') sql = 'delete from ' + q.t + where() + ' returning *';
  const r = await __q(sql, params);
  if (r.error) return { data: null, error: r.error };
  const data = r.rows.map(norm);
  if (q.single) return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'single row expected' } };
  if (q.maybe) return { data: data[0] || null, error: null };
  return { data: (q.op === 'select' || q.ret || q.op === 'upsert' || q.op === 'insert') ? data : null, error: null };
}
export const supabase = {
  from: t => builder(t),
  rpc: (n, a) => { const ks = Object.keys(a || {}); return __q('select * from ' + n + '(' + ks.map((k, i) => k + ' => $' + (i + 1)).join(', ') + ')', ks.map(k => par(a[k]))).then(r => ({ error: r.error, data: r.error ? null : r.rows.map(norm) })); }
};
export const authEnabled = true;`;
const mock = { name: 'mock', setup(b) {
  b.onResolve({ filter: /^\.\/auth\.js$/ }, () => ({ path: 'auth-mock', namespace: 'm' }));
  b.onResolve({ filter: /^\.\/env\.js$/ }, () => ({ path: 'env-mock', namespace: 'm' }));
  b.onLoad({ filter: /env-mock/, namespace: 'm' }, () => ({ contents: 'export const IS_DEMO = false;', loader: 'js' }));
  b.onLoad({ filter: /auth-mock/, namespace: 'm' }, () => ({ contents: shimSrc, loader: 'js' }));
}};
export async function load() {
  const OUT = path.join(HERE, '.build'); fs.mkdirSync(OUT, { recursive: true });
  await build({ stdin: { contents: "export * from '" + P + "/src/staff.js'; export * from '" + P + "/src/leave.js'; export * from '" + P + "/src/tasksDb.js'; export * from '" + P + "/src/attendanceDb.js'; export * from '" + P + "/src/eodDb.js'; export * as att from '" + P + "/src/attendance.js'; export * as data from '" + P + "/src/data.js'; export * as tasks from '" + P + "/src/tasks.js';", resolveDir: P + '/src', loader: 'js' }, bundle: true, format: 'esm', outfile: OUT + '/app.mjs', plugins: [mock], logLevel: 'error', define: { 'import.meta.env': '{}' }, external: ['react'] });
  fs.writeFileSync(OUT + '/react.mjs', 'export const useState=()=>[0,()=>{}]; export const useEffect=()=>{};');
  fs.writeFileSync(OUT + '/app.mjs', fs.readFileSync(OUT + '/app.mjs', 'utf8').replace(/from "react"/g, 'from "./react.mjs"'));
  return await import(OUT + '/app.mjs?' + Date.now());
}
export const t = (label, ok, extra) => { if (!ok) process.exitCode = 1; console.log((ok ? 'PASS ' : 'FAIL ') + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
