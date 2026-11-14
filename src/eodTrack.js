// India days, kept here so these helpers stay plain functions (they are unit-tested without the app)
const IST = 19800000;
const dayKey = t => new Date(t + IST).toISOString().slice(0, 10);
const dayStart = iso => Date.parse(iso + 'T00:00:00Z') - IST;
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export { dayStart };

/* Time tracked on task cards (the Start / Pause timers), turned into end-of-day report figures.
   A card's time is [{ id, emp, start, end }] in milliseconds; end is null while a timer is running. Days are India days. */
const DAY_MS = 86400000;
const overlap = (s, e, a, b) => Math.max(0, Math.min(e, b) - Math.max(s, a));

// Tracked time per task for one person on one day, longest first. Only whole minutes count (under a minute is ignored).
export function trackedForDay(tasks, n, iso, now = Date.now()) {
  const a = dayStart(iso), b = a + DAY_MS, out = [];
  (tasks || []).forEach(t => {
    const ms = (t.time || []).reduce((sum, s) => s.emp === n ? sum + overlap(s.start, s.end == null ? now : s.end, a, b) : sum, 0);
    if (ms >= 60000) out.push({ id: t.id, title: t.title, ms });
  });
  return out.sort((x, y) => y.ms - x.ms);
}
export const totalMs = list => list.reduce((t, x) => t + x.ms, 0);
// Milliseconds as decimal hours, to the nearest minute (the report keeps hours as numbers like 1.5)
export const toHours = ms => Math.round(ms / 60000) / 60;

// Tracked milliseconds per person per day over a range: { [emp]: { [iso]: ms } }
export function trackedRange(tasks, from, to, now = Date.now()) {
  const a = dayStart(from), b = dayStart(to) + DAY_MS, out = {};
  (tasks || []).forEach(t => (t.time || []).forEach(s => {
    const end = s.end == null ? now : s.end;
    if (end <= a || s.start >= b) return;
    for (let d = dayStart(dayKey(Math.max(s.start, a))); d < Math.min(end, b); d += DAY_MS) {
      const ms = overlap(s.start, end, d, d + DAY_MS); if (ms <= 0) continue;
      const iso = dayKey(d + 1), m = out[s.emp] || (out[s.emp] = {});
      m[iso] = (m[iso] || 0) + ms;
    }
  }));
  return out;
}
export const rangeDays = (from, to) => { const out = []; for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d); return out; };
