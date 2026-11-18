import test from 'node:test';
import assert from 'node:assert/strict';
import { workedMs, workedIn, trackedIn, hoursText, shortDur } from '../src/taskTime.js';

const H = 3600000, M = 60000;
const card = (id, time, extra = {}) => ({ id, title: 'Card ' + id, time, ...extra });

test('pausing never loses hours: worked time adds up across sessions', () => {
  const t = card('a', [{ id: '1', emp: 7, start: 0, end: H }, { id: '2', emp: 7, start: 2 * H, end: 2 * H + 30 * M }, { id: '3', emp: 9, start: 0, end: 5 * H }]);
  assert.equal(workedMs(t, 7, 10 * H), 1.5 * H);
  assert.equal(workedMs(card('r', [{ id: '4', emp: 7, start: 0, end: null }]), 7, 20 * M), 20 * M);   // a running session counts up to now
});

test('tracked time for a day: clipped to the day, per card, longest first, under a minute left out', () => {
  const day = 24 * H;
  const ts = [
    card('long', [{ id: '1', emp: 7, start: 9 * H, end: 12 * H }]),
    card('across', [{ id: '2', emp: 7, start: day - H, end: day + 3 * H }]),          // 1h falls on this day, 3h on the next
    card('tiny', [{ id: '3', emp: 7, start: 16 * H, end: 16 * H + 30000 }]),
    card('other', [{ id: '4', emp: 9, start: 9 * H, end: 12 * H }]),
    card('running', [{ id: '5', emp: 7, start: 13 * H, end: null }])
  ];
  const r = trackedIn(ts, 7, 0, day, 15 * H);
  assert.deepEqual(r.map(x => [x.id, x.ms]), [['long', 3 * H], ['running', 2 * H], ['across', H]]);
});

test('hours and durations are written the way the report keeps them', () => {
  assert.equal(hoursText(90 * M), '1.5'); assert.equal(hoursText(20 * M), '0.3333'); assert.equal(hoursText(8 * H), '8');
  assert.equal(shortDur(80 * M), '1h 20m'); assert.equal(shortDur(45 * M), '45m'); assert.equal(shortDur(2 * H), '2h 00m');
});

import { autoNote, subLines } from '../src/taskTime.js';
test('a starting description from the card: client and where it stands', () => {
  assert.equal(autoNote({ client: 'Orbit Fitness', done: false }), 'Orbit Fitness · in progress');
  assert.equal(autoNote({ client: 'Nila Tea Co.', done: true }), 'Nila Tea Co. · completed');
  assert.equal(autoNote({ client: '', done: true }), 'Completed');
  assert.equal(autoNote({ client: '', done: false }), 'In progress');
});
test('subtask lines: ticked subtasks share the card time to the minute', () => {
  const t = { subs: [{ t: 'Hero', done: true }, { t: 'Crops', done: false }, { t: 'Print', done: true }] };
  assert.deepEqual(subLines(t, 61 * M), [{ title: 'Hero', hours: '0.5167' }, { title: 'Print', hours: '0.5' }]);   // 31m + 30m
  assert.deepEqual(subLines({ subs: [{ t: 'A', done: false }, { t: 'B', done: false }] }, 60 * M).map(x => x.title), ['A', 'B']);   // none ticked: all of them
  assert.deepEqual(subLines(t, 1 * M), []);          // too little time to share
  assert.deepEqual(subLines({ subs: [] }, H), []);   // no subtasks
});

test('tasks running together each keep their own full time, the same figure the card shows', () => {
  const ts = [card('A', [{ id: '1', emp: 7, start: 9 * H, end: 11 * H }]), card('B', [{ id: '2', emp: 7, start: 10 * H, end: 12 * H }])];
  const r = trackedIn(ts, 7, 0, 24 * H, 20 * H);
  assert.deepEqual(r.map(x => [x.id, x.ms]), [['A', 2 * H], ['B', 2 * H]]);          // overlapping hours count in full for each task
  for (const t of ts) assert.equal(workedIn(t, 7, 0, 24 * H, 20 * H), r.find(x => x.id === t.id).ms);   // card and report agree
  assert.equal(workedIn(ts[0], 7, 10 * H, 24 * H, 20 * H), H);                        // a window clips the time
});


test('breaks are not worked time, even when the clock was left running', async () => {
  const { workedIn, trackedIn } = await import('../src/taskTime.js');
  const H = 3600000, t = { id: 'a', title: 'A', time: [{ id: 's', emp: 1, start: 10 * H, end: 18 * H }] };   // 10:00 to 18:00
  const brk = [{ from: 13 * H + 16 * 60000, to: 14 * H + 39 * 60000 }];                                     // 1:16 to 2:39 PM, 1h 23m
  assert.equal(workedIn(t, 1, 0, 24 * H, 20 * H), 8 * H);
  assert.equal(workedIn(t, 1, 0, 24 * H, 20 * H, brk), 8 * H - 83 * 60000);
  assert.equal(trackedIn([t], 1, 0, 24 * H, 20 * H, brk)[0].ms, 8 * H - 83 * 60000);
  // still away now: the open break counts up to now
  const run = { id: 'b', time: [{ id: 's', emp: 1, start: 10 * H, end: null }] };
  assert.equal(workedIn(run, 1, 0, 24 * H, 15 * H, [{ from: 14 * H, to: null }]), 4 * H);
  // a break outside the window, or before the work began, takes nothing off
  assert.equal(workedIn(t, 1, 0, 24 * H, 20 * H, [{ from: 8 * H, to: 9 * H }]), 8 * H);
  // two breaks add up
  assert.equal(workedIn(t, 1, 0, 24 * H, 20 * H, [{ from: 12 * H, to: 13 * H }, { from: 15 * H, to: 15 * H + 30 * 60000 }]), 8 * H - 90 * 60000);
});
