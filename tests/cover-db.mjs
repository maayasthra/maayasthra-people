import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setup, load, as, ids, db } from './harness.mjs';
await setup();
const app = await load(), image = 'data:image/png;base64,dummy';
try {
  as('abines');
  assert.equal((await app.supabase.rpc('set_my_cover', { p_image: image, p_employee: ids.abines })).error, null);
  as('vijay');
  const changed = await app.supabase.rpc('set_my_cover', { p_image: image, p_employee: ids.abines });
  assert.match(changed.error?.message || '', /account changed/);
  assert.equal((await db.query('select count(*)::int n from employee_covers where employee_id=$1', [ids.vijay])).rows[0].n, 0);
  assert.match((await app.supabase.rpc('set_my_cover', { p_image: image })).error?.message || '', /Refresh/);
  assert.match((await app.supabase.rpc('set_my_cover', { p_image: image, p_employee: null })).error?.message || '', /account changed/);
  assert.equal((await app.supabase.from('employee_covers').select('image').eq('employee_id', ids.abines).maybeSingle()).data, null);
  assert.equal((await app.supabase.rpc('set_my_cover', { p_image: image, p_employee: ids.vijay })).error, null);
  const migration = fs.readFileSync(new URL('../supabase/migrations/0048_cover_owner_binding.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  assert.equal((await db.query('select image from employee_covers where employee_id=$1', [ids.abines])).rows[0].image, image);
  console.log('PASS repeating cover migration preserves existing personal images');
  as('abines');
  assert.equal((await app.supabase.rpc('set_my_cover', { p_image: '', p_employee: ids.abines })).error, null);
  await db.query('update profiles set active=false where email=(select email from employees where id=$1)', [ids.abines]);
  assert.match((await app.supabase.rpc('set_my_cover', { p_image: image, p_employee: ids.abines })).error?.message || '', /Not allowed/);
  console.log('PASS cover owner binding: own save/reset, mismatched/null owner denial without mutation, legacy call refusal, cross-owner read denial, inactive denial');
} finally { await db.close(); }
