import { TOD, DAY, TODISO, isoOf, BY } from './data.js';

/* ---------------------------------------------------------------------
   Maayasthra Task: columns, labels, sample projects and tasks.
   Until the database exists, tasks live in each browser (localStorage).
   --------------------------------------------------------------------- */
export const COLS = [['todo', 'To do', '#8E8E93'], ['doing', 'In progress', '#0A84FF'], ['review', 'In review', '#BF5AF2'], ['done', 'Done', '#30D158']];
export const COL = Object.fromEntries(COLS.map(c => [c[0], c]));
export const PRIO = { high: ['High', '#FF453A'], med: ['Medium', '#FF9F0A'], low: ['Low', '#0A84FF'] };
export const LABELS = ['Design', 'Motion', 'Development', 'Client', 'Copy', 'Urgent'];
export const LABEL_C = { Design: '#BF5AF2', Motion: '#FF375F', Development: '#0A84FF', Client: '#FF9F0A', Copy: '#30D158', Urgent: '#FF453A' };
export const PROJECT_COLORS = ['#0A84FF', '#BF5AF2', '#30D158', '#FF9F0A', '#FF375F', '#64D2FF'];

const d = n => isoOf(TOD + n * DAY);
let sid = 100;
const subs = (...a) => a.map(([t, done]) => ({ id: ++sid, t, done: !!done }));
const cm = (by, text, ago) => ({ id: ++sid, by, text, at: Date.now() - ago * 3600000 });

export const PROJECTS0 = [
  { id: 'p1', name: 'Brand identity', client: 'Nila Tea Co.', color: '#BF5AF2' },
  { id: 'p2', name: 'Launch film', client: 'Orbit Fitness', color: '#FF375F' },
  { id: 'p3', name: 'Website redesign', client: 'Kaveri Foods', color: '#30D158' },
  { id: 'p4', name: 'Studio operations', client: 'Maayasthra', color: '#FF9F0A' }
];

// [id, project, title, status, priority, assignee, due offset (days), labels, creator]
const T = [
  [1, 'p1', 'Logo exploration, round 2', 'doing', 'high', 9, 2, ['Design'], 3],
  [2, 'p1', 'Packaging dieline review', 'review', 'med', 10, 1, ['Design'], 3],
  [3, 'p1', 'Brand voice guide', 'todo', 'low', 12, 9, ['Copy'], 11],
  [4, 'p1', 'Colour palette sign-off with client', 'todo', 'high', 8, 0, ['Client', 'Urgent'], 3],
  [5, 'p1', 'Moodboard v1', 'done', 'med', 11, -4, ['Design'], 3],
  [6, 'p1', 'Typography shortlist', 'done', 'low', 17, -6, ['Design'], 3],
  [7, 'p1', 'Social avatar set', 'todo', 'low', 9, 5, ['Design'], 3],
  [8, 'p1', 'Export brand assets pack', 'todo', 'med', 9, 8, ['Design'], 11],
  [9, 'p2', 'Storyboard frames 1 to 12', 'doing', 'high', 13, 3, ['Motion'], 6],
  [10, 'p2', 'Voice-over script', 'review', 'med', 35, 1, ['Copy'], 6],
  [11, 'p2', 'Location shoot schedule', 'todo', 'med', 19, 5, ['Client'], 7],
  [12, 'p2', 'Sound design brief', 'todo', 'low', 34, 10, ['Motion'], 6],
  [13, 'p2', 'Animatic cut v1', 'doing', 'med', 31, -1, ['Motion'], 6],
  [14, 'p2', 'Talent contracts', 'done', 'high', 20, -3, ['Client'], 7],
  [15, 'p3', 'Homepage wireframes', 'done', 'high', 17, -5, ['Design'], 3],
  [16, 'p3', 'UI kit components', 'doing', 'med', 18, 4, ['Design'], 3],
  [17, 'p3', 'Product page build', 'doing', 'high', 15, 6, ['Development'], 5],
  [18, 'p3', 'Store locator API', 'todo', 'med', 16, 12, ['Development'], 5],
  [19, 'p3', 'Content migration plan', 'todo', 'low', 28, 8, ['Copy'], 4],
  [20, 'p3', 'Accessibility audit', 'review', 'med', 38, 2, ['Development'], 5],
  [21, 'p3', 'Staging deployment', 'todo', 'high', 5, 14, ['Development', 'Urgent'], 5],
  [22, 'p4', 'Update portfolio case studies', 'todo', 'med', 11, 7, ['Design'], 1],
  [23, 'p4', 'Q4 planning deck', 'doing', 'high', 4, 3, [], 1],
  [24, 'p4', 'New joiner checklist', 'review', 'low', 26, 2, [], 2],
  [25, 'p4', 'Annual offsite logistics', 'todo', 'med', 2, 20, [], 1],
  [26, 'p4', 'Invoice reconciliation', 'doing', 'med', 27, -2, [], 2],
  [27, 'p4', 'Renew design software licences', 'done', 'low', 5, -8, [], 1],
  [28, 'p4', 'Leave policy update draft', 'doing', 'med', 2, 4, [], 2]
];

