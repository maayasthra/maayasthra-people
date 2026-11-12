import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveQueue } from '../src/saveQueue.js';
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('edits made during a save are persisted after that snapshot, without overlap', async () => {
  const held = gate(), entered = gate(), calls = [];
  const q = createSaveQueue('initial', async (before, next) => {
    calls.push([before, next]);
    if (next === 'A') { entered.resolve(); await held.promise; }
  }, assert.fail, () => {}, 60000);
  try {
    q.set('A'); const saving = q.flush(); await entered.promise;
    q.set('B'); assert.equal(q.flush(), saving);
    assert.equal(q.replace('remote'), false);
    held.resolve(); await saving;
    assert.deepEqual(calls, [['initial', 'A'], ['A', 'B']]);
    assert.equal(q.current, 'B'); assert.equal(q.dirty, false);
  } finally { q.dispose(); }
});

test('failure keeps newer edits and retries from the acknowledged baseline', async () => {
  const entered = gate(), held = gate(), errors = [], calls = [];
  let applied = 0;
  const q = createSaveQueue('initial', async (before, next, acknowledge) => {
    calls.push([before, next]);
    if (before === 'initial') {
      applied++; acknowledge('partial');
      entered.resolve(); await held.promise; throw new Error('offline');
    }
  }, e => errors.push(e.message), () => {}, 60000);
  try {
    q.set('A'); const saving = q.flush(); await entered.promise; q.set('B');
    held.resolve(); await assert.rejects(saving, /offline/);
    assert.equal(q.current, 'B'); assert.equal(q.dirty, true);
    assert.equal(q.replace('remote'), false);
    await q.flush();
    assert.deepEqual(calls, [['initial', 'A'], ['partial', 'B']]);
    assert.equal(applied, 1); assert.deepEqual(errors, ['offline']); assert.equal(q.dirty, false);
  } finally { q.dispose(); }
});

test('correcting a rejected edit does not keep retrying the invalid snapshot', async () => {
  let stored = 'initial';
  const q = createSaveQueue(stored, async (_, next) => {
    if (!next) throw new Error('required');
    stored = next;
  }, () => {}, () => {}, 60000);
  try {
    q.set(''); await assert.rejects(q.flush(), /required/);
    q.set('corrected'); await q.flush();
    assert.equal(stored, 'corrected'); assert.equal(q.dirty, false);
  } finally { q.dispose(); }
});

test('flush drains a debounced edit before sign-out can proceed', async () => {
  let stored = '';
  const q = createSaveQueue('', async (_, next) => { stored = next; }, assert.fail, () => {}, 60000);
  try { q.set('last edit'); await q.flush(); assert.equal(stored, 'last edit'); assert.equal(q.dirty, false); }
  finally { q.dispose(); }
});

test('disposing an account stops the next queued snapshot', async () => {
  const entered = gate(), held = gate(), calls = [];
  const q = createSaveQueue('', async (_, next) => { calls.push(next); entered.resolve(); await held.promise; }, assert.fail, () => {}, 60000);
  q.set('A'); const saving = q.flush(); await entered.promise;
  q.set('B'); q.dispose(); held.resolve(); await saving;
  assert.deepEqual(calls, ['A']);
});
