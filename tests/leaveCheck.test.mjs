import test from 'node:test';
import assert from 'node:assert/strict';
import { approveItems, hasWarning, joinNames } from '../src/leaveCheck.js';

const e = { dept: 'Motion' }, L = (o = {}) => ({ type: 'Casual leave', days: 2, half: false, ...o });
const tones = items => items.map(i => i.tone).join(',');

test('plenty of balance and nobody else out: no warnings', () => {
  const it = approveItems({ l: L(), e, bal: { left: 8, total: 8 }, peers: [], hol: [] });
  assert.equal(hasWarning(it), false); assert.match(it[0].text, /6 of 8 casual days left after this/); assert.match(it[1].text, /No one else in Motion is out/);
});
test('using the last days is a warning', () => {
  const it = approveItems({ l: L({ days: 3 }), e, bal: { left: 3, total: 8 }, peers: [], hol: [] });
  assert.equal(it[0].tone, 'warn'); assert.match(it[0].text, /all of their remaining casual days/); assert.equal(hasWarning(it), true);
});
test('going over the balance is a problem, with the number of days over', () => {
  const it = approveItems({ l: L({ days: 10 }), e, bal: { left: 8, total: 8 }, peers: [], hol: [] });
  assert.equal(it[0].tone, 'bad'); assert.match(it[0].text, /over their casual balance by 2 days \(8 left of 8\)/);
});
test('a colleague who is also out is a warning, named', () => {
  const one = approveItems({ l: L(), e, bal: { left: 8, total: 8 }, peers: ['Anil'], hol: [] }).find(i => /also out/.test(i.text));
  assert.equal(one.tone, 'warn'); assert.match(one.text, /Anil is also out in Motion/);
  const two = approveItems({ l: L(), e, bal: { left: 8, total: 8 }, peers: ['Anil', 'Ravi'], hol: [] }).find(i => /also out/.test(i.text));
  assert.match(two.text, /Anil and Ravi are also out/);
});
test('holidays inside the dates are mentioned, calmly', () => {
  const h = approveItems({ l: L(), e, bal: { left: 8, total: 8 }, peers: [], hol: ['Diwali break'] }).find(i => /Skips/.test(i.text)); assert.equal(h.tone, 'ok'); assert.match(h.text, /Skips Diwali break/);
});
test('five days or more is called a long leave, half days never are', () => {
  assert.ok(approveItems({ l: L({ days: 5 }), e, bal: { left: 8, total: 8 }, peers: [], hol: [] }).some(i => /long leave/.test(i.text)));
  assert.ok(!approveItems({ l: L({ days: 4 }), e, bal: { left: 8, total: 8 }, peers: [], hol: [] }).some(i => /long leave/.test(i.text)));
  assert.ok(!approveItems({ l: L({ days: 0.5, half: true }), e, bal: { left: 8, total: 8 }, peers: [], hol: [] }).some(i => /long leave/.test(i.text)));
});
test('no balance information still gives the other checks', () => { assert.equal(tones(approveItems({ l: L(), e, bal: undefined, peers: [], hol: [] })), 'ok'); });
test('names join naturally', () => { assert.equal(joinNames([]), ''); assert.equal(joinNames(['A']), 'A'); assert.equal(joinNames(['A', 'B']), 'A and B'); assert.equal(joinNames(['A', 'B', 'C']), 'A, B and C'); });
