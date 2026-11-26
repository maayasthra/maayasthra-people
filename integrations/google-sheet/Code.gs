/**
 * Maayasthra People -> Google Sheet
 *
 * Keeps this spreadsheet up to date with every end-of-day report that employees submit in Maayasthra People.
 *   - One tab per month ("Nov 2026"), newest first, plus a "Summary" tab.
 *   - Every project line and subtask is its own row, with the hours, so the hours add up.
 *   - Everything is written in Inter. The tabs are rewritten on every sync, so do not type in them.
 *
 * Setup is in SETUP-SHEET.md. In short: paste this file into Extensions > Apps Script, reload the sheet, then use the
 * "EOD sync" menu: Connect, Rebuild all months, Start automatic sync.
 *
 * The sheet only READS from Maayasthra People, through three read-only database functions that need a secret token.
 * The connection details are kept in Script Properties (not in any cell).
 */

var FONT = 'Inter';
var TZ = 'Asia/Kolkata';
var SUMMARY = 'Summary';
var HEADERS = ['Date', 'Employee', 'Department', 'Project', 'Subtask', 'What was done', 'Hours', 'Day total', 'Submitted', 'Employee ID'];
var WIDTHS = [104, 170, 150, 190, 190, 430, 78, 88, 128, 100];
var FIRST = 6;               // first data row of a month tab (rows 1-5 are the title, totals and header)
var NCOL = 10;
var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var C = { ink: '#171717', ink2: '#262626', text: '#171717', muted: '#737373', line: '#e5e5e5', band: '#f7f7f7', paper: '#fafafa', brand: '#FE6D00', brandTint: '#fff4eb', white: '#ffffff', dim: '#a3a3a3' };

/* ------------------------------------------------------------------ pure helpers (no Google services, tested outside Google) */

