import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Load the Google Apps Script file as plain JavaScript. Only its pure helpers are called, so no Google services are needed.
const src = fs.readFileSync(new URL('../integrations/google-sheet/Code.gs', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\nthis.__api = { authHeaders, monthName, monthTitle, quoteSheet, buildMonthGrid, buildTeamGrid, teamName, peopleIn, sortMonthsDesc, colLetter, FIRST, NCOL, HEADERS, WIDTHS, FONT };', ctx);
const A = ctx.__api, plain = x => JSON.parse(JSON.stringify(x));
const env = { parseDay: iso => 'D:' + iso, fmtTime: ts => 'T:' + ts };

const lines = [
  { day: '2026-11-10', employee_id: '101', name: 'Aarav Menon', dept: 'Design', project: 'CMC', sub: null, note: 'Layouts', hours: 2.5, kind: 'main', submitted: 's1', day_total: 5 },
  { day: '2026-11-10', employee_id: '101', name: 'Aarav Menon', dept: 'Design', project: 'WL', sub: null, note: 'Carousel', hours: null, kind: 'main', submitted: 's1', day_total: null },
  { day: '2026-11-10', employee_id: '101', name: 'Aarav Menon', dept: 'Design', project: 'WL', sub: 'Slide 1', note: 'Copy', hours: 1, kind: 'sub', submitted: 's1', day_total: null },
  { day: '2026-11-10', employee_id: '101', name: 'Aarav Menon', dept: 'Design', project: 'WL', sub: 'Slide 2', note: '', hours: 1.5, kind: 'sub', submitted: 's1', day_total: null },
  { day: '2026-11-11', employee_id: '202', name: 'Kavya Reddy', dept: 'Motion', project: 'CMC', sub: null, note: 'Revisions', hours: 3, kind: 'main', submitted: 's2', day_total: 3 }
];

test('month names and titles', () => {
  assert.equal(A.monthName('2026-11'), 'Nov 2026'); assert.equal(A.monthTitle('2026-01'), 'January 2026'); assert.equal(A.monthName('2025-12'), 'Dec 2025');
});
test('one row per project line or subtask, ten columns including hidden employee identity', () => {
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
  assert.deepEqual(plain(A.peopleIn(A.buildMonthGrid(lines, env))), [{ id: '101', name: 'Aarav Menon' }, { id: '202', name: 'Kavya Reddy' }]);
});
test('months sort newest first and tab names are quoted for formulas', () => {
  assert.deepEqual(plain(A.sortMonthsDesc(['2026-09', '2026-11', '2026-10'])), ['2026-11', '2026-10', '2026-09']);
  assert.equal(A.quoteSheet('Nov 2026'), "'Nov 2026'"); assert.equal(A.quoteSheet("Owner's"), "'Owner''s'");
});
test('column letters', () => { assert.equal(A.colLetter(1), 'A'); assert.equal(A.colLetter(26), 'Z'); assert.equal(A.colLetter(27), 'AA'); });
test('the sheet is set in Inter', () => { assert.equal(A.FONT, 'Inter'); assert.match(src, /setFontFamily\(FONT\)/); });

/* ---- run the whole sync against a stand-in for Google's services ---- */
const RANGE_METHODS = new Set(['setValues', 'setValue', 'setFormula', 'setFormulas', 'setBackground', 'setBackgrounds', 'setFontColor', 'setFontColors', 'setFontWeight', 'setFontWeights', 'setFontFamily', 'setFontSize', 'setFontSizes', 'setFontStyle', 'setVerticalAlignment', 'setHorizontalAlignment', 'setNumberFormat', 'setWrap', 'setWrapStrategy', 'setBorder', 'merge', 'breakApart', 'createFilter', 'offset', 'getSheet', 'getRow', 'getNumColumns', 'getValues']);
const SHEET_METHODS = new Set(['getDataRange', 'clear', 'getMaxRows', 'getMaxColumns', 'insertRowsAfter', 'insertColumnsAfter', 'getRange', 'setHiddenGridlines', 'setColumnWidth', 'setRowHeight', 'setFrozenRows', 'setFrozenColumns', 'getFilter', 'getSheetId', 'getLastRow', 'hideColumns', 'getRangeList']);
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
        if (k === 'setFormulas') a[0].forEach(row => row.forEach(f => { assert.match(f, /^=/, 'setFormulas must receive only generated formulas'); log.formulas.push([sh.name, f]); }));
        if (k === 'setValue') { log.values.push([sh.name, [[a[0]]]]); if (typeof a[0] === 'string' && a[0][0] === '=') log.formulas.push([sh.name, a[0]]); }
        if (k === 'setValues') { log.values.push([sh.name, a[0]]); a[0].forEach(row => row.forEach(v => { if (typeof v === 'string' && v[0] === '=') log.formulas.push([sh.name, v]); })); }
        if (k === 'merge') {
          if (c <= sh.frozenCols && c + nc - 1 > sh.frozenCols) throw new Error('Cannot merge across frozen columns');
          sh.merges.push({ r, c, nr, nc });
        }
        if (k === 'breakApart') {
          const overlaps = m => !(m.r + m.nr <= r || r + nr <= m.r || m.c + m.nc <= c || c + nc <= m.c);
          if (sh.merges.some(m => overlaps(m) && !(r <= m.r && c <= m.c && r + nr >= m.r + m.nr && c + nc >= m.c + m.nc))) throw new Error('Must select all cells in a merged range');
          sh.merges = sh.merges.filter(m => !overlaps(m));
        }
        if (k === 'setValue' || k === 'setFormula') { sh.usedRows = Math.max(sh.usedRows, r); sh.usedCols = Math.max(sh.usedCols, c); }
        if (k === 'setValues' || k === 'setFormulas') {
          sh.usedRows = Math.max(sh.usedRows, r + a[0].length - 1);
          sh.usedCols = Math.max(sh.usedCols, c + Math.max(...a[0].map(row => row.length)) - 1);
        }
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
    const sh = { name, id: nextId++, rows: 100, cols: 26, filter: null, frozen: 0, frozenCols: 0, merges: [], usedRows: 0, usedCols: 0 };
    sh.self = new Proxy(sh, { get(t, k) {
      if (typeof k === 'symbol' || k === 'then' || k in t) return t[k];
      if (!SHEET_METHODS.has(k)) throw new Error('Sheet has no method ' + String(k));
      return (...a) => ({
        getRangeList: names => { assert.ok(Array.isArray(names) && names.every(n => /^[A-Z]+\d+:[A-Z]+\d+$/.test(n))); return { setBorder() { return this; } }; },
        getDataRange: () => mkRange(sh, 1, 1, Math.max(1, sh.usedRows), Math.max(1, sh.usedCols)), clear: () => { sh.usedRows = 0; sh.usedCols = 0; return sh; }, getMaxRows: () => sh.rows, getMaxColumns: () => sh.cols,
        insertRowsAfter: (_, n) => { sh.rows += n; }, insertColumnsAfter: (_, n) => { sh.cols += n; },
        getRange: (...b) => typeof b[0] === 'string' ? mkRange(sh, 1, 1, 1, 1) : mkRange(sh, b[0], b[1], b[2] || 1, b[3] || 1),
        setHiddenGridlines: () => {}, setColumnWidth: () => {}, setRowHeight: () => {}, setFrozenRows: n => { sh.frozen = n; }, setFrozenColumns: n => {
          if (sh.merges.some(m => m.c <= n && m.c + m.nc - 1 > n)) throw new Error('Cannot freeze only part of a merged cell');
          sh.frozenCols = n;
        },
        hideColumns: () => {}, getFilter: () => sh.filter, getSheetId: () => sh.id, getLastRow: () => 0
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
    SpreadsheetApp: { getActiveSpreadsheet: () => ssObj, WrapStrategy: { CLIP: 'CLIP' }, BorderStyle: { SOLID: 'S', SOLID_MEDIUM: 'M', SOLID_THICK: 'T' }, getUi: () => ({}) },
    Utilities: { parseDate: (s) => 'date:' + s, formatDate: () => '14 Nov, 8:14 PM' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, setProperties: values => { Object.assign(props, values); }, deleteProperty: k => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: fn => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => log.triggers.push(fn) }) }) }), deleteTrigger: () => {} },
    UrlFetchApp: { fetch: (url, opt) => { const body = JSON.parse(opt.payload); log.fetches.push({ url, body, headers: opt.headers }); const fn = url.split('/rpc/')[1]; const d = rpcData(fn, body); return { getResponseCode: () => d.code || 200, getContentText: () => JSON.stringify(d.body) }; } }
  };
  return { g, sheets, props, log };
}
function loadWith(fake) {
  const c = vm.createContext({ console, ...fake.g });
  vm.runInContext(src + '\nthis.__api = { rebuildAll, syncChanges, startAuto, rpc, connect };', c);
  return c.__api;
}
const data = (fn, b) => fn === 'eod_export_months' ? { body: ['2026-11', '2026-10'] }
  : fn === 'eod_export_changes' ? { body: { now: '2026-11-14T14:06:28+00:00', months: ['2026-11', '2026-10'], versions: { '2026-11': '2', '2026-10': '1' } } }
  : { body: b.p_month === '2026-11' ? lines : [{ ...lines[4], day: '2026-10-05' }] };

