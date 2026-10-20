import { TOD, DAY, TODISO, isoOf } from './data.js';

/* ---------------------------------------------------------------------
   Maayasthra Task. A board is a row of columns: one column per person,
   plus an optional "Priority Tasks" column at the start (the pool).
   A task lists the columns it appears in (cols). Until the database
   exists, boards and tasks are kept in each browser (localStorage).
   --------------------------------------------------------------------- */
export const POOL = 'priority';
export const PRIO = { high: ['High', '#FF453A'], med: ['Medium', '#FF9F0A'], low: ['Low', '#0A84FF'] };
export const LABELS = ['Design', 'Motion', 'Development', 'Client', 'Copy', 'Urgent'];
export const LABEL_C = { Design: '#BF5AF2', Motion: '#FF375F', Development: '#0A84FF', Client: '#FF9F0A', Copy: '#30D158', Urgent: '#FF453A' };

export const BOARDS0 = [
  { id: 'b-ret', name: 'Retainers', pool: false },
  { id: 'b-gen', name: 'General', pool: true }
];

const d = n => isoOf(TOD + n * DAY);
let sid = 100;
const subs = (...a) => a.map(([t, done]) => ({ id: ++sid, t, done: !!done }));
const cm = (by, text, ago) => ({ id: ++sid, by, text, at: Date.now() - ago * 3600000 });

// [board, title, client, columns, priority, due offset, labels, creator, done]
const T = [
  ['b-ret', 'Monthly social media calendar', 'Nila Tea Co.', [12], 'med', 3, ['Copy'], 8],
  ['b-ret', 'Instagram reels (4)', 'Orbit Fitness', [13, 31], 'high', 2, ['Motion'], 8],
  ['b-ret', 'Packaging refresh concepts', 'Nila Tea Co.', [10], 'med', 6, ['Design'], 3],
  ['b-ret', 'Website maintenance, October', 'Kaveri Foods', [15], 'low', 8, ['Development'], 5],
  ['b-ret', 'Newsletter design', 'Meenakshi Silks', [18], 'med', 1, ['Design'], 3],
  ['b-ret', 'SEO monthly report', 'Vihaan Labs', [28], 'low', 9, ['Copy'], 4],
  ['b-ret', 'Brand asset requests', 'Orbit Fitness', [9], 'med', 4, ['Design'], 3],
  ['b-ret', 'Festive ad creatives', 'Meenakshi Silks', [9, 11], 'high', 0, ['Design', 'Urgent'], 8],
  ['b-ret', 'Retainer review call prep', 'Kaveri Foods', [8], 'med', -1, ['Client'], 8],
  ['b-ret', 'Monthly invoice and report', 'Nila Tea Co.', [23], 'low', 5, ['Client'], 8],
  ['b-ret', 'Homepage banner updates', 'Kaveri Foods', [17], 'low', 7, ['Design'], 3],
  ['b-ret', 'Video edit: customer story', 'Vihaan Labs', [32], 'med', 10, ['Motion'], 7],
  ['b-ret', 'Quarterly strategy note', 'Orbit Fitness', [4], 'med', 14, [], 4],
  ['b-ret', 'Blog posts (3)', 'Vihaan Labs', [35], 'med', 4, ['Copy'], 4],
  ['b-ret', 'Brand guideline refresh', 'Nila Tea Co.', [9], 'low', 12, ['Design'], 3, true],
  ['b-gen', 'Client pitch deck: Sahyadri Hotels', '', [POOL], 'high', 2, ['Client', 'Urgent'], 1],
  ['b-gen', 'Fix checkout bug on Kaveri store', '', [POOL], 'high', 1, ['Development', 'Urgent'], 1],
  ['b-gen', 'Diwali greeting video', '', [POOL], 'high', 5, ['Motion'], 1],
  ['b-gen', 'Update agency credentials deck', '', [POOL], 'med', 4, ['Design'], 1],
  ['b-gen', 'Shortlist senior copywriter candidates', '', [POOL], 'med', 7, [], 2],
  ['b-gen', 'Studio wifi upgrade quote', '', [POOL], 'low', 9, [], 2],
  ['b-gen', 'Q4 planning deck', '', [4], 'high', 3, [], 1],
  ['b-gen', 'Invoice reconciliation', '', [27], 'med', -2, [], 2],
  ['b-gen', 'New joiner checklist', '', [26], 'low', 2, [], 2],
  ['b-gen', 'Annual offsite logistics', '', [2], 'med', 20, [], 1],
  ['b-gen', 'Leave policy update draft', '', [2], 'med', 4, [], 2],
  ['b-gen', 'Portfolio case studies refresh', '', [11], 'med', 7, ['Design'], 1],
  ['b-gen', 'Staging deployment', '', [5], 'high', 14, ['Development'], 1],
  ['b-gen', 'Accessibility audit', '', [38], 'med', 2, ['Development'], 5],
  ['b-gen', 'Renew design software licences', '', [5], 'low', -8, [], 1, true]
];

