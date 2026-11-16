/* Payslip generator: reading pasted pay details and working out each payslip.
   Pure functions only (no browser, no app imports), so the rules can be tested on their own. See payslip-generator-spec.md.
   All money is handled in paise (whole numbers) to avoid rounding errors. */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = MONTHS.map(m => m.slice(0, 3).toLowerCase());

// Made-up people, so no real name or salary ships inside the app. Same shapes and amounts as the worked examples in the spec.
export const SAMPLE = [
  'Employee Name - Graphic Designer - 27/01/26 (Joining date)',
  '',
  'May - 30k',
  'Jun - 35k (base pay change)',
  'Jul - 35k',
  'Aug - 35k',
  'Sep - 35k',
  'Oct - 35k',
  'Nov - 5833 (Last working day - 06/11/26, 2days off, 1day LOP )',
  '',
  'Second Employee - UI/UX Designer - 05/10/26 (joining date)',
  '',
  'Oct - 35200 (Started probation at 42k on 5/10, Probation base pay revised to 30k from 28/10, (42/30*23)+(30/30*3)=(32200+3000)=35200)',
  'Nov - 10000 (Last working day - 10/11/26)'
].join('\n');

/* ---------- formatting ---------- */
const ONES = 'Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen'.split(' ');
const TENS = '_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety'.split(' ');
const below100 = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
const below1000 = n => n < 100 ? below100(n) : ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '');
export function words(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  for (const [label, size] of [['Crore', 1e7], ['Lakh', 1e5], ['Thousand', 1e3]]) {
    if (n >= size) { parts.push(words(Math.floor(n / size)) + ' ' + label); n = n % size; }
  }
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}
// 3500000 -> "Rupees Thirty Five Thousand Only."
export function amountWords(paise) {
  const rupees = Math.floor(paise / 100), p = paise % 100;
  return 'Rupees ' + words(rupees) + (p ? ' and ' + words(p) + ' Paise' : '') + ' Only.';
}
// 12345600 -> "1,23,456.00" (Indian digit grouping)
export function inr(paise) {
  const neg = paise < 0; paise = Math.abs(paise);
  let whole = String(Math.floor(paise / 100));
  const frac = ('0' + (paise % 100)).slice(-2);
  if (whole.length > 3) { const head = whole.slice(0, -3), tail = whole.slice(-3); whole = head.replace(/(\d)(?=(\d\d)+$)/g, '$1,') + ',' + tail; }
  return (neg ? '-' : '') + whole + '.' + frac;
}
export const toPaise = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? Math.round(n * 100) : 0; };
const pad2 = n => ('0' + n).slice(-2);
export const daysIn = (y, m) => new Date(y, m, 0).getDate();
const isoOf = (y, m, d) => y + '-' + pad2(m) + '-' + pad2(d);
export const fmtISO = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
export const numStr = v => { const n = parseFloat(v); return isFinite(n) ? String(n) : '0'; };
export const cleanName = s => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Employee';
export const monthLabel = it => { const p = it.month.split('-'); return MONTHS[+p[1] - 1].slice(0, 3) + ' ' + p[0]; };
// Name - Month Payslip Year - Maayasthra.pdf
export const fileNameFor = it => { const p = it.month.split('-'); return cleanName(it.name) + ' - ' + MONTHS[+p[1] - 1] + ' Payslip ' + p[0] + ' - Maayasthra.pdf'; };
// Downloadable when there is an amount, a sensible number of paid days and a real pay date
export const valid = it => toPaise(it.amt) > 0 && parseFloat(it.paid) >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(it.payDate);

/* ---------- reading the pasted text ---------- */
const DATE_RE = '\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.](?:\\d{4}|\\d{2})';
function parseDMY(s) {
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2]; let y = +m[3]; if (y < 100) y += 2000;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? { y, m: mo, d } : null;
}
const HEADER_RE = new RegExp('^(.+?)\\s+[-\\u2013\\u2014]\\s+(.+?)\\s+[-\\u2013\\u2014]\\s+(' + DATE_RE + ')');
const MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}|\d{2}))?\s*[-–—:]\s*(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k)?\b(.*)$/i;
const LW_RE = new RegExp('last working day\\s*[-\\u2013:]?\\s*(' + DATE_RE + ')', 'i');
const LOP_RE = /(\d+(?:\.\d+)?)\s*days?\s*LOP/i;
const FORMULA_RE = /\(\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)\s*\)/g;
const CALC_DIV = 30;   // a monthly salary is always split over 30 days

const prorated = it => { const p = it.month.split('-'); return parseFloat(it.paid) < daysIn(+p[0], +p[1]) || parseFloat(it.lop) > 0; };

