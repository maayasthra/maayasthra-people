import { TOD, DAY, TODISO, isoOf } from './data.js';

/* ---------------------------------------------------------------------
   Maayasthra Task: one General board. Columns, left to right:
   two pinned ones (Priority Tasks, Retainer Tasks), one per person,
   and Completed Tasks at the end. A task lists the columns it appears in.
   Until the database exists, tasks are kept in each browser.
   --------------------------------------------------------------------- */
export const PINNED = [['priority', 'Priority Tasks', '#FF9F0A'], ['retainer', 'Retainer Tasks', '#0A84FF']];
export const DONE = 'done';
export const PRIO = { high: ['High', '#FF453A'], med: ['Medium', '#FF9F0A'], low: ['Low', '#0A84FF'] };
export const LABELS = ['Design', 'Motion', 'Development', 'Client', 'Copy', 'Urgent'];
export const LABEL_C = { Design: '#BF5AF2', Motion: '#FF375F', Development: '#0A84FF', Client: '#FF9F0A', Copy: '#30D158', Urgent: '#FF453A' };

const d = n => isoOf(TOD + n * DAY);
let sid = 100;
const subs = (...a) => a.map(([t, done]) => ({ id: ++sid, t, done: !!done }));
const cm = (by, text, ago) => ({ id: ++sid, by, text, at: Date.now() - ago * 3600000 });

// [title, client, columns, priority, due offset, labels, creator, done]
const T = [
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
];

export const TASKS0 = T.map(([title, client, cols, prio, off, labels, by, done], i) => ({
  id: 't' + (i + 1), title, client, cols: done ? [DONE] : cols, prev: done ? cols : undefined, prio, due: d(off), labels, by, done: !!done, desc: '', subs: [], comments: [], created: Date.now() - (14 - i % 9) * 86400000
}));
const set = (title, p) => { const t = TASKS0.find(x => x.title === title); Object.assign(t, p); };
set('Instagram reels (4)', { desc: 'Four reels for the October campaign. Nikhil cuts, Naina does the motion graphics.', subs: subs(['Script and shot list', true], ['Rough cuts', false], ['Motion graphics', false], ['Client review', false]), comments: [cm(8, 'Client wants a festive feel in reel 3.', 20), cm(13, 'Noted, adding a lantern sequence.', 6)] });
set('Festive ad creatives', { desc: 'Print and social set for the Diwali sale.', subs: subs(['Hero visual', true], ['Social crops', false], ['Print layout', false]), comments: [cm(8, 'Final files are needed by end of day.', 3)] });
set('Client pitch deck: Sahyadri Hotels', { desc: 'Pitch on Friday. Need case studies, a mood direction and pricing.', subs: subs(['Case studies', false], ['Mood direction', false], ['Pricing page', false]) });
set('Fix checkout bug on Kaveri store', { desc: 'Customers see a blank screen after entering a coupon code.' });

/* ---------- helpers ---------- */
export const isOpen = t => !t.done;
export const dueState = (due, done) => done ? 'done' : !due ? 'none' : due < TODISO ? 'over' : due === TODISO ? 'today' : due <= isoOf(TOD + 7 * DAY) ? 'soon' : 'later';
export const newId = () => 't' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
export const mkTask = (o, user) => ({ id: newId(), title: '', client: '', cols: [], prio: 'med', due: '', labels: [], by: user.n, done: false, desc: '', subs: [], comments: [], created: Date.now(), ...o });
export const colName = (c, BY) => c === 'priority' ? 'Priority Tasks' : c === 'retainer' ? 'Retainer Tasks' : c === DONE ? 'Completed Tasks' : (BY[c] ? BY[c].name : '');

const without = (cols, c) => cols.filter(x => x !== c);
// Move a card to another column (optionally before another card). Moving into Completed finishes it; moving out reopens it.
export function moveCard(ts, id, from, to, beforeId) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  let nt;
  if (to === DONE) nt = { ...t, done: true, prev: t.cols.filter(c => c !== DONE), cols: [DONE] };
  else if (from === DONE || t.done) nt = { ...t, done: false, cols: [to] };
  else nt = { ...t, cols: from === to ? t.cols : t.cols.includes(to) ? without(t.cols, from) : t.cols.map(c => c === from ? to : c) };
  const rest = ts.filter(x => x.id !== id), i = beforeId ? rest.findIndex(x => x.id === beforeId) : -1;
  if (i >= 0) rest.splice(i, 0, nt); else rest.push(nt);
  return rest;
}
export const completeCard = (ts, id) => { const t = ts.find(x => x.id === id); return t ? moveCard(ts, id, t.cols[0], DONE) : ts; };
export function reopenCard(ts, id, fallback) {
  return ts.map(t => t.id !== id ? t : { ...t, done: false, cols: t.prev && t.prev.length ? t.prev : [fallback] });
}
// Copy: the same card also appears in another column and stays in sync.
export const copyCard = (ts, id, to) => ts.map(t => t.id === id && !t.done && !t.cols.includes(to) ? { ...t, cols: [...t.cols, to] } : t);
// Duplicate: an independent copy in another column.
export function duplicateCard(ts, id, to, user) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  const c = { ...t, id: newId(), cols: [to], prev: undefined, by: user.n, done: false, created: Date.now(), subs: t.subs.map(s => ({ ...s, id: Date.now() + Math.random(), done: false })), comments: [], labels: [...t.labels] };
  const i = ts.findIndex(x => x.id === id); const out = [...ts]; out.splice(i + 1, 0, c); return out;
}
// Delete a card from one column. The task itself goes when no column is left.
export const deleteCard = (ts, id, col) => ts.flatMap(t => t.id !== id ? [t] : (t.cols.length > 1 && col != null ? [{ ...t, cols: without(t.cols, col) }] : []));

const get = (k, f) => { try { const s = JSON.parse(localStorage.getItem(k)); if (s) return s; } catch (x) {} return f; };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} };
export const loadTasks = () => { const s = get('mp-tasks3', null); return Array.isArray(s) && s.length ? s : TASKS0; };
export const saveTasks = t => put('mp-tasks3', t);
export const loadCollapsed = () => get('mp-collapsed', {});
export const saveCollapsed = c => put('mp-collapsed', c);
