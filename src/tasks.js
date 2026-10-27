import { TOD, DAY, TODISO, isoOf } from './data.js';
import { IS_DEMO } from './env.js';

/* ---------------------------------------------------------------------
   Maayasthra Task: one General board. Columns, left to right:
   two pinned ones (Priority Tasks, Retainer Tasks), one per person,
   and Completed Tasks at the end. A task lists the columns it appears in.
   Until the database exists, tasks are kept in each browser.
   --------------------------------------------------------------------- */
export const PINNED = [['pending', 'Pending Tasks', '#8E8E93'], ['retainer', 'Retainer Tasks', '#0A84FF'], ['priority', 'Priority Tasks', '#8E8E93']];
export const DONE = 'done';
export const PRIO = { high: ['High', '#FF453A'], med: ['Medium', '#FF9F0A'], low: ['Low', '#0A84FF'] };
export const LABELS = ['Design', 'Motion', 'Development', 'Client', 'Copy', 'Urgent'];
export const LABEL_C = { Design: '#BF5AF2', Motion: '#FF375F', Development: '#0A84FF', Client: '#FF9F0A', Copy: '#30D158', Urgent: '#FF453A' };

const d = n => isoOf(TOD + n * DAY);
let sid = 100;
const subs = (...a) => a.map(([t, done]) => ({ id: ++sid, t, done: !!done }));
const cm = (by, text, ago) => ({ id: ++sid, by, text, at: Date.now() - ago * 3600000 });

// [title, client, columns, priority, due offset, labels, creator, done]
const T = IS_DEMO ? [
  ['Client pitch deck: Sahyadri Hotels', '', ['priority'], 'high', 2, ['Client', 'Urgent'], 1],
  ['Fix checkout bug on Kaveri store', 'Kaveri Foods', ['priority'], 'high', 1, ['Development', 'Urgent'], 1],
  ['Diwali greeting video', '', ['priority'], 'high', 5, ['Motion'], 1],
  ['Update agency credentials deck', '', ['priority'], 'med', 4, ['Design'], 1],
  ['Shortlist senior copywriter candidates', '', ['priority'], 'med', 7, [], 2],
  ['Monthly social media calendar', 'Nila Tea Co.', ['retainer'], 'med', 3, ['Copy'], 8],
  ['Newsletter design', 'Meenakshi Silks', ['retainer'], 'med', 1, ['Design'], 3],
  ['SEO monthly report', 'Vihaan Labs', ['retainer'], 'low', 9, ['Copy'], 4],
  ['Website maintenance, October', 'Kaveri Foods', ['retainer'], 'low', 8, ['Development'], 5],
  ['Quarterly strategy note', 'Orbit Fitness', ['retainer'], 'med', 14, [], 4],
  ['Instagram reels (4)', 'Orbit Fitness', [13, 31], 'high', 2, ['Motion'], 8],
  ['Packaging refresh concepts', 'Nila Tea Co.', [10], 'med', 6, ['Design'], 3],
  ['Brand asset requests', 'Orbit Fitness', [9], 'med', 4, ['Design'], 3],
  ['Festive ad creatives', 'Meenakshi Silks', [9, 11], 'high', 0, ['Design', 'Urgent'], 8],
  ['Retainer review call prep', 'Kaveri Foods', [8], 'med', -1, ['Client'], 8],
  ['Monthly invoice and report', 'Nila Tea Co.', [23], 'low', 5, ['Client'], 8],
  ['Homepage banner updates', 'Kaveri Foods', [17], 'low', 7, ['Design'], 3],
  ['Video edit: customer story', 'Vihaan Labs', [32], 'med', 10, ['Motion'], 7],
  ['Blog posts (3)', 'Vihaan Labs', [35], 'med', 4, ['Copy'], 4],
  ['Q4 planning deck', '', [4], 'high', 3, [], 1],
  ['Invoice reconciliation', '', [27], 'med', -2, [], 2],
  ['New joiner checklist', '', [26], 'low', 2, [], 2],
  ['Annual offsite logistics', '', [2], 'med', 20, [], 1],
  ['Leave policy update draft', '', [2], 'med', 4, [], 2],
  ['Portfolio case studies refresh', '', [11], 'med', 7, ['Design'], 1],
  ['Staging deployment', '', [5], 'high', 14, ['Development'], 1],
  ['Accessibility audit', '', [38], 'med', 2, ['Development'], 5],
  ['Brand guideline refresh', 'Nila Tea Co.', [9], 'low', 12, ['Design'], 3, true],
  ['Renew design software licences', '', [5], 'low', -8, [], 1, true]
] : [];

