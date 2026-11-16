/* Time spent on tasks. Pure functions with no app imports, so the rules can be tested on their own.
   A task's time is a list of work sessions { id, emp, start, end } in milliseconds; end is null while the session is running.
   Start opens a session, Pause or Done closes it. Nothing is ever erased, so pausing never loses hours. */

const closeMine = (time, n, now) => (time || []).map(s => s.emp === n && s.end == null ? { ...s, end: Math.max(now, s.start) } : s);
const runningFor = (t, n) => (t.time || []).some(s => s.emp === n && s.end == null);

// How long this person has worked on one card, running session included
export const workedMs = (t, n, now = Date.now()) => (t.time || []).reduce((sum, s) => s.emp === n ? sum + Math.max(0, (s.end == null ? now : s.end) - s.start) : sum, 0);

// Each card this person worked on between from and to (a day, in milliseconds), longest first. Under a minute is left out.
// Several cards can run at once. Time when two or more were running together is shared equally between them, so the day's total is the
// time actually worked and not double. rows.shared says whether any time was shared.
export function trackedIn(tasks, n, from, to, now = Date.now()) {
  const runs = [];
  for (const t of tasks) for (const s of t.time || []) if (s.emp === n) { const a = Math.max(s.start, from), b = Math.min(s.end == null ? now : s.end, to); if (b > a) runs.push({ id: t.id, title: t.title, a, b }); }
  const edges = [...new Set(runs.flatMap(r => [r.a, r.b]))].sort((x, y) => x - y), ms = new Map(); let shared = false;
  for (let i = 0; i + 1 < edges.length; i++) {
    const lo = edges[i], hi = edges[i + 1], on = runs.filter(r => r.a <= lo && r.b >= hi);
    if (on.length > 1) shared = true;
    on.forEach(r => ms.set(r.id, (ms.get(r.id) || 0) + (hi - lo) / on.length));
  }
  const rows = [...ms].map(([id, m]) => ({ id, title: runs.find(r => r.id === id).title, ms: m })).filter(r => r.ms >= 60000).sort((x, y) => y.ms - x.ms);
  rows.shared = shared;
  return rows;
}

// Milliseconds as decimal hours rounded to the minute, the way the report keeps time (1h 30m = 1.5)
export const hoursText = ms => String(+(Math.round(ms / 60000) / 60).toFixed(4));

// "1h 20m", "45m", "5m"
export const shortDur = ms => { const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? h + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm'; };

// A starting description for a report line, so nothing has to be typed: "Orbit Fitness · in progress", "Completed"
export const autoNote = t => { const st = t.done ? 'completed' : 'in progress'; return t.client ? t.client + ' · ' + st : st[0].toUpperCase() + st.slice(1); };

// Subtask lines for a card that has subtasks (the report asks for time against each one). The subtasks ticked off are used; if none are,
// all of them. The time on the card is shared out evenly to the minute, and the first lines take the odd minutes. Too little time to share: none.
export function subLines(t, ms) {
  const subs = t.subs || [], picked = subs.some(s => s.done) ? subs.filter(s => s.done) : subs, mins = Math.round(ms / 60000), k = picked.length;
  if (!k || mins < k) return [];
  return picked.map((s, i) => ({ title: s.t, hours: String(+((Math.floor(mins / k) + (i < mins % k ? 1 : 0)) / 60).toFixed(4)) }));
}