export const TASKS0 = T.map(([board, title, client, cols, prio, off, labels, by, done], i) => ({
  id: 't' + (i + 1), board, title, client, cols, prio, due: d(off), labels, by, done: !!done, desc: '', subs: [], comments: [], created: Date.now() - (14 - i % 9) * 86400000
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
export const inCol = (t, col) => t.cols.includes(col);
export const mkTask = (o, user) => ({ id: newId(), board: '', title: '', client: '', cols: [], prio: 'med', due: '', labels: [], by: user.n, done: false, desc: '', subs: [], comments: [], created: Date.now(), ...o });

const without = (cols, c) => cols.filter(x => x !== c);
// Move a card from one column to another. Optionally place it before another card.
export function moveCard(ts, id, from, to, beforeId) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  const cols = t.cols.includes(to) ? without(t.cols, from) : t.cols.map(c => c === from ? to : c);
  const nt = { ...t, cols: from === to ? t.cols : cols };
  const rest = ts.filter(x => x.id !== id), i = beforeId ? rest.findIndex(x => x.id === beforeId) : -1;
  if (i >= 0) rest.splice(i, 0, nt); else rest.push(nt);
  return rest;
}
// Copy: the same card also appears in another column and stays in sync.
export const copyCard = (ts, id, to) => ts.map(t => t.id === id && !t.cols.includes(to) ? { ...t, cols: [...t.cols, to] } : t);
// Duplicate: an independent copy in another column.
export function duplicateCard(ts, id, to, user) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  const c = { ...t, id: newId(), cols: [to], by: user.n, done: false, created: Date.now(), subs: t.subs.map(s => ({ ...s, id: Date.now() + Math.random(), done: false })), comments: [], labels: [...t.labels] };
  const i = ts.findIndex(x => x.id === id); const out = [...ts]; out.splice(i + 1, 0, c); return out;
}
// Delete a card from one column. The task itself goes when no column is left.
export const deleteCard = (ts, id, col) => ts.flatMap(t => t.id !== id ? [t] : (t.cols.length > 1 && col != null ? [{ ...t, cols: without(t.cols, col) }] : []));

export function loadTasks() { try { const s = JSON.parse(localStorage.getItem('mp-tasks2')); if (Array.isArray(s) && s.length) return s; } catch (x) {} return TASKS0; }
export function loadBoards() { try { const s = JSON.parse(localStorage.getItem('mp-boards')); if (Array.isArray(s) && s.length) return s; } catch (x) {} return BOARDS0; }
export function saveTasks(t) { try { localStorage.setItem('mp-tasks2', JSON.stringify(t)); } catch (x) {} }
export function saveBoards(b) { try { localStorage.setItem('mp-boards', JSON.stringify(b)); } catch (x) {} }
