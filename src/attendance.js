import { useState, useEffect } from 'react';
import { BY, HOL, TEAM_LEAVES, HIST0, DAY, pd, isoOf, isAway, activeEmps } from './data.js';

/* ---------------------------------------------------------------------
   Attendance store. Real check-ins are kept as overrides:
     att = { [employeeNumber]: { [YYYY-MM-DD]: { sessions: [{ in, out, loc }], edited?: { by, at } } } }
   Until a database exists, every other day comes from generated sample data.
   --------------------------------------------------------------------- */
export const GRACE = 20;                       // minutes after shift start before a check-in counts as late
const LUNCH_START = 13 * 60, LUNCH_END = 14 * 60;
export const LOCS = { office: 'Office', home: 'Home' };

const hmMins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayStart = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const minsOf = (t, iso) => (t - dayStart(iso)) / 60000;
export const toHM = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
export const toTs = (iso, hm) => dayStart(iso) + hmMins(hm) * 60000;
export const addDays = (iso, n) => isoOf(pd(iso) + n * DAY);
export const weekStart = iso => { const w = new Date(pd(iso)).getUTCDay(); return addDays(iso, -((w + 6) % 7)); };
export const monthDays = (y, m) => { const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Array.from({ length: n }, (_, i) => isoOf(Date.UTC(y, m, i + 1))); };
const weekday = iso => new Date(pd(iso)).getUTCDay();

let ME = null;                                  // the signed-in person starts today with a clean slate
export const setMe = n => { ME = n; };

/* ---------- sample data (deterministic) ---------- */
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const STATIC_AWAY = [...TEAM_LEAVES, ...HIST0.filter(l => l.state === 'approved')];
const cache = new Map();
function buildSample(e, iso, now) {
  const w = weekday(iso);
  if (w === 0 || w === 6 || HOL[iso] || iso < e.join || isAway(e.n, iso, STATIC_AWAY)) return null;
  const dn = Math.round(pd(iso) / DAY), r = k => hash(e.n, dn, k);
  if (r(1) < 0.04 || (now && r(2) < 0.04)) return null;
  const sm = hmMins(e.shiftStart), em = hmMins(e.shiftEnd);
  const a = r(3); const off = a < 0.7 ? -10 + r(4) * 20 : a < 0.88 ? 10 + r(4) * 10 : a < 0.96 ? 21 + r(4) * 30 : 51 + r(4) * 40;
  const start = sm + Math.round(off);
  const endm = r(5) < 0.08 ? em - 60 - Math.round(r(6) * 30) : em + Math.round(-20 + r(6) * 60);
  const loc = r(7) < 0.22 ? 'home' : 'office', base = dayStart(iso), T = m => base + m * 60000;
  let sessions;
  if (start < LUNCH_START - 30 && endm > LUNCH_END + 30 && r(8) < 0.85) {
    const o = LUNCH_START - 5 + Math.round(r(9) * 20), b = LUNCH_END - 5 + Math.round(r(10) * 20);
    sessions = [{ in: T(start), out: T(o), loc }, { in: T(b), out: T(endm), loc: r(11) < 0.1 ? (loc === 'home' ? 'office' : 'home') : loc }];
  } else sessions = [{ in: T(start), out: T(endm), loc }];
  if (now) { sessions = sessions.filter(s => s.in <= now).map(s => s.out > now ? { ...s, out: null } : s); if (!sessions.length) return null; }
  return { sessions };
}
function sampleDay(e, iso, now) {
  const today = iso === dayKey(now);
  if (!today && cache.has(e.n + '|' + iso)) return cache.get(e.n + '|' + iso);
  const out = buildSample(e, iso, today ? now : null);
  if (!today) cache.set(e.n + '|' + iso, out);
  return out;
}

export function getDay(att, n, iso, now = Date.now()) {
  const o = att[n] && att[n][iso]; if (o) return o;
  if (iso === dayKey(now) && n === ME) return { sessions: [] };
  const e = BY[n]; if (!e || iso > dayKey(now)) return { sessions: [] };
  return sampleDay(e, iso, now) || { sessions: [] };
}
const putDay = (att, n, iso, rec) => ({ ...att, [n]: { ...(att[n] || {}), [iso]: rec } });
export const saveDay = (att, n, iso, sessions, by) => putDay(att, n, iso, { sessions, edited: { by, at: Date.now() } });