export const TASKS0 = T.map(([title, client, cols, prio, off, labels, by, done], i) => ({
  id: 't' + (i + 1), title, client, cols: done ? [DONE] : cols, prev: done ? cols : undefined, prio, due: d(off), labels, by, done: !!done, desc: '', subs: [], comments: [], created: Date.now() - (14 - i % 9) * 86400000
}));
const set = (title, p) => { const t = TASKS0.find(x => x.title === title); Object.assign(t, p); };
if (IS_DEMO) {
set('Instagram reels (4)', { desc: 'Four reels for the October campaign. Nikhil cuts, Naina does the motion graphics.', subs: subs(['Script and shot list', true], ['Rough cuts', false], ['Motion graphics', false], ['Client review', false]), comments: [cm(8, 'Client wants a festive feel in reel 3.', 20), cm(13, 'Noted, adding a lantern sequence.', 6)] });
set('Festive ad creatives', { desc: 'Print and social set for the Diwali sale.', subs: subs(['Hero visual', true], ['Social crops', false], ['Print layout', false]), comments: [cm(8, 'Final files are needed by end of day.', 3)] });
set('Client pitch deck: Sahyadri Hotels', { desc: 'Pitch on Friday. Need case studies, a mood direction and pricing.', subs: subs(['Case studies', false], ['Mood direction', false], ['Pricing page', false]) });
set('Fix checkout bug on Kaveri store', { desc: 'Customers see a blank screen after entering a coupon code.' });
}

/* ---------- helpers ---------- */
export const isOpen = t => !t.done;
export const dueState = (due, done) => done ? 'done' : !due ? 'none' : due < TODISO ? 'over' : due === TODISO ? 'today' : due <= isoOf(TOD + 7 * DAY) ? 'soon' : 'later';
export const newId = () => 't' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
export const mkTask = (o, user) => ({ id: newId(), title: '', client: '', cols: [], prio: 'med', due: '', labels: [], by: user.n, done: false, desc: '', subs: [], comments: [], time: [], created: Date.now(), ...o });
export const colName = (c, BY, custom = []) => c === 'priority' ? 'Priority Tasks' : c === 'pending' ? 'Pending Tasks' : c === 'retainer' ? 'Retainer Tasks' : c === DONE ? 'Completed Tasks' : typeof c === 'string' ? ((custom.find(x => x.id === c) || {}).name || '') : (BY[c] ? BY[c].name : '');
// Removing a custom column sends its cards back to Priority Tasks.
export const dropColumn = (ts, id) => ts.map(t => !t.cols.includes(id) ? t : { ...t, cols: [...new Set(t.cols.map(c => c === id ? 'priority' : c))] });

const without = (cols, c) => cols.filter(x => x !== c);

