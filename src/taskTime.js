/* Time spent on tasks. Pure functions with no app imports, so the rules can be tested on their own.
   A task's time is a list of work sessions { id, emp, start, end } in milliseconds; end is null while the session is running.
   Start opens a session, Pause or Done closes it. Nothing is ever erased, so pausing never loses hours. */

const closeMine = (time, n, now) => (time || []).map(s => s.emp === n && s.end == null ? { ...s, end: Math.max(now, s.start) } : s);
const runningFor = (t, n) => (t.time || []).some(s => s.emp === n && s.end == null);

// One active task at a time: starting a card pauses whatever else this person had running, so hours never overlap
export const pauseOthers = (tasks, keepId, n, now = Date.now()) => tasks.map(t => t.id !== keepId && runningFor(t, n) ? { ...t, time: closeMine(t.time, n, now) } : t);

// How long this person has worked on one card, running session included
export const workedMs = (t, n, now = Date.now()) => (t.time || []).reduce((sum, s) => s.emp === n ? sum + Math.max(0, (s.end == null ? now : s.end) - s.start) : sum, 0);

// Each card this person worked on between from and to (a day, in milliseconds), longest first. Under a minute is left out.
export function trackedIn(tasks, n, from, to, now = Date.now()) {
  const rows = [];
  for (const t of tasks) {
    const ms = (t.time || []).reduce((sum, s) => s.emp !== n ? sum : sum + Math.max(0, Math.min(s.end == null ? now : s.end, to) - Math.max(s.start, from)), 0);
    if (ms >= 60000) rows.push({ id: t.id, title: t.title, ms });
  }
  return rows.sort((a, b) => b.ms - a.ms);
}

// Milliseconds as decimal hours rounded to the minute, the way the report keeps time (1h 30m = 1.5)
export const hoursText = ms => String(+(Math.round(ms / 60000) / 60).toFixed(4));

// "1h 20m", "45m", "5m"
export const shortDur = ms => { const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? h + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm'; };
