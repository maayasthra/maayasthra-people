import test from 'node:test';
import assert from 'node:assert/strict';
import { autoNote } from '../src/taskTime.js';

const card = o => ({ id: 'a', cols: [1, 2], done: false, finished: [], time: [], ...o });
test('autoNote says completed for a card the person finished, even before a manager completes it', () => {
  assert.equal(autoNote(card({ finished: [1] }), 1), 'Completed');
  assert.equal(autoNote(card({ finished: [1] }), 2), 'In progress');
  assert.equal(autoNote(card({ done: true }), 2), 'Completed');
  assert.equal(autoNote(card({ client: 'Orbit' }), 1), 'Orbit · in progress');
});
