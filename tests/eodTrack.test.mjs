import test from 'node:test';
import assert from 'node:assert/strict';
import { trackedForDay, trackedRange, toHours, totalMs, rangeDays, dayStart } from '../src/eodTrack.js';

const D = '2026-11-10', next = '2026-11-11', H = 3600000, M = 60000;
const at = (iso, h, m = 0) => dayStart(iso) + h * H + m * M;
const task = (id, title, time) => ({ id, title, time });

test('adds up one person\'s sessions on a task for a day, longest task first', () => {
  const tasks = [
    task('a', 'Poster', [{ emp: 1, start: at(D, 10), end: at(D, 11, 30) }, { emp: 1, start: at(D, 14), end: at(D, 14, 45) }, { emp: 2, start: at(D, 10), end: at(D, 18) }]),
    task('b', 'Logo', [{ emp: 1, start: at(D, 12), end: at(D, 12, 20) }])
  ];
  const r = trackedForDay(tasks, 1, D, at(next, 1));
  assert.deepEqual(r.map(x => [x.id, x.ms]), [['a', 2.25 * H], ['b', 20 * M]]);
  assert.equal(totalMs(r), 2.25 * H + 20 * M);
});
test('under a minute is ignored and other days do not count', () => {
  const tasks = [task('a', 'A', [{ emp: 1, start: at(D, 10), end: at(D, 10) + 30000 }, { emp: 1, start: at(next, 10), end: at(next, 12) }])];
  assert.equal(trackedForDay(tasks, 1, D, at(next, 1)).length, 0);
  assert.equal(trackedForDay(tasks, 1, next, at(next, 13))[0].ms, 2 * H);
});
test('a running timer counts up to now', () => {
  const tasks = [task('a', 'A', [{ emp: 1, start: at(D, 9), end: null }])];
  assert.equal(trackedForDay(tasks, 1, D, at(D, 11))[0].ms, 2 * H);
});
test('a session across midnight is split between the two days', () => {
  const tasks = [task('a', 'A', [{ emp: 1, start: at(D, 23), end: at(next, 1) }])];
  assert.equal(trackedForDay(tasks, 1, D, at(next, 5))[0].ms, H);
  assert.equal(trackedForDay(tasks, 1, next, at(next, 5))[0].ms, H);
  const r = trackedRange(tasks, D, next, at(next, 5));
  assert.deepEqual(r[1], { [D]: H, [next]: H });
});
test('range totals add up per person per day', () => {
  const tasks = [task('a', 'A', [{ emp: 1, start: at(D, 9), end: at(D, 10) }, { emp: 2, start: at(D, 9), end: at(D, 12) }]), task('b', 'B', [{ emp: 1, start: at(D, 11), end: at(D, 11, 30) }])];
  const r = trackedRange(tasks, D, D, at(next, 1));
  assert.equal(r[1][D], 1.5 * H); assert.equal(r[2][D], 3 * H);
});
test('hours round to the nearest minute', () => {
  assert.equal(toHours(90 * M), 1.5); assert.equal(toHours(20 * M), 1 / 3); assert.equal(toHours(M * 2 + 20000), 2 / 60);
});
test('rangeDays lists every day, both ends included', () => { assert.deepEqual(rangeDays(D, next), [D, next]); });
