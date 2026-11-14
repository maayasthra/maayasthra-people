import test from 'node:test';
import assert from 'node:assert/strict';
import { requestableMonths, monthLabel, monthLong, isOpen, fmtSize, STATUS } from '../src/payslipMonths.js';

test('the last 12 finished months, newest first, never the current one', () => {
  const m = requestableMonths('2026-11-14'); assert.equal(m.length, 12);
  assert.equal(m[0].iso, '2026-10-01'); assert.equal(m[11].iso, '2025-11-01'); assert.ok(m.every(x => x.iso < '2026-11-01'));
});
test('it crosses the year end', () => {
  const m = requestableMonths('2026-01-05'); assert.equal(m[0].iso, '2025-12-01'); assert.equal(m[11].iso, '2025-01-01');
});
test('the first day of a month still excludes that month', () => { assert.equal(requestableMonths('2026-03-01')[0].iso, '2026-02-01'); });
test('months before the person joined are left out', () => {
  const m = requestableMonths('2026-11-14', '2026-08-20'); assert.deepEqual(m.map(x => x.iso), ['2026-10-01', '2026-09-01', '2026-08-01']);
  assert.equal(requestableMonths('2026-11-14', '2026-11-02').length, 0);
});
test('a missing or odd join date does not hide months', () => { assert.equal(requestableMonths('2026-11-14', null).length, 12); assert.equal(requestableMonths('2026-11-14', '').length, 12); });
test('labels', () => { assert.equal(monthLabel('2026-10-01'), 'Oct 2026'); assert.equal(monthLong('2026-01-01'), 'January 2026'); assert.equal(requestableMonths('2026-11-14')[0].label, 'Oct 2026'); });
test('open requests block asking again, closed ones do not', () => {
  assert.equal(isOpen({ status: 'requested' }), true); assert.equal(isOpen({ status: 'delivered' }), true);
  assert.equal(isOpen({ status: 'declined' }), false); assert.equal(isOpen({ status: 'cancelled' }), false);
});
test('file sizes read naturally', () => { assert.equal(fmtSize(900), '900 B'); assert.equal(fmtSize(86 * 1024), '86 KB'); assert.equal(fmtSize(1.5 * 1048576), '1.5 MB'); });
test('every status has a label and tone', () => { ['requested', 'delivered', 'declined', 'cancelled'].forEach(k => assert.ok(STATUS[k].label && STATUS[k].tone)); });