function monthName(ym) { return MONTHS_SHORT[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4); }
function monthTitle(ym) { return MONTHS_LONG[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4); }
function quoteSheet(name) { return "'" + String(name).replace(/'/g, "''") + "'"; }

// An apostrophe asks Sheets to keep text literal (including leading = and apostrophes).
// Never apply this helper to numeric/date cells or formulas constructed by this script.
// The older "anon public" key is a JWT and is sent both ways. The newer publishable key (sb_publishable_...) is not a JWT, so it goes in the apikey header only.
function authHeaders(key) { return String(key).indexOf('eyJ') === 0 ? { apikey: key, Authorization: 'Bearer ' + key } : { apikey: key }; }

function literalText(value) { var s = String(value == null ? '' : value); return /^[\s]*[=+@\-']/.test(s) ? "'" + s : s; }
function employeeId(value) {
  var id = String(value == null ? '' : value);
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Export is missing employee IDs. Apply migration 0047 before updating the sheet.');
  return id;
}

/**
 * Turns the lines the database sends for one month into the grid written to the tab.
 * env.parseDay(iso) returns a date value; env.fmtTime(isoTimestamp) returns text such as "14 Nov, 8:14 PM".
 * Returns { rows, first, group, dayStart, dayGroup, isSub, last } where rows has NCOL values per line.
 * first: the line starts a report. dayStart: the line starts a new date. group / dayGroup count reports and dates from 0.
 */
function buildMonthGrid(lines, env) {
  var rows = [], first = [], group = [], dayStart = [], dayGroup = [], isSub = [], g = -1, d = -1, prevDay = null;
  (lines || []).forEach(function (l) {
    var start = l.day_total !== null && l.day_total !== undefined;
    if (start) g++;
    var sub = l.kind === 'sub', dayKey = String(l.day).slice(0, 10), newDay = dayKey !== prevDay;
    if (newDay) { d++; prevDay = dayKey; }
    rows.push([
      env.parseDay(String(l.day).slice(0, 10)),
      literalText(l.name),
      literalText(l.dept),
      literalText(l.project),
      literalText(sub ? l.sub : ''),
      literalText(l.note),
      l.hours === null || l.hours === undefined ? '' : Number(l.hours),
      start ? Number(l.day_total) : '',
      start ? env.fmtTime(l.submitted) : '',
      'employee:' + employeeId(l.employee_id)
    ]);
    first.push(start);
    group.push(Math.max(g, 0));
    dayStart.push(newDay); dayGroup.push(d);
    isSub.push(sub);
  });
  return { rows: rows, first: first, group: group, dayStart: dayStart, dayGroup: dayGroup, isSub: isSub, last: FIRST + rows.length - 1 };
}

/** Stable employee identities; duplicate display names remain separate people. */
function peopleIn(grid) {
  var seen = Object.create(null);
  grid.rows.forEach(function (r) { seen[r[9]] = { id: r[9].slice(9), name: r[1] }; });
  return Object.keys(seen).map(function (id) { return seen[id]; }).sort(function (a, b) { return a.name.localeCompare(b.name) || a.id.localeCompare(b.id); });
}

/**
 * The team grid for one month: one row per calendar day, and for every employee a text column and an "Hrs" column beside it.
 * env.parseDay(iso) returns a date value; env.today is today's date as yyyy-MM-dd (days before it with no report count as missing).
 * Returns { people, days, cells, totals }. cells[day][person] is null, or { text, hours }. days[i].state[p] is
 * 'report', 'weekend' (nobody expected), 'missing' (a past weekday with no report) or 'open' (today or later, no report yet).
 */
var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function buildTeamGrid(lines, ym, env) {
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  var seen = Object.create(null), byKey = Object.create(null);
  (lines || []).forEach(function (l) {
    var id = employeeId(l.employee_id), key = id + '|' + String(l.day).slice(0, 10), sub = l.kind === 'sub';
    seen[id] = { id: id, name: literalText(l.name) };
    var c = byKey[key] || (byKey[key] = { lines: [], hours: 0 });
    var text = sub ? '\u2022 ' + (l.sub || '') + (l.note ? ' - ' + l.note : '') : (l.project || '') + (l.note ? ' - ' + l.note : '');
    c.lines.push(text);
    if (l.day_total !== null && l.day_total !== undefined) c.hours += Number(l.day_total);
  });
  var people = Object.keys(seen).map(function (id) { return seen[id]; }).sort(function (a, b) { return a.name.localeCompare(b.name) || a.id.localeCompare(b.id); });
  var days = [], cells = [], totals = people.map(function () { return 0; });
  for (var d = 1; d <= count; d++) {
    var iso = ym + '-' + (d < 10 ? '0' : '') + d, dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(), weekend = dow === 0 || dow === 6;
    var row = [], state = [];
    people.forEach(function (p, i) {
      var c = byKey[p.id + '|' + iso];
      if (c) { row.push({ text: literalText(c.lines.join('  |  ')), hours: Math.round(c.hours * 100) / 100 }); state.push('report'); totals[i] += c.hours; }
      else { row.push(null); state.push(weekend ? 'weekend' : iso < env.today ? 'missing' : 'open'); }
    });
    days.push({ iso: iso, date: env.parseDay(iso), name: DAY_NAMES[dow], weekend: weekend, state: state });
    cells.push(row);
  }
  return { people: people, days: days, cells: cells, totals: totals.map(function (t) { return Math.round(t * 100) / 100; }) };
}
function teamName(ym) { return monthName(ym) + ' Team'; }

/** Months to show on the Summary tab: newest first */
function sortMonthsDesc(list) { return list.slice().sort().reverse(); }

/* ------------------------------------------------------------------ menu and setup */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('EOD sync')
    .addItem('Connect to Maayasthra People', 'connect')
    .addItem('Rebuild all months', 'rebuildAll')
    .addItem('Sync now', 'syncChanges')
    .addSeparator()
    .addItem('Start automatic sync (every minute)', 'startAuto')
    .addItem('Stop automatic sync', 'stopAuto')
    .addToUi();
}

/** Asks for the three connection details and keeps them in Script Properties, never in a cell. */
function connect() {
  var ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  var ask = function (title, text) {
    var r = ui.prompt(title, text, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return null;
    var v = String(r.getResponseText() || '').trim();
    if (!v) { ui.alert('Nothing was entered. The existing connection has not changed.'); return null; }
    return v;
  };
  var url = ask('Step 1 of 3', 'Your Supabase project URL, like https://abcd1234.supabase.co');
  if (url === null) return;
  var key = ask('Step 2 of 3', 'The PUBLISHABLE key (starts with sb_publishable_) or the older "anon public" key, from Supabase > Project Settings > API. Never the secret key');
  if (key === null) return;
  key = String(key).trim();
  if (/^sb_secret_/.test(key)) { SpreadsheetApp.getUi().alert('That is the SECRET key. Do not use it here. Use the publishable key (sb_publishable_...) or the older anon public key.'); return; }
  var token = ask('Step 3 of 3', 'The export token you set in Supabase (see SETUP-SHEET.md)');
  if (token === null) return;
  url = url.replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(url)) { ui.alert('Enter the HTTPS project URL without a path. The existing connection has not changed.'); return; }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { ui.alert('A sync is running. Try connecting again in a minute.'); return; }
  try {
    // Test the candidate as a complete set; cancellation/failure never mixes old and new secrets.
    exportSnapshot({ url: url, key: key, token: token });
    props.setProperties({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key, EXPORT_TOKEN: token,
      LAST_SYNC: '', EXPORT_VERSIONS: '', SUMMARY_DIRTY: '1' }, false);
    ui.alert('Connected', 'The connection works. Now choose EOD sync > Rebuild all months.', ui.ButtonSet.OK);
  } catch (e) { ui.alert('Could not connect', String(e.message || e) + '\n\nThe existing connection has not changed.', ui.ButtonSet.OK); }
  finally { lock.releaseLock(); }
}

function startAuto() {
  stopAuto();
  ScriptApp.newTrigger('syncChanges').timeBased().everyMinutes(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Automatic sync is on. New reports appear within about a minute.', 'EOD sync', 6);
}

function stopAuto() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncChanges') ScriptApp.deleteTrigger(t); });
}

/* ------------------------------------------------------------------ talking to Maayasthra People */

function config() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('SUPABASE_URL'), key = p.getProperty('SUPABASE_ANON_KEY'), token = p.getProperty('EXPORT_TOKEN');
  if (!url || !key || !token) throw new Error('Not connected yet. Use EOD sync > Connect to Maayasthra People.');
  return { url: url.replace(/\/+$/, ''), key: key, token: token };
}

/** Calls one of the read-only export functions and returns its JSON answer. */
function rpc(fn, args, connection) {
  var c = connection || config(), body = {};
  Object.keys(args || {}).forEach(function (k) { body[k] = args[k]; });
  body.p_token = c.token;
  var res = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: authHeaders(c.key), payload: JSON.stringify(body)
  });
  var code = res.getResponseCode(), text = res.getContentText();
  if (code >= 300) {
    var msg = text; try { msg = JSON.parse(text).message || text; } catch (x) { /* keep the raw text */ }
    throw new Error('Maayasthra People said: ' + msg + ' (' + code + ')');
  }
  return JSON.parse(text);
}