test('rebuild all writes a tab per month and a summary, in Inter, with formulas for the totals', () => {
  const fake = fakeGoogle(data); fake.props.SUPABASE_URL = 'https://x.supabase.co/'; fake.props.SUPABASE_ANON_KEY = 'anon'; fake.props.EXPORT_TOKEN = 'tok';
  const api = loadWith(fake); api.rebuildAll();
  assert.deepEqual([...fake.sheets.keys()].sort(), ['Nov 2026', 'Nov 2026 Team', 'Oct 2026', 'Oct 2026 Team', 'Summary']);
  assert.ok(fake.log.fonts.has('Inter') && fake.log.fonts.size === 1);
  const f = fake.log.formulas.filter(x => x[0] === 'Nov 2026').map(x => x[1]);
  assert.ok(f.includes('=SUM(G6:G10)') && f.includes('=COUNT(H6:H10)') && f.includes('=COUNTUNIQUE(J6:J10)'), f.join(' | '));
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
  const fake = fakeGoogle(data); Object.assign(fake.props, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', EXPORT_TOKEN: 'tok', LAST_SYNC: '2026-11-14T14:00:00+00:00', EXPORT_VERSIONS: JSON.stringify({ '2026-11': '1', '2026-10': '1' }) });
  const api = loadWith(fake); api.syncChanges();
  assert.deepEqual([...fake.sheets.keys()].sort(), ['Nov 2026', 'Nov 2026 Team', 'Summary']);
  assert.equal(fake.props.LAST_SYNC, '2026-11-14T14:06:28+00:00');
  assert.deepEqual(JSON.parse(fake.props.EXPORT_VERSIONS), { '2026-11': '2', '2026-10': '1' });
});
test('with nothing new, sync writes nothing', () => {
  const fake = fakeGoogle((fn, b) => fn === 'eod_export_changes' ? { body: { now: 'N', months: [], versions: {} } } : { body: [] }); Object.assign(fake.props, { SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'k', EXPORT_TOKEN: 't' });
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


const connected = fake => { Object.assign(fake.props, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'dummy', EXPORT_TOKEN: 'dummy' }); return fake; };
test('untrusted fields stay literal while generated totals stay formulas', () => {
  const hostile = { ...lines[0], name: '=1+1', dept: '=2+2', project: '=3+3', sub: '=4+4', note: '=5+5', kind: 'sub' };
  const fake = connected(fakeGoogle((fn) => fn === 'eod_export_changes' ? { body: { now: 'start', versions: { '2026-11': '1' } } } : fn === 'eod_export_months' ? { body: ['2026-11'] } : { body: [hostile] }));
  loadWith(fake).rebuildAll();
  const formulas = fake.log.formulas.map(x => x[1]);
  for (const f of ['=1+1', '=2+2', '=3+3', '=4+4', '=5+5']) assert.ok(!formulas.includes(f));
  const values = fake.log.values.flatMap(x => x[1].flat());
  for (const f of ['=1+1', '=2+2', '=3+3', '=4+4', '=5+5']) assert.ok(values.includes("'" + f));
  assert.ok(formulas.includes('=SUM(G6:G6)'));
});
test('different employee IDs with the same name keep separate summary formulas', () => {
  const same = [{ ...lines[0], employee_id: '101', name: 'Same Name' }, { ...lines[4], employee_id: '202', name: 'Same Name' }];
  const fake = connected(fakeGoogle(fn => fn === 'eod_export_changes' ? { body: { now: 'start', versions: { '2026-11': '1' } } } : fn === 'eod_export_months' ? { body: ['2026-11'] } : { body: same }));
  loadWith(fake).rebuildAll();
  assert.equal(JSON.parse(fake.props['PEOPLE_2026-11']).length, 2);
  const sums = fake.log.formulas.filter(x => x[0] === 'Summary' && x[1].includes('SUMIFS')).map(x => x[1]);
  assert.equal(sums.length, 2); assert.ok(sums.some(x => x.includes('"employee:101"'))); assert.ok(sums.some(x => x.includes('"employee:202"')));
});
test('missing ID fails clearly before writing an ambiguous export', () => {
  assert.throws(() => A.buildMonthGrid([{ ...lines[0], employee_id: null }], env), /migration 0047/);
});
test('deleting the final report removes only the owned generated month, including during a full rebuild', () => {
  let deleted = false;
  const fake = connected(fakeGoogle(fn => fn === 'eod_export_changes' ? { body: { now: 'N', versions: { '2026-11': deleted ? '2' : '1' } } } : fn === 'eod_export_months' ? { body: deleted ? [] : ['2026-11'] } : { body: deleted ? [] : lines }));
  const api = loadWith(fake); api.rebuildAll();
  fake.g.SpreadsheetApp.getActiveSpreadsheet().insertSheet('My notes');
  deleted = true; api.syncChanges();
  assert.ok(!fake.sheets.has('Nov 2026')); assert.ok(!fake.sheets.has('Nov 2026 Team')); assert.ok(fake.sheets.has('My notes')); assert.ok(fake.sheets.has('Summary'));
  assert.deepEqual(JSON.parse(fake.props.MONTHS), []); assert.equal(fake.props['PEOPLE_2026-11'], undefined);
  deleted = false; api.rebuildAll(); deleted = true; api.rebuildAll();
  assert.ok(!fake.sheets.has('Nov 2026')); assert.deepEqual(JSON.parse(fake.props.MONTHS), []);
});
test('a revision change rewrites a partially deleted month even with no surviving updated report', () => {
  let rows = lines, revision = '1';
  const fake = connected(fakeGoogle(fn => fn === 'eod_export_changes' ? { body: { now: 'N', months: [], versions: { '2026-11': revision } } } : fn === 'eod_export_months' ? { body: ['2026-11'] } : { body: rows }));
  const api = loadWith(fake); api.rebuildAll(); fake.log.values.length = 0;
  rows = [lines[4]]; revision = '2'; api.syncChanges();
  const bodies = fake.log.values.filter(x => x[0] === 'Nov 2026' && x[1][0]?.length === 10 && String(x[1][0][0]).startsWith('date:'));
  assert.equal(bodies.length, 1); assert.equal(bodies[0][1].length, 1); assert.equal(bodies[0][1][0][1], 'Kavya Reddy');
});
test('a concurrent change during a long rebuild replays on next sync regardless of elapsed time', () => {
  let revision = '1', reads = 0;
  const fake = connected(fakeGoogle(fn => {
    if (fn === 'eod_export_changes') return { body: { now: '2026-11-14T10:00:00Z', versions: { '2026-11': revision } } };
    if (fn === 'eod_export_months') return { body: ['2026-11'] };
    reads++; revision = '2'; return { body: lines };
  }));
  const api = loadWith(fake); api.rebuildAll();
  assert.equal(JSON.parse(fake.props.EXPORT_VERSIONS)['2026-11'], '1');
  api.syncChanges(); assert.equal(reads, 2); assert.equal(JSON.parse(fake.props.EXPORT_VERSIONS)['2026-11'], '2');
});
test('failed month write never advances the revision snapshot and is retried', () => {
  let fail = true, reads = 0;
  const fake = connected(fakeGoogle(fn => fn === 'eod_export_changes' ? { body: { now: 'N', versions: { '2026-11': '2' } } } : (reads++, fail ? { code: 500, body: { message: 'retry' } } : { body: lines })));
  fake.props.EXPORT_VERSIONS = JSON.stringify({ '2026-11': '1' });
  const api = loadWith(fake); assert.throws(() => api.syncChanges(), /retry/);
  assert.equal(JSON.parse(fake.props.EXPORT_VERSIONS)['2026-11'], '1');
  fail = false; api.syncChanges(); assert.equal(reads, 2); assert.equal(JSON.parse(fake.props.EXPORT_VERSIONS)['2026-11'], '2');
});
test('legacy properties force an ID-aware rewrite, and old server fails closed', () => {
  const fake = connected(fakeGoogle(data)); fake.props.MONTHS = JSON.stringify(['2026-11']); fake.props['NAMES_2026-11'] = JSON.stringify(['Aarav Menon']);
  loadWith(fake).syncChanges(); assert.ok(fake.props['PEOPLE_2026-11']); assert.equal(fake.props['NAMES_2026-11'], undefined);
  const old = connected(fakeGoogle(() => ({ body: { now: 'N', months: [] } })));
  assert.throws(() => loadWith(old).syncChanges(), /migration 0047/); assert.equal(old.props.EXPORT_VERSIONS, undefined);
});

test('an initially empty full rebuild produces only Summary and no stale month totals', () => {
  const fake = connected(fakeGoogle(fn => fn === 'eod_export_changes' ? { body: { now: 'N', versions: {} } } : { body: [] }));
  loadWith(fake).rebuildAll();
  assert.deepEqual([...fake.sheets.keys()], ['Summary']);
  assert.ok(!fake.log.formulas.some(x => x[1].includes('SUMIFS')));
});


test('orphan month deletion retries a failed summary even after its manifest entry is gone', () => {
  let deleted = false;
  const fake = connected(fakeGoogle(fn => fn === 'eod_export_changes' ? { body: { now: 'N', versions: deleted ? {} : { '2026-11': '1' } } } : fn === 'eod_export_months' ? { body: deleted ? [] : ['2026-11'] } : { body: deleted ? [] : lines }));
  const api = loadWith(fake); api.rebuildAll();
  fake.props.EXPORT_VERSIONS = '{}'; // Legacy/orphan month absent from the server's revision manifest.
  const summary = fake.sheets.get('Summary'); let attempts = 0;
  summary.clear = () => { if (++attempts === 1) throw new Error('temporary summary write failure'); return summary; };
  deleted = true;
  assert.throws(() => api.syncChanges(), /temporary summary/);
  assert.ok(!fake.sheets.has('Nov 2026')); assert.deepEqual(JSON.parse(fake.props.MONTHS), []);
  assert.equal(fake.props.SUMMARY_DIRTY, '1');
  api.syncChanges();
  assert.equal(attempts, 2); assert.equal(fake.props.SUMMARY_DIRTY, undefined);
});


function connectionPrompts(fake, answers) {
  const alerts = [];
  fake.g.SpreadsheetApp.getUi = () => ({ ButtonSet: { OK_CANCEL: 'buttons', OK: 'ok' }, Button: { OK: 'ok' },
    prompt: () => { const value = answers.shift(); return { getSelectedButton: () => value === null ? 'cancel' : 'ok', getResponseText: () => value }; },
    alert: (...args) => alerts.push(args)
  });
  return alerts;
}
test('cancelled connection leaves all old credentials and revisions unchanged', () => {
  const fake = connected(fakeGoogle(data)); fake.props.EXPORT_VERSIONS = '{"2026-11":"1"}';
  const before = { ...fake.props }; connectionPrompts(fake, ['https://new.supabase.co', null]);
  loadWith(fake).connect(); assert.deepEqual(fake.props, before); assert.equal(fake.log.fetches.length, 0);
});
test('successful connection resets revisions even when another project has coincident counters', () => {
  const fake = connected(fakeGoogle(data)); Object.assign(fake.props, { EXPORT_VERSIONS: '{"2026-11":"2","2026-10":"1"}', MONTHS: '["2026-11"]', LAST_SYNC: 'old' });
  connectionPrompts(fake, ['https://new.supabase.co/', 'new-anon', 'new-token']);
  loadWith(fake).connect();
  assert.equal(fake.props.SUPABASE_URL, 'https://new.supabase.co'); assert.equal(fake.props.EXPORT_TOKEN, 'new-token');
  assert.equal(fake.props.EXPORT_VERSIONS, ''); assert.equal(fake.props.LAST_SYNC, ''); assert.equal(fake.props.SUMMARY_DIRTY, '1');
  assert.equal(fake.props.MONTHS, '["2026-11"]');
  assert.equal(fake.log.fetches[0].headers.apikey, 'new-anon'); assert.equal(fake.log.fetches[0].body.p_token, 'new-token');
});
test('failed connection probe preserves the complete prior configuration', () => {
  const fake = connected(fakeGoogle(() => ({ code: 400, body: { message: 'Not allowed' } })));
  fake.props.EXPORT_VERSIONS = '{"2026-11":"1"}'; const before = { ...fake.props };
  connectionPrompts(fake, ['https://new.supabase.co', 'new-anon', 'wrong-token']);
  loadWith(fake).connect(); assert.deepEqual(fake.props, before);
});


test('summary title stays unmerged across the frozen employee column, including on rebuild', () => {
  const fake = connected(fakeGoogle(data)), api = loadWith(fake);
  api.rebuildAll(); api.rebuildAll();
  const summary = fake.sheets.get('Summary');
  assert.equal(summary.frozenCols, 1);
  assert.ok(!summary.merges.some(m => m.c <= 1 && m.c + m.nc - 1 > 1));
});


test('upgrade unmerges old titles extending beyond the used-data range on both owned tabs', () => {
  const fake = connected(fakeGoogle(data)), api = loadWith(fake);
  api.rebuildAll();
  const summary = fake.sheets.get('Summary');
  summary.setFrozenColumns(0);
  summary.getRange(1, 1, 1, 7).merge().setValue('Old merged summary title');
  assert.throws(() => summary.getDataRange().breakApart(), /all cells in a merged range/);
  const month = fake.sheets.get('Nov 2026');
  month.getRange(1, 1, month.getMaxRows(), month.getMaxColumns()).breakApart();
  month.getRange(1, 1, 1, 20).merge().setValue('Old wider month title');
  assert.throws(() => month.getDataRange().breakApart(), /all cells in a merged range/);
  api.rebuildAll();
  assert.equal(summary.frozenCols, 1);
  assert.ok(summary.merges.length === 0);
  assert.ok(month.merges.every(m => m.c + m.nc - 1 <= 10));
});

test('the key is sent the right way for both key styles', () => {
  const jwt = 'eyJhbGciOi.payload.sig', pub = 'sb_publishable_abc123';
  assert.deepEqual(plain(A.authHeaders(jwt)), { apikey: jwt, Authorization: 'Bearer ' + jwt });   // older anon public key: a JWT
  assert.deepEqual(plain(A.authHeaders(pub)), { apikey: pub });                                    // newer publishable key: apikey header only
});

test('days are marked: one date group per day, the first line of each day flagged', () => {
  const g = A.buildMonthGrid(lines, env);
  assert.deepEqual(plain(g.dayStart), [true, false, false, false, true]);
  assert.deepEqual(plain(g.dayGroup), [0, 0, 0, 0, 1]);
  const two = A.buildMonthGrid([lines[0], { ...lines[4], day: '2026-11-10', employee_id: '202' }, lines[4]], env);   // two people on one day, then a new day
  assert.deepEqual(plain(two.dayStart), [true, false, true]); assert.deepEqual(plain(two.first), [true, true, true]);
});

test('team grid: a row per calendar day, a text and an hours cell per person, hours kept separate', () => {
  const g = A.buildTeamGrid(lines, '2026-11', { parseDay: iso => 'D:' + iso, today: '2026-11-12' });
  assert.equal(g.days.length, 30); assert.deepEqual(plain(g.people.map(p => p.name)), ['Aarav Menon', 'Kavya Reddy']);
  const a = g.cells[9][0];                                   // 10 Nov, Aarav
  assert.equal(a.hours, 5); assert.equal(a.text, 'CMC - Layouts  |  WL - Carousel  |  \u2022 Slide 1 - Copy  |  \u2022 Slide 2');
  assert.ok(!/hrs?\b|\d\.\d/.test(a.text), 'no hours inside the text');
  assert.deepEqual(plain(g.totals), [5, 3]);
  assert.equal(g.cells[10][1].hours, 3); assert.equal(g.days[0].date, 'D:2026-11-01');
});
test('team grid: weekends grey, past weekdays without a report missing, later days open', () => {
  const g = A.buildTeamGrid(lines, '2026-11', { parseDay: iso => iso, today: '2026-11-12' });
  assert.equal(g.days[0].name, 'Sunday'); assert.equal(g.days[0].state[0], 'weekend');       // 1 Nov 2026 is a Sunday
  assert.equal(g.days[1].state[0], 'missing');                                               // Monday 2 Nov, nothing sent
  assert.equal(g.days[9].state[0], 'report'); assert.equal(g.days[9].state[1], 'missing');   // Kavya sent nothing on the 10th
  assert.equal(g.days[11].state[0], 'open'); assert.equal(g.days[12].state[0], 'open');     // 12 Nov is today, 13 Nov is later
});
test('team grid: untrusted text stays literal and a missing ID fails clearly', () => {
  const g = A.buildTeamGrid([{ ...lines[4], note: '=HYPERLINK("x")', project: '', name: '=bad' }], '2026-11', { parseDay: i => i, today: '2026-11-30' });
  assert.equal(g.people[0].name, "'=bad"); assert.ok(g.cells[10][0].text.startsWith("'"));
  assert.throws(() => A.buildTeamGrid([{ ...lines[0], employee_id: null }], '2026-11', { parseDay: i => i, today: 'x' }), /employee IDs/);
});

test('Team name collisions preserve user tabs and stop before month writes', () => {
  const fake = connected(fakeGoogle(data)), ss = fake.g.SpreadsheetApp.getActiveSpreadsheet();
  const personal = ss.insertSheet('Nov 2026 Team'); personal.getRange(1,1).setValue('Keep my notes');
  const before = fake.log.values.length;
  assert.throws(() => loadWith(fake).rebuildAll(), /not owned/);
  assert.equal(fake.log.values.length, before); assert.equal(personal.usedRows, 1);
  assert.equal(fake.props['TEAM_ID_2026-11'], undefined);
});
test('legacy MONTHS never grants ownership of a same-name Team tab', () => {
  const fake = connected(fakeGoogle(fn => ({body:fn==='eod_export_changes'?{now:'N',versions:{'2026-11':'2'}}:[]})));
  fake.props.MONTHS='["2026-11"]';const ss=fake.g.SpreadsheetApp.getActiveSpreadsheet();ss.insertSheet('Nov 2026');
  const personal=ss.insertSheet('Nov 2026 Team');personal.getRange(1,1).setValue('Keep');
  loadWith(fake).syncChanges();assert.equal(fake.sheets.get('Nov 2026 Team'),personal);assert.equal(personal.usedRows,1);
});
test('replacing a deleted owned Team tab with a same-name personal tab never adopts it', () => {
  const fake=connected(fakeGoogle(data)),api=loadWith(fake),ss=fake.g.SpreadsheetApp.getActiveSpreadsheet();api.rebuildAll();
  const id=fake.props['TEAM_ID_2026-11'];ss.deleteSheet(fake.sheets.get('Nov 2026 Team'));const personal=ss.insertSheet('Nov 2026 Team');
  assert.notEqual(String(personal.getSheetId()),id);assert.throws(()=>api.rebuildAll(),/not owned/);
});
test('day rollover refreshes Team state without report edits, including month boundaries', () => {
  let today='2026-11-30';const fake=connected(fakeGoogle(data));fake.g.Utilities.formatDate=(_,__,pattern)=>pattern==='yyyy-MM-dd'?today:'timestamp';
  const api=loadWith(fake);api.rebuildAll();fake.log.fetches.length=0;fake.log.values.length=0;
  today='2026-12-01';api.syncChanges();
  assert.deepEqual(fake.log.fetches.filter(x=>x.url.endsWith('eod_export_month')).map(x=>x.body.p_month),['2026-11']);
  assert.ok(fake.log.values.some(x=>x[0]==='Nov 2026 Team'));assert.equal(fake.props.TEAM_DAY,today);
  fake.log.values.length=0;api.syncChanges();assert.equal(fake.log.values.length,0);
});
