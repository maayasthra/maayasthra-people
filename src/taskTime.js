/* Time spent on tasks. Pure functions with no app imports, so the rules can be tested on their own.
   A task's time is a list of work sessions { id, emp, start, end } in milliseconds; end is null while the session is running.
   Start opens a session, Pause or Done closes it. Nothing is ever erased, so pausing never loses hours. */

const closeMine = (time, n, now) => (time || []).map(s => s.emp === n && s.end == null ? { ...s, end: Math.max(now, s.start) } : s);
const runningFor = (t, n) => (t.time || []).some(s => s.emp === n && s.end == null);

// How long this person has worked on one card, running session included
export const workedMs = (t, n, now = Date.now()) => (t.time || []).reduce((sum, s) => s.emp === n ? sum + Math.max(0, (s.end == null ? now : s.end) - s.start) : sum, 0);

// Time this person worked on one card inside a window (a day, in milliseconds), running session included.
// The cards on My Tasks and the end-of-day report both use this, so the two always show the same time.
export const workedIn = (t, n, from, to, now = Date.now()) => (t.time || []).reduce((sum, s) => s.emp !== n ? sum : sum + Math.max(0, Math.min(s.end == null ? now : s.end, to) - Math.max(s.start, from)), 0);

// Each card this person worked on in the window, longest first. Under a minute is left out.
export const trackedIn = (tasks, n, from, to, now = Date.now()) =>
  tasks.map(t => ({ id: t.id, title: t.title, ms: workedIn(t, n, from, to, now) })).filter(r => r.ms >= 60000).sort((a, b) => b.ms - a.ms);

// Milliseconds as decimal hours rounded to the minute, the way the report keeps time (1h 30m = 1.5)
export const hoursText = ms => String(+(Math.round(ms / 60000) / 60).toFixed(4));

// "1h 20m", "45m", "5m"
export const shortDur = ms => { const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? h + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm'; };

// A starting description for a report line, so nothing has to be typed: "Orbit Fitness · in progress", "Completed"
export const autoNote = (t, n) => { const st = t.done || (n != null && (t.finished || []).includes(n)) ? 'completed' : 'in progress'; return t.client ? t.client + ' · ' + st : st[0].toUpperCase() + st.slice(1); };

// Subtask lines for a card that has subtasks (the report asks for time against each one). The subtasks ticked off are used; if none are,
// all of them. The time on the card is shared out evenly to the minute, and the first lines take the odd minutes. Too little time to share: none.
export function subLines(t, ms) {
  const subs = t.subs || [], picked = subs.some(s => s.done) ? subs.filter(s => s.done) : subs, mins = Math.round(ms / 60000), k = picked.length;
  if (!k || mins < k) return [];
  return picked.map((s, i) => ({ title: s.t, hours: String(+((Math.floor(mins / k) + (i < mins % k ? 1 : 0)) / 60).toFixed(4)) }));
}