/* ------------------------------------------------------------------ syncing */

// Counters are committed with report changes, including deletions. Unlike timestamps,
// a transaction that commits late cannot fall behind a saved time cursor.
function exportSnapshot(connection) {
  var snapshot = rpc('eod_export_changes', { p_since: null }, connection);
  if (!snapshot.versions || typeof snapshot.versions !== 'object' || Array.isArray(snapshot.versions)) throw new Error('Apply migration 0047 before syncing this sheet.');
  return snapshot;
}
function rememberSnapshot(snapshot) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('EXPORT_VERSIONS', JSON.stringify(snapshot.versions));
  props.setProperty('LAST_SYNC', snapshot.now);
}

/** Runs every minute, rewriting months whose committed revision changed. */
function syncChanges() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var props = PropertiesService.getScriptProperties(), snapshot = exportSnapshot();
    var saved = props.getProperty('EXPORT_VERSIONS'), previous = JSON.parse(saved || '{}');
    var known = JSON.parse(props.getProperty('MONTHS') || '[]');
    var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), lastDay = props.getProperty('TEAM_DAY');
    var months = Object.keys(snapshot.versions).filter(function (ym) { return !saved || previous[ym] !== snapshot.versions[ym]; });
    // The first run upgrades every old generated tab to the ID-aware layout.
    known.forEach(function (ym) { if ((!saved || !Object.prototype.hasOwnProperty.call(snapshot.versions, ym)) && months.indexOf(ym) < 0) months.push(ym); });
    // Team status depends on the calendar as well as report revisions.
    if (lastDay !== today) known.forEach(function (ym) {
      var from = lastDay && lastDay < today ? lastDay.slice(0, 7) : today.slice(0, 7);
      var to = lastDay && lastDay > today ? lastDay.slice(0, 7) : today.slice(0, 7);
      if ((!lastDay || (ym >= from && ym <= to)) && months.indexOf(ym) < 0) months.push(ym);
    });
    if (months.length) {
      props.setProperty('SUMMARY_DIRTY', '1');
      months.forEach(rebuildMonth);
    }
    if (props.getProperty('SUMMARY_DIRTY')) {
      rebuildSummary();
      props.deleteProperty('SUMMARY_DIRTY');
    }
    props.setProperty('TEAM_DAY', today);
    rememberSnapshot(snapshot); // Only after all writes succeed; retries may repeat safely.
  } finally { lock.releaseLock(); }
}

