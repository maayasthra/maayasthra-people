import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Load the Google Apps Script file as plain JavaScript. Only its pure helpers are called, so no Google services are needed.
const src = fs.readFileSync(new URL('../integrations/google-sheet/Code.gs', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\nthis.__api = { monthName, monthTitle, quoteSheet, buildMonthGrid, namesIn, sortMonthsDesc, colLetter, FIRST, NCOL, HEADERS, WIDTHS, FONT };', ctx);
const A = ctx.__api, plain = x => JSON.parse(JSON.stringify(x));
const env = { parseDay: iso => 'D:' + iso, fmtTime: ts => 'T:' + ts };

const lines = [
  { day: '2026-11-10', name: 'Aarav Menon', dept: 'Design', project: 'CMC', sub: null, note: 'Layouts', hours: 2.5, kind: 'main', submitted: 's1', day_total: 5 },
  { day: '2026-11-10', name: 'Aarav Menon', dept: 'Design', project: 'WL', sub: null, note: 'Carousel', hours: null, kind: 'main', submitted: 's1', day_total: null },
  { day: '2026-11-10', name: 'Aarav Menon', dept: 'Design', project: 'WL', sub: 'Slide 1', note: 'Copy', hours: 1, kind: 'sub', submitted: 's1', day_total: null },
  { day: '2026-11-10', name: 'Aarav Menon', dept: 'Design', project: 'WL', sub: 'Slide 2', note: '', hours: 1.5, kind: 'sub', submitted: 's1', day_total: null },
  { day: '2026-11-11', name: 'Kavya Reddy', dept: 'Motion', project: 'CMC', sub: null, note: 'Revisions', hours: 3, kind: 'main', submitted: 's2', day_total: 3 }
];

test('month names and titles', () => {
  assert.equal(A.monthName('2026-11'), 'Nov 2026'); assert.equal(A.monthTitle('2026-01'), 'January 2026'); assert.equal(A.monthName('2025-12'), 'Dec 2025');
});
test('one row per project line or subtask, nine columns each', () => {
  const g = A.buildMonthGrid(lines, env);
  assert.equal(g.rows.length, 5); assert.ok(g.rows.every(r => r.length === A.NCOL));
  assert.equal(g.rows[0].length, A.HEADERS.length); assert.equal(A.WIDTHS.length, A.NCOL);
});
test('hours add up once: a project with subtasks has no hours of its own', () => {
  const g = A.buildMonthGrid(lines, env), sum = g.rows.reduce((t, r) => t + (r[6] === '' ? 0 : r[6]), 0);
  assert.equal(sum, 8); assert.equal(g.rows[1][6], '');
});
test('the day total and submitted time appear only on the first line of each report', () => {
  const g = A.buildMonthGrid(lines, env);
  assert.deepEqual(plain(g.rows.map(r => r[7])), [5, '', '', '', 3]); assert.deepEqual(plain(g.rows.map(r => r[8])), ['T:s1', '', '', '', 'T:s2']);
  assert.deepEqual(plain(g.first), [true, false, false, false, true]);
});
test('subtask text goes in the subtask column only for subtask rows', () => {
  const g = A.buildMonthGrid(lines, env);
  assert.deepEqual(plain(g.rows.map(r => r[4])), ['', '', 'Slide 1', 'Slide 2', '']); assert.deepEqual(plain(g.isSub), [false, false, true, true, false]);
});
test('reports are numbered in groups so alternate reports can be shaded', () => {
  assert.deepEqual(plain(A.buildMonthGrid(lines, env).group), [0, 0, 0, 0, 1]);
});
test('the table ends on the right row, and an empty month has none', () => {
  assert.equal(A.buildMonthGrid(lines, env).last, A.FIRST + 4);
  const e = A.buildMonthGrid([], env); assert.equal(e.rows.length, 0); assert.equal(e.last, A.FIRST - 1);
});
test('dates are parsed from the day, ignoring any time part', () => {
  assert.equal(A.buildMonthGrid([{ ...lines[0], day: '2026-11-10T00:00:00' }], env).rows[0][0], 'D:2026-11-10');
});
test('names are listed once each, sorted', () => {
  assert.deepEqual(plain(A.namesIn(A.buildMonthGrid(lines, env))), ['Aarav Menon', 'Kavya Reddy']);
});
test('months sort newest first and tab names are quoted for formulas', () => {
  assert.deepEqual(plain(A.sortMonthsDesc(['2026-09', '2026-11', '2026-10'])), ['2026-11', '2026-10', '2026-09']);
  assert.equal(A.quoteSheet('Nov 2026'), "'Nov 2026'"); assert.equal(A.quoteSheet("Owner's"), "'Owner''s'");
});
test('column letters', () => { assert.equal(A.colLetter(1), 'A'); assert.equal(A.colLetter(26), 'Z'); assert.equal(A.colLetter(27), 'AA'); });
test('the sheet is set in Inter', () => { assert.equal(A.FONT, 'Inter'); assert.match(src, /setFontFamily\(FONT\)/); });

/* ---- run the whole sync against a stand-in for Google's services ---- */
const RANGE_METHODS = new Set(['setValues', 'setValue', 'setFormula', 'setFormulas', 'setBackground', 'setBackgrounds', 'setFontColor', 'setFontColors', 'setFontWeight', 'setFontWeights', 'setFontFamily', 'setFontSize', 'setFontStyle', 'setVerticalAlignment', 'setHorizontalAlignment', 'setNumberFormat', 'setWrap', 'setBorder', 'merge', 'breakApart', 'createFilter', 'offset', 'getSheet', 'getRow', 'getNumColumns', 'getValues']);
const SHEET_METHODS = new Set(['getDataRange', 'clear', 'getMaxRows', 'getMaxColumns', 'insertRowsAfter', 'insertColumnsAfter', 'getRange', 'setHiddenGridlines', 'setColumnWidth', 'setRowHeight', 'setFrozenRows', 'setFrozenColumns', 'getFilter', 'getSheetId', 'getLastRow']);
function fakeGoogle(rpcData) {
  const sheets = new Map(), props = {}, log = { fetches: [], toasts: [], triggers: [], formulas: [], values: [], fonts: new Set() };
  let nextId = 1;
  const mkRange = (sh, r, c, nr, nc) => {
    const self = new Proxy({ r, c, nr, nc }, { get(t, k) {
      if (k === 'then') return undefined;
      if (typeof k === 'symbol' || k in t) return t[k];
      if (!RANGE_METHODS.has(k)) throw new Error('Range has no method ' + String(k));
      return (...a) => {
        if (k === 'setFormula') log.formulas.push([sh.name, a[0]]);
        if (k === 'setFormulas') a[0].forEach(row => row.forEach(f => log.formulas.push([sh.name, f])));
        if (k === 'setValues') { log.values.push([sh.name, a[0]]); a[0].forEach(row => row.forEach(v => { if (typeof v === 'string' && v[0] === '=') log.formulas.push([sh.name, v]); })); }
        if (k === 'setFontFamily') log.fonts.add(a[0]);
        if (k === 'getSheet') return sh.self;
        if (k === 'getRow') return r;
        if (k === 'getNumColumns') return nc;
        if (k === 'getValues') return Array.from({ length: nr }, () => Array.from({ length: nc }, () => ''));
        if (k === 'offset') return mkRange(sh, r + a[0], c + a[1], a[2] || nr, a[3] || nc);
        return self;
      };
    } });
    return self;
  };
  const mkSheet = name => {
    const sh = { name, id: nextId++, rows: 100, cols: 26, filter: null, frozen: 0 };
    sh.self = new Proxy(sh, { get(t, k) {
      if (typeof k === 'symbol' || k === 'then' || k in t) return t[k];
      if (!SHEET_METHODS.has(k)) throw new Error('Sheet has no method ' + String(k));
      return (...a) => ({
        getDataRange: () => mkRange(sh, 1, 1, sh.rows, sh.cols), clear: () => sh, getMaxRows: () => sh.rows, getMaxColumns: () => sh.cols,
        insertRowsAfter: (_, n) => { sh.rows += n; }, insertColumnsAfter: (_, n) => { sh.cols += n; },
        getRange: (...b) => typeof b[0] === 'string' ? mkRange(sh, 1, 1, 1, 1) : mkRange(sh, b[0], b[1], b[2] || 1, b[3] || 1),
        setHiddenGridlines: () => {}, setColumnWidth: () => {}, setRowHeight: () => {}, setFrozenRows: n => { sh.frozen = n; }, setFrozenColumns: () => {},
        getFilter: () => sh.filter, getSheetId: () => sh.id, getLastRow: () => 0
      })[k](...a);
    } });
    return sh.self;
  };
  const ssObj = {
    getSheetByName: n => sheets.get(n) || null, insertSheet: n => { const s = mkSheet(n); sheets.set(n, s); return s; },
    setActiveSheet: () => {}, moveActiveSheet: () => {}, getSheets: () => [...sheets.values()], deleteSheet: s => { sheets.delete(s.name); },
    toast: (...a) => log.toasts.push(a[0]), setSpreadsheetTimeZone: () => {}
  };
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ssObj, BorderStyle: { SOLID: 'S', SOLID_MEDIUM: 'M', SOLID_THICK: 'T' }, getUi: () => ({}) },
    Utilities: { parseDate: (s) => 'date:' + s, formatDate: () => '14 Nov, 8:14 PM' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: fn => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => log.triggers.push(fn) }) }) }), deleteTrigger: () => {} },
    UrlFetchApp: { fetch: (url, opt) => { const body = JSON.parse(opt.payload); log.fetches.push({ url, body, headers: opt.headers }); const fn = url.split('/rpc/')[1]; const d = rpcData(fn, body); return { getResponseCode: () => d.code || 200, getContentText: () => JSON.stringify(d.body) }; } }
  };
  return { g, sheets, props, log };
}
function loadWith(fake) {
  const c = vm.createContext({ console, ...fake.g });
  vm.runInContext(src + '\nthis.__api = { rebuildAll, syncChanges, startAuto, rpc };', c);
  return c.__api;
}
const data = (fn, b) => fn === 'eod_export_months' ? { body: ['2026-11', '2026-10'] }
  : fn === 'eod_export_changes' ? { body: { now: '2026-11-14T14:06:28+00:00', months: b.p_since ? ['2026-11'] : [] } }
  : { body: b.p_month === '2026-11' ? lines : [{ ...lines[4], day: '2026-10-05' }] };

