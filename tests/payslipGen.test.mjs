import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE, parseText, applyOverrides, amountWords, inr, toPaise, fileNameFor, cleanName, valid, monthLabel } from '../src/payslipGen/payslip.js';
import { makeZip, crc32, uniqueName } from '../src/payslipGen/zip.js';

const get = (text, name, month) => parseText(text).items.find(i => i.name === name && i.month === month);

test('the sample makes 9 payslips for 2 people, nothing ignored', () => {
  const r = parseText(SAMPLE);
  assert.equal(r.items.length, 9);
  assert.equal(new Set(r.items.map(i => i.name)).size, 2);
  assert.equal(r.ignored.length, 0);
});

test('worked example 1: last working day, 1 LOP, earlier full month sets the salary', () => {
  const it = get(SAMPLE, 'Employee Name', '2026-11');
  assert.equal(it.paid, '5');                // 6 - 1 + 1 - 1
  assert.equal(it.lop, '1');
  assert.equal(it.salary, '35000');          // 35,000 / 30 x 5 = 5,833.33, within 1 rupee of 5,833
  assert.equal(it.lwd, '2026-11-06');
  assert.equal(it.basis, 'Last working day 06-11-2026, 1 LOP');
  assert.equal(toPaise(it.salary) - toPaise(it.amt), 2916700);   // Loss of Pay = 29,167.00
});

test('worked example 2: no earlier full month, salary is estimated to the nearest 100', () => {
  const it = get(SAMPLE, 'Second Employee', '2026-11');
  assert.equal(it.paid, '10');
  assert.equal(it.salary, '30000');          // 10,000 / 10 x 30
  assert.equal(it.flag, false);
});

test('worked example 3: a formula in the note gives paid days and no salary line', () => {
  const it = get(SAMPLE, 'Second Employee', '2026-10');
  assert.equal(it.paid, '26');               // 23 + 3
  assert.equal(it.salary, '');
  assert.equal(it.basis, 'Paid days taken from the formula in the note');
  assert.equal(it.terms.length, 2);
});

test('full months get no salary value and are not flagged', () => {
  const it = get(SAMPLE, 'Employee Name', '2026-06');
  assert.equal(it.salary, ''); assert.equal(it.paid, '30'); assert.equal(it.basis, 'Full month'); assert.equal(it.flag, false);
  assert.equal(get(SAMPLE, 'Employee Name', '2026-07').paid, '31');
});