/** Rewrites every month and reconciles only tabs in this script's ownership manifest. */
function rebuildAll() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { SpreadsheetApp.getActiveSpreadsheet().toast('A sync is already running. Try again in a minute.', 'EOD sync', 5); return; }
  try {
    var snapshot = exportSnapshot(), months = rpc('eod_export_months', {}), ss = SpreadsheetApp.getActiveSpreadsheet();
    var known = JSON.parse(PropertiesService.getScriptProperties().getProperty('MONTHS') || '[]');
    var refresh = months.slice();
    known.forEach(function (ym) { if (refresh.indexOf(ym) < 0) refresh.push(ym); });
    ss.setSpreadsheetTimeZone(TZ);
    var props = PropertiesService.getScriptProperties();
    props.setProperty('SUMMARY_DIRTY', '1');
    refresh.forEach(function (ym) { rebuildMonth(ym); });
    rebuildSummary();
    props.deleteProperty('SUMMARY_DIRTY');
    props.setProperty('TEAM_DAY', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'));
    rememberSnapshot(snapshot); // Start snapshot, never completion time: concurrent edits replay next sync.
    ss.toast('Done. ' + months.length + (months.length === 1 ? ' month' : ' months') + ' written.', 'EOD sync', 6);
  } finally { lock.releaseLock(); }
}

// A name can be reused by a personal tab. Only a stored tab ID proves ownership.
function exportTab(ss, key, name, create, deleting) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty(key);
  var named = ss.getSheetByName(name);
  if (named && String(named.getSheetId()) === id) return named;
  if (deleting) return null;
  if (named) throw new Error('Existing tab ' + name + ' is not owned by EOD sync. Rename it before syncing.');
  if (id && ss.getSheets().some(function (s) { return String(s.getSheetId()) === id; }))
    throw new Error('Restore the name of the generated tab: ' + name);
  if (!create) return null;
  var tab = ss.insertSheet(name);
  props.setProperty(key, String(tab.getSheetId()));
  return tab;
}