test('rebuild all writes a tab per month and a summary, in Inter, with formulas for the totals', () => {
  const fake = fakeGoogle(data); fake.props.SUPABASE_URL = 'https://x.supabase.co/'; fake.props.SUPABASE_ANON_KEY = 'anon'; fake.props.EXPORT_TOKEN = 'tok';
  const api = loadWith(fake); api.rebuildAll();
  assert.deepEqual([...fake.sheets.keys()].sort(), ['Nov 2026', 'Oct 2026', 'Summary']);
  assert.ok(fake.log.fonts.has('Inter') && fake.log.fonts.size === 1);
  const f = fake.log.formulas.filter(x => x[0] === 'Nov 2026').map(x => x[1]);
  assert.ok(f.includes('=SUM(G6:G10)') && f.includes('=COUNT(H6:H10)') && f.includes('=COUNTUNIQUE(B6:B10)'), f.join(' | '));
  assert.ok(f.some(x => x === '=SUM(G6:G10)'), 'month total over the table');
  const s = fake.log.formulas.filter(x => x[0] === 'Summary').map(x => x[1]);
  assert.ok(s.some(x => x.includes("'Nov 2026'!$G:$G") && x.includes('SUMIFS')), 'employee by month uses SUMIFS over each tab');
  assert.equal(JSON.parse(fake.props.MONTHS).join(), '2026-11,2026-10');
});
test('every call carries the token, and the sheet never writes to Maayasthra People', () => {
  const fake = fakeGoogle(data); Object.assign(fake.props, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', EXPORT_TOKEN: 'tok' });
  loadWith(fake).rebuildAll();
  assert.ok(fake.log.fetches.length > 0 && fake.log.fetches.every(x => x.body.p_token === 'tok' && /\/rest\/v1\/rpc\/eod_export_/.test(x.url)));
  assert.ok(fake.log.fetches.every(x => x.headers.apikey === 'anon'));
});
test('sync only rewrites months that changed, and remembers the database clock', () => {
  const fake = fakeGoogle(data); Object.assign(fake.props, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', EXPORT_TOKEN: 'tok', LAST_SYNC: '2026-11-14T14:00:00+00:00' });
  const api = loadWith(fake); api.syncChanges();
  assert.deepEqual([...fake.sheets.keys()].sort(), ['Nov 2026', 'Summary']);
  assert.equal(fake.props.LAST_SYNC, '2026-11-14T14:06:28+00:00');
  const first = fake.log.fetches[0].body.p_since; assert.ok(Date.parse(first) < Date.parse('2026-11-14T14:00:00+00:00'), 'overlaps a little so nothing is missed');
});
test('with nothing new, sync writes nothing', () => {
  const fake = fakeGoogle((fn, b) => fn === 'eod_export_changes' ? { body: { now: 'N', months: [] } } : { body: [] }); Object.assign(fake.props, { SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'k', EXPORT_TOKEN: 't' });
  loadWith(fake).syncChanges(); assert.equal(fake.sheets.size, 0); assert.equal(fake.props.LAST_SYNC, 'N');
});
test('a refused token stops the sync with a clear message', () => {
  const fake = fakeGoogle(() => ({ code: 400, body: { message: 'Not allowed' } })); Object.assign(fake.props, { SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'k', EXPORT_TOKEN: 'bad' });
  assert.throws(() => loadWith(fake).syncChanges(), /Not allowed/);
});
test('not connected yet says what to do', () => {
  assert.throws(() => loadWith(fakeGoogle(data)).syncChanges(), /Connect/);
});
test('automatic sync is a one-minute trigger', () => { const fake = fakeGoogle(data); loadWith(fake).startAuto(); assert.deepEqual([...fake.log.triggers], ['syncChanges']); });