test('years are inferred: joining year first, then rolling over after December', () => {
  const t = 'Anu - Designer - 15/11/25\nNov - 30k\nDec - 30k\nJan - 30k\nFeb - 30k';
  assert.deepEqual(parseText(t).items.map(i => i.month), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(parseText('Anu - Designer - 15/11/25\nOct - 30k').items[0].month, '2026-10');   // no year: an earlier month means next year
  assert.equal(parseText('Anu - Designer - 15/11/25\nOct 25 - 30k').items.length, 0);            // an explicit year before joining is rejected
  assert.equal(parseText('Anu - Designer - 15/11/25\nMar 27 - 30k').items[0].month, '2027-03');   // an explicit 2-digit year
});

test('joined mid-month with no formula is flagged and counts from the joining day', () => {
  const it = get('Anu - Designer - 20/10/26\nOct - 10k', 'Anu', '2026-10');
  assert.equal(it.paid, '12');               // 20..31
  assert.equal(it.flag, true);
  assert.match(it.basis, /^Joined mid-month/);
});

test('an unsolvable salary flags the card and says so', () => {
  const it = get('Anu - Designer - 01/01/26\nMar - 7777 (Last working day - 10/03/26)', 'Anu', '2026-03');
  assert.equal(it.salary, '');
  assert.equal(it.flag, true);
  assert.match(it.basis, /Monthly salary not confirmed/);
});

test('zero paid days is set to 0 and flagged', () => {
  const it = get('Anu - Designer - 01/01/26\nMar - 5k (3 days LOP, Last working day - 03/03/26)', 'Anu', '2026-03');
  assert.equal(it.paid, '0'); assert.equal(it.flag, true); assert.equal(it.basis, 'Paid days came out as zero. Check the details.');
});

test('lines that are not used are listed with the reason', () => {
  const r = parseText('Oct - 5k\nAnu - Designer - 15/11/25\nOct 25 - 30k\nNov - 30k\nNov - 31k\nhello there\nBad - Name - 31/02/26');
  assert.deepEqual(r.ignored.map(g => g.why), [
    'month line before any employee', 'month is before the joining date', 'this month is already listed for Anu', 'not a header or month line', 'not a header or month line']);
  assert.equal(r.items.length, 1);
});

test('accepted spellings: dashes, colon, rupee signs, commas, k suffix, long month names', () => {
  const t = 'Bo Li – UI/UX – 05-10-2026\nOctober: ₹1,20,000\nNov — Rs. 35,000.50\nDec - 28.5k';
  assert.deepEqual(parseText(t).items.map(i => i.amt), ['120000', '35000.5', '28500']);
  assert.equal(parseText(t).items[0].designation, 'UI/UX');
});

test('a last working day in another month is ignored', () => {
  assert.equal(get('Anu - D - 01/01/26\nMar - 5k (Last working day - 10/04/26)', 'Anu', '2026-03').lwd, '');
});

test('edits survive re-reading the text', () => {
  const a = parseText(SAMPLE).items, edits = { 'employee name|2026-05': { amt: '31000' } };
  const b = applyOverrides(parseText(SAMPLE + '\n').items, edits);
  assert.equal(b[0].amt, '31000'); assert.equal(a[0].amt, '30000'); assert.equal(b[1].amt, '35000');
});

test('money formatting and amount in words', () => {
  assert.equal(inr(12345600), '1,23,456.00'); assert.equal(inr(5), '0.05'); assert.equal(inr(100000000), '10,00,000.00'); assert.equal(inr(-2917), '-29.17');
  assert.equal(amountWords(3500000), 'Rupees Thirty Five Thousand Only.');
  assert.equal(amountWords(500050), 'Rupees Five Thousand and Fifty Paise Only.');
  assert.equal(amountWords(12345600), 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only.');
  assert.equal(amountWords(1000000000), 'Rupees One Crore Only.');
});

test('file names, month labels and validity', () => {
  const it = get(SAMPLE, 'Employee Name', '2026-11');
  assert.equal(fileNameFor(it), 'Employee Name - November Payslip 2026 - Maayasthra.pdf');
  assert.equal(monthLabel(it), 'Nov 2026');
  assert.equal(cleanName('A/B: C*D?'), 'A B C D');
  assert.equal(valid(it), true); assert.equal(valid({ ...it, amt: '0' }), false); assert.equal(valid({ ...it, payDate: '' }), false); assert.equal(valid({ ...it, paid: '-1' }), false);
  assert.equal(uniqueName('a.pdf', {}), 'a.pdf');
  const used = {}; uniqueName('a.pdf', used); assert.equal(uniqueName('a.pdf', used), 'a_2.pdf'); assert.equal(uniqueName('a.pdf', used), 'a_3.pdf');
});

test('the ZIP writer produces a readable archive', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);   // the standard CRC-32 check value
  const files = [{ name: 'one.pdf', data: new Uint8Array([1, 2, 3]) }, { name: 'twö.pdf', data: new Uint8Array(1000).fill(7) }];
  const buf = new Uint8Array(await makeZip(files).arrayBuffer()), dv = new DataView(buf.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);                           // first local header
  assert.equal(dv.getUint32(buf.length - 22, true), 0x06054b50);             // end of central directory
  assert.equal(dv.getUint16(buf.length - 22 + 10, true), 2);                 // two entries
});
