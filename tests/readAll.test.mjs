import test from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../src/readAll.js';

test('pagination follows the actual API cap and keeps every row exactly once', async () => {
  const rows = Array.from({ length: 1005 }, (_, id) => ({ id })), offsets = [];
  const result = await readAll(() => ({ range: async start => {
    offsets.push(start); return { data: rows.slice(start, start + 73), error: null };
  } }), 'load failed');
  assert.deepEqual(result, rows);
  assert.equal(offsets.at(-1), 1005);
});
test('a later page failure never returns a partial successful result', async () => {
  await assert.rejects(readAll(() => ({ range: async start => start ? { error: {} } : { data: [{ id: 1 }] } }), 'load failed'), /load failed/);
});
test('an empty table completes after one request', async () => {
  let calls = 0;
  assert.deepEqual(await readAll(() => ({ range: async () => { calls++; return { data: [] }; } })), []);
  assert.equal(calls, 1);
});