/* ---------- today's check-in / check-out for the signed-in person ---------- */
export const sessionsOf = (att, n) => getDay(att, n, dayKey()).sessions;
export const isIn = sessions => sessions.length > 0 && !sessions[sessions.length - 1].out;
export const workedMs = (sessions, now) => sessions.reduce((t, s) => t + ((s.out || now) - s.in), 0);
export function checkIn(att, n, loc = 'office') { const iso = dayKey(), cur = getDay(att, n, iso); return putDay(att, n, iso, { ...cur, sessions: [...cur.sessions, { in: Date.now(), out: null, loc }] }); }
export function checkOut(att, n) { const iso = dayKey(), cur = getDay(att, n, iso); if (!isIn(cur.sessions)) return att; return putDay(att, n, iso, { ...cur, sessions: cur.sessions.map((x, i) => i === cur.sessions.length - 1 ? { ...x, out: Date.now() } : x) }); }

/* ---------- one person, one day ---------- */
// The lunch hour counts as worked when someone is checked out only for lunch.
function lunchCredit(ss, iso, now) {
  if (!ss.length) return 0;
  const ls = dayStart(iso) + LUNCH_START * 60000, le = dayStart(iso) + LUNCH_END * 60000;
  const ov = (a, b) => Math.max(0, Math.min(b, le) - Math.max(a, ls));
  const spanEnd = ss[ss.length - 1].out || now;
  return Math.max(0, ov(ss[0].in, spanEnd) - ss.reduce((t, s) => t + ov(s.in, s.out || now), 0));
}
export function dayInfo(att, e, iso, now, away) {
  const rec = getDay(att, e.n, iso, now), ss = rec.sessions, today = iso === dayKey(now);
  const w = weekday(iso), off = w === 0 || w === 6 || !!HOL[iso];
  const sm = hmMins(e.shiftStart), em = hmMins(e.shiftEnd), target = (em - sm) * 60000;
  if (!ss.length) {
    const leave = !off && isAway(e.n, iso, away);
    const state = off ? 'off' : leave ? 'leave' : iso < e.join ? 'na' : today ? (minsOf(now, iso) > sm + GRACE ? 'absent' : 'notyet') : iso > dayKey(now) ? 'future' : 'absent';
    return { state, sessions: ss, worked: 0, target, late: 0, first: null, last: null, loc: null, edited: rec.edited, behind: today && state === 'absent' ? Math.round(minsOf(now, iso) - sm) : 0 };
  }
  const live = !ss[ss.length - 1].out, worked = workedMs(ss, now) + lunchCredit(ss, iso, now);
  const late = Math.round(minsOf(ss[0].in, iso) - sm);
  return { state: live ? 'in' : 'out', sessions: ss, worked, target, late, lateFlag: late > GRACE, first: ss[0].in, last: ss[ss.length - 1].out || null,
    loc: ss[ss.length - 1].loc || 'office', live, short: !live && worked < target - 10 * 60000, over: worked > target + 30 * 60000, edited: rec.edited, behind: 0 };
}

/* ---------- formatting ---------- */
export const hms = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(v => String(v).padStart(2, '0')).join(':'); };
export const hm = ms => { const m = Math.floor(Math.max(0, ms) / 60000); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
export const clock = t => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

// Lunch is 1 to 2 pm. Inside the last hour before it, count down in minutes.
export function lunchInfo(now) {
  const d = new Date(now), m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  if (m >= LUNCH_START && m < LUNCH_END) return { state: 'on', text: 'Lunch break is on · ends in ' + Math.ceil(LUNCH_END - m) + ' min' };
  if (m < LUNCH_START && LUNCH_START - m <= 60) return { state: 'soon', text: 'Lunch break in ' + Math.ceil(LUNCH_START - m) + ' min' };
  if (m < LUNCH_START) return { state: 'later', text: 'Lunch 1:00 – 2:00 PM' };
  return { state: 'over', text: '' };
}
export const startDelta = (sessions, shiftStart, iso = dayKey()) => sessions.length ? Math.round(minsOf(sessions[0].in, iso) - hmMins(shiftStart)) : null;
export const shiftEndsIn = (now, shiftEnd) => { const d = new Date(now); return hmMins(shiftEnd) - (d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60); };

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function loadAtt() { try { return JSON.parse(localStorage.getItem('mp-att2') || '{}') || {}; } catch (x) { return {}; } }
export function saveAtt(a) { try { localStorage.setItem('mp-att2', JSON.stringify(a)); } catch (x) {} }
export function loadLoc() { try { return localStorage.getItem('mp-loc') === 'home' ? 'home' : 'office'; } catch (x) { return 'office'; } }
export function saveLoc(l) { try { localStorage.setItem('mp-loc', l); } catch (x) {} }