// Works out the full monthly salary for a part month, so the payslip can show Basic Pay and a Loss of Pay line.
function fillSalary(items) {
  items.forEach((it, idx) => {
    it.salary = '';
    if (!prorated(it) || (it.terms && it.terms.length)) return;
    const amt = toPaise(it.amt) / 100, paid = parseFloat(it.paid);
    if (!(paid > 0)) return;
    const ok = S => S > 0 && Math.abs(S / CALC_DIV * paid - amt) <= 1;
    let S = 0;
    for (let j = idx - 1; j >= 0; j--) { const q = items[j]; if (q.name === it.name && !prorated(q)) { S = parseFloat(q.amt); break; } }
    if (!ok(S)) S = Math.round(amt / paid * CALC_DIV / 100) * 100;
    if (ok(S)) it.salary = String(S);
    else { it.flag = true; it.basis += '. Monthly salary not confirmed, so there is no Loss of Pay line. Enter it below.'; }
  });
}

function buildItem(emp, y, mon, paise, note, key) {
  const dim = daysIn(y, mon), joinedNow = emp.doj.y === y && emp.doj.m === mon;
  const lopM = LOP_RE.exec(note), lop = lopM ? parseFloat(lopM[1]) : 0;
  const lwM = LW_RE.exec(note);
  let lw = lwM ? parseDMY(lwM[1]) : null;
  if (lw && !(lw.y === y && lw.m === mon)) lw = null;           // only counts when it falls in this payslip's month
  let sum = 0, f; const terms = []; FORMULA_RE.lastIndex = 0;
  while ((f = FORMULA_RE.exec(note))) { terms.push({ a: parseFloat(f[1]), d: parseFloat(f[2]), n: parseFloat(f[3]) }); sum += parseFloat(f[3]); }
  const startDay = joinedNow ? emp.doj.d : 1, endDay = lw ? lw.d : dim;
  let paid, basis, flag = false;
  if (sum > 0) { paid = sum; basis = 'Paid days taken from the formula in the note'; }
  else {
    paid = endDay - startDay + 1 - lop;
    if (lw) basis = 'Last working day ' + pad2(lw.d) + '-' + pad2(lw.m) + '-' + lw.y + (lop ? ', ' + lop + ' LOP' : '');
    else if (joinedNow) { basis = 'Joined mid-month. Confirm the paid days.'; flag = true; }
    else basis = lop ? 'Full month minus ' + lop + ' LOP' : 'Full month';
  }
  if (paid <= 0) { paid = 0; flag = true; basis = 'Paid days came out as zero. Check the details.'; }
  return {
    key, name: emp.name, designation: emp.designation,
    doj: isoOf(emp.doj.y, emp.doj.m, emp.doj.d), month: y + '-' + pad2(mon),
    amt: String(paise / 100), paid: String(paid), lop: String(lop), payDate: isoOf(y, mon, dim),
    basis, flag, terms, salary: '', lwd: lw ? isoOf(y, mon, lw.d) : ''
  };
}

// Returns { items, ignored }. Every line that is not used is listed with the reason, so nothing is dropped silently.
export function parseText(text) {
  const items = [], ignored = [], seen = {};
  let emp = null, lastYM = null;
  String(text).split(/\r?\n/).forEach(raw => {
    const line = raw.trim(); if (!line) return;
    const mm = MONTH_RE.exec(line);
    if (mm) {
      if (!emp) { ignored.push({ line, why: 'month line before any employee' }); return; }
      const mon = MON3.indexOf(mm[1].toLowerCase()) + 1; let y;
      if (mm[2]) { y = +mm[2]; if (y < 100) y += 2000; }
      else { y = lastYM ? lastYM.y : emp.doj.y; if (lastYM ? mon < lastYM.m : mon < emp.doj.m) y += 1; }
      lastYM = { y, m: mon };
      if (y * 12 + mon < emp.doj.y * 12 + emp.doj.m) { ignored.push({ line, why: 'month is before the joining date' }); return; }
      const key = emp.name.toLowerCase() + '|' + y + '-' + pad2(mon);
      if (seen[key]) { ignored.push({ line, why: 'this month is already listed for ' + emp.name }); return; }
      seen[key] = true;
      const amount = parseFloat(mm[3].replace(/,/g, '')) * (mm[4] ? 1000 : 1), note = mm[5] || '';
      items.push(buildItem(emp, y, mon, Math.round(amount * 100), note, key));
      return;
    }
    const hh = HEADER_RE.exec(line);
    if (hh) {
      emp = null; lastYM = null; // A broken new header must never reuse the previous person's salary context.
      const doj = parseDMY(hh[3]);
      if (doj) { emp = { name: hh[1].trim(), designation: hh[2].trim(), doj }; lastYM = null; return; }
    }
    ignored.push({ line, why: 'not a header or month line' });
  });
  fillSalary(items);
  return { items, ignored };
}

// Edits made on a card are kept by key (employee + month), so they survive re-reading the text when it changes.
export const applyOverrides = (items, overrides) => items.map(it => overrides[it.key] ? { ...it, ...overrides[it.key] } : it);