/* ---------- Time spent on a card ---------- */
// time = [{ id, emp, start, end }] in milliseconds. end is null while a timer is running.
export const closeSessions = (time, now = Date.now()) => (time || []).map(s => s.end == null ? { ...s, end: Math.max(now, s.start) } : s);
// Cards that belong in a person's My Tasks: on their column, or finished while they were on it
export const myTasksOf = (tasks, n) => tasks.filter(t => (t.cols || []).includes(n) || (t.done && (t.prev || []).includes(n)));
// When a card leaves someone, their timer on it stops
export const stopFor = (time, n, now = Date.now()) => (time || []).map(s => s.emp === n && s.end == null ? { ...s, end: Math.max(now, s.start) } : s);
const stopRemoved = (t, nt, now = Date.now()) => nt.done ? nt : { ...nt, time: (t.cols || []).filter(c => typeof c === 'number' && !nt.cols.includes(c)).reduce((time, c) => stopFor(time, c, now), nt.time || t.time || []) };
export const isDoing = (t, n) => !t.done && (t.time || []).some(s => s.emp === n && s.end == null);
export const spentMs = (t, now = Date.now(), n) => (t.time || []).reduce((sum, s) => (n == null || s.emp === n) ? sum + Math.max(0, (s.end == null ? now : s.end) - s.start) : sum, 0);
// Time inside a window (a week, a month), for the hours report
export const spentIn = (t, from, to, now = Date.now(), n) => (t.time || []).reduce((sum, s) => (n == null || s.emp === n) ? sum + Math.max(0, Math.min(s.end == null ? now : s.end, to) - Math.max(s.start, from)) : sum, 0);
export const fmtDur = (ms, secs = false) => { const t = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return secs ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m ? m + ' min' : t ? '< 1 min' : '0 min'; };
// Mark a card as Doing for me (reopening it if it was completed). Several cards can be Doing at once. Pause takes mine off it.
export function startTimer(ts, id, n, now = Date.now()) {
  return ts.map(t => {
    if (t.id !== id) return t;
    if (isDoing(t, n)) return t;
    const open = t.done ? { ...t, done: false, cols: t.prev && t.prev.length ? t.prev : [n] } : t;
    return { ...open, time: [...(t.time || []), { id: now + '-' + n, emp: n, start: now, end: null }] };
  });
}
export const pauseTimer = (ts, id, n, now = Date.now()) => ts.map(t => t.id !== id ? t : { ...t, time: (t.time || []).map(s => s.emp === n && s.end == null ? { ...s, end: Math.max(now, s.start) } : s) });
// Move a card to another column (optionally before another card). Moving into Completed finishes it; moving out reopens it.
export function moveCard(ts, id, from, to, beforeId) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  let nt;
  if (to === DONE) nt = { ...t, done: true, prev: t.cols.filter(c => c !== DONE), cols: [DONE], time: closeSessions(t.time) };
  else if (from === DONE || t.done) nt = { ...t, done: false, cols: [to] };
  else nt = stopRemoved(t, { ...t, cols: from === to ? t.cols : t.cols.includes(to) ? without(t.cols, from) : t.cols.map(c => c === from ? to : c) });
  const rest = ts.filter(x => x.id !== id), i = beforeId ? rest.findIndex(x => x.id === beforeId) : -1;
  if (i >= 0) rest.splice(i, 0, nt); else rest.push(nt);
  return rest;
}
export const completeCard = (ts, id) => { const t = ts.find(x => x.id === id); return t && !t.done ? moveCard(ts, id, t.cols[0], DONE) : ts; };
export function reopenCard(ts, id, fallback) {
  return ts.map(t => t.id !== id ? t : { ...t, done: false, cols: t.prev && t.prev.length ? t.prev : [fallback] });
}
// Copy: the same card also appears in another column and stays in sync.
export const copyCard = (ts, id, to) => ts.map(t => t.id === id && !t.done && !t.cols.includes(to) ? { ...t, cols: [...t.cols, to] } : t);
// Duplicate: an independent copy in another column.
export function duplicateCard(ts, id, to, user) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  const c = { ...t, id: newId(), cols: [to], prev: undefined, by: user.n, done: false, created: Date.now(), subs: t.subs.map(s => ({ ...s, id: Date.now() + Math.random(), done: false })), comments: [], time: [], labels: [...t.labels] };
  const i = ts.findIndex(x => x.id === id); const out = [...ts]; out.splice(i + 1, 0, c); return out;
}
// Delete a card from one column. The task itself goes when no column is left.
export const deleteCard = (ts, id, col) => ts.flatMap(t => t.id !== id ? [t] : (t.cols.length > 1 && col != null ? [stopRemoved(t, { ...t, cols: without(t.cols, col) })] : []));

const get = (k, f) => { try { const s = JSON.parse(localStorage.getItem(k)); if (s) return s; } catch (x) {} return f; };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} };
export const loadTasks = () => { const s = get('mp-tasks3', null); return Array.isArray(s) && s.length ? s : TASKS0; };
export const saveTasks = t => put('mp-tasks3', t);
export const loadCollapsed = () => get('mp-collapsed', {});
export const saveCollapsed = c => put('mp-collapsed', c);
export const loadCustom = () => get('mp-cols', []);
export const saveCustom = c => put('mp-cols', c);
export const loadLayout = () => ({ order: [], hidden: [], ...get('mp-layout', {}) });
export const saveLayout = l => put('mp-layout', l);
export const loadView = () => ({ dept: 'All', hideEmpty: false, labels: [], lfilter: false, ...get('mp-kbview', {}) });
export const saveView = v => put('mp-kbview', v);