function rebuildMonth(ym) {
  var lines = rpc('eod_export_month', { p_month: ym });
  var props = PropertiesService.getScriptProperties(), list = JSON.parse(props.getProperty('MONTHS') || '[]');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), name = monthName(ym);
  var sheet = exportTab(ss, 'MONTH_ID_' + ym, name, false, !lines.length);
  var teamSheet = exportTab(ss, 'TEAM_ID_' + ym, teamName(ym), false, !lines.length);
  if (!lines.length) {
    if (list.indexOf(ym) >= 0 && (sheet || teamSheet)) {
      exportTab(ss, 'SUMMARY_ID', SUMMARY, true); // Google requires at least one tab.
      if (sheet) ss.deleteSheet(sheet);
      if (teamSheet) ss.deleteSheet(teamSheet);
    }
    props.setProperty('MONTHS', JSON.stringify(list.filter(function (m) { return m !== ym; })));
    props.deleteProperty('PEOPLE_' + ym); props.deleteProperty('NAMES_' + ym); props.deleteProperty('TEAM_ID_' + ym); props.deleteProperty('MONTH_ID_' + ym);
    return;
  }
  var grid = buildMonthGrid(lines, {
    parseDay: function (iso) { return Utilities.parseDate(iso + ' 12:00', TZ, 'yyyy-MM-dd HH:mm'); },
    fmtTime: function (ts) { return ts ? Utilities.formatDate(new Date(ts), TZ, 'd MMM, h:mm a') : ''; }
  });
  sheet = sheet || exportTab(ss, 'MONTH_ID_' + ym, name, true);
  writeMonth(sheet, ym, grid);
  if (!teamSheet) { teamSheet = ss.insertSheet(teamName(ym)); props.setProperty('TEAM_ID_' + ym, String(teamSheet.getSheetId())); }
  writeTeam(teamSheet, ym, buildTeamGrid(lines, ym, { parseDay: function (iso) { return Utilities.parseDate(iso + ' 12:00', TZ, 'yyyy-MM-dd HH:mm'); }, today: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') }));
  if (list.indexOf(ym) < 0) list.push(ym);
  props.setProperty('MONTHS', JSON.stringify(sortMonthsDesc(list)));
  props.setProperty('PEOPLE_' + ym, JSON.stringify(peopleIn(grid)));
  props.deleteProperty('NAMES_' + ym);
  tidyTabs();
}

/* ------------------------------------------------------------------ writing a month tab */

function writeMonth(sheet, ym, grid) {
  var n = grid.rows.length, last = grid.last, total = n ? last + 2 : FIRST + 1;
  // A previous title can extend beyond the used-data range; unmerge the whole owned tab.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  var needRows = Math.max(total + 2, 30), needCols = NCOL;
  if (sheet.getMaxRows() < needRows) sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < needCols) sheet.insertColumnsAfter(sheet.getMaxColumns(), needCols - sheet.getMaxColumns());
  var all = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
  all.setFontFamily(FONT).setFontSize(10).setFontColor(C.text).setVerticalAlignment('top').setBackground(C.white);
  sheet.setHiddenGridlines(true);
  for (var i = 0; i < WIDTHS.length; i++) sheet.setColumnWidth(i + 1, WIDTHS[i]);
  sheet.setFrozenRows(5);
  sheet.hideColumns(10);

  // Row 1: title bar
  var title = sheet.getRange(1, 1, 1, NCOL);
  title.merge().setValue('Employee EOD updates  ·  ' + monthTitle(ym)).setBackground(C.ink).setFontColor(C.white).setFontSize(18).setFontWeight('bold').setVerticalAlignment('middle').setHorizontalAlignment('left');
  sheet.setRowHeight(1, 48);

  // Rows 2-3: totals for the month, all formulas over the table below
  var rng = function (col) { return col + FIRST + ':' + col + last; };
  var labels = ['TOTAL HOURS', 'REPORTS', 'PEOPLE', 'AVG HOURS PER REPORT', 'DAYS COVERED', 'LAST SYNC'];
  var values = n ? [
    '=SUM(' + rng('G') + ')', '=COUNT(' + rng('H') + ')', '=COUNTUNIQUE(' + rng('J') + ')',
    '=IF(B3=0,0,A3/B3)', '=COUNTUNIQUE(' + rng('A') + ')', ''
  ] : [0, 0, 0, 0, 0, ''];
  sheet.getRange(2, 1, 1, 6).setValues([labels]).setFontSize(8.5).setFontWeight('bold').setFontColor(C.muted).setBackground(C.paper).setVerticalAlignment('bottom');
  sheet.getRange(3, 1, 1, 6).setValues([values]).setFontSize(16).setFontWeight('bold').setBackground(C.paper).setVerticalAlignment('middle').setHorizontalAlignment('left');
  sheet.getRange(3, 6).setValue('Updated ' + Utilities.formatDate(new Date(), TZ, 'd MMM, h:mm a') + ' IST').setFontSize(10).setFontWeight('normal').setFontColor(C.muted);
  sheet.getRange('A3').setNumberFormat('0.00').setFontColor(C.brand);
  sheet.getRange('B3:C3').setNumberFormat('0');
  sheet.getRange('D3').setNumberFormat('0.0');
  sheet.getRange('E3').setNumberFormat('0');
  sheet.getRange(2, 7, 2, 3).setBackground(C.paper);
  sheet.getRange(2, 1, 2, NCOL).setBorder(null, null, true, null, null, null, C.line, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(2, 22); sheet.setRowHeight(3, 34); sheet.setRowHeight(4, 8);

  // Row 5: table header
  var head = sheet.getRange(5, 1, 1, NCOL);
  head.setValues([HEADERS]).setBackground(C.ink2).setFontColor(C.white).setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle');
  head.setBorder(null, null, true, null, null, null, C.brand, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sheet.getRange(5, 7, 1, 2).setHorizontalAlignment('right');
  sheet.setRowHeight(5, 32);

  if (!n) { sheet.getRange(FIRST, 1).setValue('No reports for this month yet.').setFontColor(C.muted); return; }

  // The table
  var body = sheet.getRange(FIRST, 1, n, NCOL);
  sheet.getRange(FIRST, 10, n, 1).setNumberFormat('@');
  body.setValues(grid.rows).setWrap(true).setBorder(null, null, null, null, null, true, C.line, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(FIRST, 1, n, 1).setNumberFormat('ddd d mmm').setHorizontalAlignment('left');
  sheet.getRange(FIRST, 7, n, 2).setNumberFormat('0.00').setHorizontalAlignment('right');
  sheet.getRange(FIRST, 9, n, 1).setNumberFormat('@');
  // One shade per day (white, then a soft orange), so a day reads as one block. The date is shown once, on the day's first line;
  // on the other lines it takes the background colour (the value is still there for filters and totals).
  var bgs = [], fcs = [], fws = [], fss = [], dayRows = [], reportRows = [];
  for (var r = 0; r < n; r++) {
    var band = grid.dayGroup[r] % 2 === 1 ? C.brandTint : C.white, row = [], fc = [], fw = [], fs = [];
    for (var c = 0; c < NCOL; c++) {
      row.push(band);
      var dim = !grid.first[r] && (c === 1 || c === 2);   // employee and department stand out on the first line of a report
      var hideDate = c === 0 && !grid.dayStart[r];
      fc.push(hideDate ? band : dim ? C.dim : (c === 8 ? C.muted : (grid.isSub[r] && (c === 3) ? C.muted : C.text)));
      fw.push((grid.dayStart[r] && c === 0) || (grid.first[r] && (c === 1 || c === 7)) || (!grid.isSub[r] && c === 3) ? 'bold' : 'normal');
      fs.push(grid.dayStart[r] && c === 0 ? 12 : 10);
    }
    bgs.push(row); fcs.push(fc); fws.push(fw); fss.push(fs);
    var a1 = 'A' + (FIRST + r) + ':' + colLetter(NCOL) + (FIRST + r);
    if (grid.dayStart[r] && r > 0) dayRows.push(a1); else if (grid.first[r] && r > 0) reportRows.push(a1);
  }
  body.setBackgrounds(bgs).setFontColors(fcs).setFontWeights(fws).setFontSizes(fss);
  if (reportRows.length) sheet.getRangeList(reportRows).setBorder(true, null, null, null, null, null, C.muted, SpreadsheetApp.BorderStyle.SOLID);
  if (dayRows.length) sheet.getRangeList(dayRows).setBorder(true, null, null, null, null, null, C.ink, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sheet.getRange(FIRST, 5, n, 1).setFontStyle('italic');

  // Total row under the table, then a filter so people can pick an employee or project
  var t = sheet.getRange(total, 1, 1, NCOL);
  t.setBackground(C.brandTint).setFontWeight('bold').setVerticalAlignment('middle');
  t.setBorder(true, null, null, null, null, null, C.brand, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange(total, 1).setValue('Total for ' + monthTitle(ym));
  sheet.getRange(total, 7).setFormula('=SUM(' + rng('G') + ')').setNumberFormat('0.00').setHorizontalAlignment('right');
  sheet.getRange(total, 8).setFormula('=SUM(' + rng('H') + ')').setNumberFormat('0.00').setHorizontalAlignment('right');
  sheet.setRowHeight(total, 30);
  var oldFilter = sheet.getFilter(); if (oldFilter) oldFilter.remove();
  sheet.getRange(5, 1, n + 1, NCOL).createFilter();
}

/* ------------------------------------------------------------------ the team grid tab */

var T = { head: '#1155cc', dateCol: '#d9d9d9', weekend: '#999999', missing: '#ff0000', report: '#ffffff' };
function writeTeam(sheet, ym, g) {
  var P = g.people.length, ncol = 2 + 2 * P, nrow = g.days.length + 2;   // header, one row per day, totals
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  if (sheet.getMaxRows() < nrow + 1) sheet.insertRowsAfter(sheet.getMaxRows(), nrow + 1 - sheet.getMaxRows());
  if (sheet.getMaxColumns() < ncol) sheet.insertColumnsAfter(sheet.getMaxColumns(), ncol - sheet.getMaxColumns());
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setFontFamily(FONT).setFontSize(10).setFontColor(C.text).setVerticalAlignment('middle').setBackground(C.white);
  sheet.setHiddenGridlines(true);
  sheet.setColumnWidth(1, 100); sheet.setColumnWidth(2, 100);
  for (var p = 0; p < P; p++) { sheet.setColumnWidth(3 + 2 * p, 300); sheet.setColumnWidth(4 + 2 * p, 56); }
  var head = ['Date', 'Day'];
  g.people.forEach(function (pp) { head.push(pp.name, 'Hrs'); });
  var hr = sheet.getRange(1, 1, 1, ncol);
  hr.setValues([head]).setBackground(T.head).setFontColor(C.white).setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  sheet.setRowHeight(1, 44);
  var values = [], bgs = [], fcs = [], fws = [];
  g.days.forEach(function (day, i) {
    var v = [day.date, day.name], b = [T.dateCol, T.dateCol], fc = [C.text, C.text], fw = ['normal', 'normal'];
    g.people.forEach(function (pp, j) {
      var cell = g.cells[i][j], st = day.state[j], bg = st === 'weekend' ? T.weekend : st === 'missing' ? T.missing : T.report;
      v.push(cell ? cell.text : '', cell ? cell.hours : ''); b.push(bg, bg); fc.push(C.text, C.text); fw.push('normal', 'bold');
    });
    values.push(v); bgs.push(b); fcs.push(fc); fws.push(fw);
  });
  var n = g.days.length;
  if (n) {
    var body = sheet.getRange(2, 1, n, ncol);
    body.setValues(values).setBackgrounds(bgs).setFontColors(fcs).setFontWeights(fws).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setBorder(true, true, true, true, true, true, C.dim, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(2, 1, n, 1).setNumberFormat('dd/mm/yyyy').setHorizontalAlignment('center');
    sheet.getRange(2, 2, n, 1).setHorizontalAlignment('center');
    for (var rr = 0; rr < n; rr++) sheet.setRowHeight(2 + rr, 34);   // every box the same size; the full text is in the cell
    for (var q = 0; q < P; q++) {
      sheet.getRange(2, 3 + 2 * q, n, 1).setHorizontalAlignment('left');
      sheet.getRange(2, 4 + 2 * q, n, 1).setNumberFormat('0.00').setHorizontalAlignment('center');
    }
  }
  // Totals under the grid: hours only, with a formula so a hand correction in the sheet still adds up
  var tr = n + 2, tot = sheet.getRange(tr, 1, 1, ncol);
  tot.setBackground(C.brandTint).setFontWeight('bold').setBorder(true, null, null, null, null, null, C.brand, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange(tr, 1).setValue('Total hours');
  for (var k = 0; k < P; k++) sheet.getRange(tr, 4 + 2 * k).setFormula('=SUM(' + colLetter(4 + 2 * k) + '2:' + colLetter(4 + 2 * k) + (n + 1) + ')').setNumberFormat('0.00').setHorizontalAlignment('center');
  sheet.setRowHeight(tr, 30);
  sheet.setFrozenRows(1); sheet.setFrozenColumns(2);
}

/* ------------------------------------------------------------------ the Summary tab */

function rebuildSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
  var months = sortMonthsDesc(JSON.parse(props.getProperty('MONTHS') || '[]')).filter(function (ym) { return exportTab(ss, 'MONTH_ID_' + ym, monthName(ym), false); });
  var sheet = exportTab(ss, 'SUMMARY_ID', SUMMARY, true);
  // A previous title can extend beyond the used-data range; unmerge the whole owned tab.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart(); sheet.clear();
  var nameSet = Object.create(null);
  months.forEach(function (ym) { JSON.parse(props.getProperty('PEOPLE_' + ym) || '[]').forEach(function (person) { if (!nameSet[person.id]) nameSet[person.id] = person; }); });
  var names = Object.keys(nameSet).map(function (id) { return nameSet[id]; }).sort(function (a, b) { return a.name.localeCompare(b.name) || a.id.localeCompare(b.id); });
  var cols = Math.max(7, months.length + 2), rowsNeeded = 8 + months.length + names.length + 6;
  if (sheet.getMaxRows() < rowsNeeded) sheet.insertRowsAfter(sheet.getMaxRows(), rowsNeeded - sheet.getMaxRows());
  if (sheet.getMaxColumns() < cols) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols - sheet.getMaxColumns());
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setFontFamily(FONT).setFontSize(10).setFontColor(C.text).setVerticalAlignment('middle').setBackground(C.white);
  sheet.setHiddenGridlines(true);
  sheet.setColumnWidth(1, 190); for (var i = 2; i <= sheet.getMaxColumns(); i++) sheet.setColumnWidth(i, 118);

  // Keep the title unmerged so freezing the employee column never bisects a merged cell.
  sheet.getRange(1, 1).setValue('EOD summary  ·  all months');
  sheet.getRange(1, 1, 1, cols).setBackground(C.ink).setFontColor(C.white).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('left');
  sheet.setRowHeight(1, 48);
  sheet.getRange(2, 1).setValue('Filled in automatically from the end-of-day reports in Maayasthra People. Hours are what each person reported.').setFontColor(C.muted);

  // Block 1: one row per month, every number a formula that reads that month's tab
  var r0 = 4;
  sheet.getRange(r0, 1, 1, 6).setValues([['Month', 'Total hours', 'Reports', 'People', 'Avg hours per report', 'Days covered']]);
  styleHeader(sheet.getRange(r0, 1, 1, 6));
  months.forEach(function (ym, k) {
    var q = quoteSheet(monthName(ym)), r = r0 + 1 + k;
    sheet.getRange(r, 2, 1, 5).setFormulas([[ '=' + q + '!A3', '=' + q + '!B3', '=' + q + '!C3', '=' + q + '!D3', '=' + q + '!E3']]);
    sheet.getRange(r, 1).setFormula('=HYPERLINK("#gid=' + ss.getSheetByName(monthName(ym)).getSheetId() + '","' + monthName(ym) + '")').setFontColor(C.brand).setFontWeight('bold');
  });
  var rt = r0 + 1 + months.length;
  if (months.length) {
    sheet.getRange(rt, 1).setValue('All months');
    sheet.getRange(rt, 2, 1, 2).setFormulas([[ '=SUM(B' + (r0 + 1) + ':B' + (rt - 1) + ')', '=SUM(C' + (r0 + 1) + ':C' + (rt - 1) + ')']]);
    sheet.getRange(rt, 1, 1, 6).setBackground(C.brandTint).setFontWeight('bold').setBorder(true, null, null, null, null, null, C.brand, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(r0 + 1, 2, months.length + 1, 1).setNumberFormat('0.00');
    sheet.getRange(r0 + 1, 3, months.length + 1, 2).setNumberFormat('0');
    sheet.getRange(r0 + 1, 5, months.length, 1).setNumberFormat('0.0');
    sheet.getRange(r0 + 1, 6, months.length, 1).setNumberFormat('0');
    sheet.getRange(r0 + 1, 2, months.length + 1, 5).setHorizontalAlignment('right');
    sheet.getRange(r0 + 1, 1, months.length, 6).setBorder(null, null, null, null, null, true, C.line, SpreadsheetApp.BorderStyle.SOLID);
  }

  // Block 2: hours by employee and month
  var b0 = (months.length ? rt : r0) + 3;
  sheet.getRange(b0 - 1, 1).setValue('Hours by employee').setFontWeight('bold').setFontSize(12);
  var head2 = ['Employee'].concat(months.map(monthName), ['Total']);
  sheet.getRange(b0, 1, 1, head2.length).setValues([head2]);
  styleHeader(sheet.getRange(b0, 1, 1, head2.length));
  names.forEach(function (nm, k) {
    var r = b0 + 1 + k, f = [];
    sheet.getRange(r, 1).setValue(nm.name); // Already escaped by buildMonthGrid.
    months.forEach(function (ym) { var q = quoteSheet(monthName(ym)); f.push('=SUMIFS(' + q + '!$G:$G,' + q + '!$J:$J,"employee:' + employeeId(nm.id) + '")'); });
    f.push('=SUM(B' + r + ':' + colLetter(months.length + 1) + r + ')');
    sheet.getRange(r, 2, 1, f.length).setFormulas([f]);
  });
  if (names.length) {
    var re = b0 + names.length, lastCol = months.length + 2, rb = re + 1;
    sheet.getRange(rb, 1).setValue('Everyone');
    var tf = [];
    for (var m = 2; m <= lastCol; m++) tf.push('=SUM(' + colLetter(m) + (b0 + 1) + ':' + colLetter(m) + re + ')');
    sheet.getRange(rb, 2, 1, lastCol - 1).setFormulas([tf]).setBackground(C.brandTint).setFontWeight('bold').setBorder(true, null, null, null, null, null, C.brand, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(b0 + 1, 2, names.length + 1, lastCol - 1).setNumberFormat('0.00').setHorizontalAlignment('right');
    sheet.getRange(b0 + 1, 1, names.length, lastCol).setBorder(null, null, null, null, null, true, C.line, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(b0 + 1, lastCol, names.length, 1).setFontWeight('bold');
    sheet.setFrozenColumns(1);
  }
  tidyTabs();
}

function styleHeader(range) {
  range.setBackground(C.ink2).setFontColor(C.white).setFontWeight('bold').setVerticalAlignment('middle')
    .setBorder(null, null, true, null, null, null, C.brand, SpreadsheetApp.BorderStyle.SOLID_THICK);
  range.offset(0, 1, 1, Math.max(range.getNumColumns() - 1, 0)).setHorizontalAlignment('right');
  range.getSheet().setRowHeight(range.getRow(), 30);
}

function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/** Summary first, then months newest to oldest. */
function tidyTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
  var months = sortMonthsDesc(JSON.parse(props.getProperty('MONTHS') || '[]')), pos = 1;
  var sum = ss.getSheetByName(SUMMARY);
  if (sum) { ss.setActiveSheet(sum); ss.moveActiveSheet(pos); pos++; }
  months.forEach(function (ym) {
    [teamName(ym), monthName(ym)].forEach(function (nm) {
      var s = ss.getSheetByName(nm);
      if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(pos); pos++; }
    });
  });
  if (sum) ss.setActiveSheet(sum);
}