export const TASKS0 = T.map(([n, project, title, status, prio, assignee, off, labels, by]) => ({
  id: 't' + n, project, title, status, prio, assignee, due: d(off), labels, by, desc: '', subs: [], comments: [], created: Date.now() - (14 - n % 9) * 86400000
}));
const set = (id, p) => { const t = TASKS0.find(x => x.id === id); Object.assign(t, p); };
set('t1', { desc: 'Three directions for the primary mark. Keep one hand-drawn option and one geometric option.', subs: subs(['Sketch 10 rough ideas', true], ['Pick top 3', true], ['Vectorise the 3 marks', true], ['Mock up on packaging', false], ['Prepare client presentation', false]), comments: [cm(3, 'Love the leaf idea. Can we see it in a single colour as well?', 20), cm(9, 'Yes, adding a one-colour version today.', 6)] });
set('t4', { desc: 'Client wants to confirm the final palette before packaging goes to print.', subs: subs(['Send palette PDF', true], ['Book a 15 minute call', false]), comments: [cm(8, 'Call is booked for 4 PM today.', 3)] });
set('t9', { desc: 'Twelve key frames covering the full 45 second film.', subs: subs(['Frames 1 to 4', true], ['Frames 5 to 8', false], ['Frames 9 to 12', false]) });
set('t17', { desc: 'Build from the approved wireframes using the new UI kit.', subs: subs(['Layout and grid', true], ['Gallery component', false], ['Add to cart flow', false]) });
set('t2', { comments: [cm(3, 'Dieline looks good. Check the bleed on the lid.', 8)] });

/* ---------- helpers ---------- */
export const dueState = (due, status) => status === 'done' ? 'done' : !due ? 'none' : due < TODISO ? 'over' : due === TODISO ? 'today' : due <= isoOf(TOD + 7 * DAY) ? 'soon' : 'later';
export const isOpen = t => t.status !== 'done';

// Move a task to a column, placing it before another task, or at the end of that column.
export function moveTask(ts, id, status, beforeId) {
  const t = ts.find(x => x.id === id); if (!t) return ts;
  const rest = ts.filter(x => x.id !== id), nt = { ...t, status };
  const i = beforeId ? rest.findIndex(x => x.id === beforeId) : -1;
  if (i >= 0) { rest.splice(i, 0, nt); return rest; }
  let last = -1; rest.forEach((x, k) => { if (x.status === status) last = k; });
  rest.splice(last + 1, 0, nt); return rest;
}
export const newId = () => 't' + Date.now().toString(36) + Math.floor(Math.random() * 1000);

export function loadTasks() { try { const s = JSON.parse(localStorage.getItem('mp-tasks')); if (Array.isArray(s) && s.length) return s; } catch (x) {} return TASKS0; }
export function loadProjects() { try { const s = JSON.parse(localStorage.getItem('mp-projects')); if (Array.isArray(s) && s.length) return s; } catch (x) {} return PROJECTS0; }
export function saveTasks(t) { try { localStorage.setItem('mp-tasks', JSON.stringify(t)); } catch (x) {} }
export function saveProjects(p) { try { localStorage.setItem('mp-projects', JSON.stringify(p)); } catch (x) {} }
