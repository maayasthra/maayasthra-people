import test from 'node:test';
import assert from 'node:assert/strict';
import { pauseOthers, workedMs, trackedIn, hoursText, shortDur } from '../src/taskTime.js';

const H = 3600000, M = 60000;
const card = (id, time, extra = {}) => ({ id, title: 'Card ' + id, time, ...extra });

test('starting a card pauses everything else I had running, and keeps the time', () => {
  const ts = [card('a', [{ id: '1', emp: 7, start: 0, end: null }]), card('b', []), card('c', [{ id: '2', emp: 9, start: 0, end: null }])];
  const out = pauseOthers(ts, 'b', 7, 2 * H);
  assert.deepEqual(out[0].time, [{ id: '1', emp: 7, start: 0, end: 2 * H }]);   // mine on a: closed at now, not erased
  assert.equal(out[2].time[0].end, null);                                         // someone else's timer is untouched
  assert.equal(out[1], ts[1]);                                                    // the card being started is left alone
});

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
    card('tiny', [{ id: '3', emp: 7, start: 9 * H, end: 9 * H + 30000 }]),
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
