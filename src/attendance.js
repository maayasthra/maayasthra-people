import { useState, useEffect } from 'react';

const LUNCH_START = 13 * 60, LUNCH_END = 14 * 60;
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const minsOf = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
const hmMins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

// att = { [employeeNumber]: { day, sessions: [{ in, out }] } }. Several check-ins and check-outs a day are allowed.
export const sessionsOf = (att, n) => (att[n] && att[n].day === dayKey() ? att[n].sessions : []);
export const isIn = sessions => sessions.length > 0 && !sessions[sessions.length - 1].out;
export const workedMs = (sessions, now) => sessions.reduce((t, s) => t + ((s.out || now) - s.in), 0);

export function checkIn(att, n) { const cur = sessionsOf(att, n); return { ...att, [n]: { day: dayKey(), sessions: [...cur, { in: Date.now(), out: null }] } }; }
export function checkOut(att, n) { const cur = sessionsOf(att, n); if (!isIn(cur)) return att; const s = cur.map((x, i) => i === cur.length - 1 ? { ...x, out: Date.now() } : x); return { ...att, [n]: { day: dayKey(), sessions: s } }; }

export const hms = ms => { const t = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(v => String(v).padStart(2, '0')).join(':'); };
export const hm = ms => { const m = Math.floor(Math.max(0, ms) / 60000); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
export const clock = t => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

// Lunch is 1 to 2 pm. Inside the last hour before it, count down in minutes.
export function lunchInfo(now) {
  const m = minsOf(now);
  if (m >= LUNCH_START && m < LUNCH_END) return { state: 'on', text: 'Lunch break is on · ends in ' + Math.ceil(LUNCH_END - m) + ' min' };
  if (m < LUNCH_START && LUNCH_START - m <= 60) return { state: 'soon', text: 'Lunch break in ' + Math.ceil(LUNCH_START - m) + ' min' };
  if (m < LUNCH_START) return { state: 'later', text: 'Lunch 1:00 – 2:00 PM' };
  return { state: 'over', text: '' };
}

// Minutes after (positive) or before (negative) the shift start for the first check-in of the day
export const startDelta = (sessions, shiftStart) => sessions.length ? Math.round(minsOf(sessions[0].in) - hmMins(shiftStart)) : null;
export const shiftEndsIn = (now, shiftEnd) => hmMins(shiftEnd) - minsOf(now);

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function loadAtt() { try { return JSON.parse(localStorage.getItem('mp-att') || '{}') || {}; } catch (x) { return {}; } }
export function saveAtt(a) { try { localStorage.setItem('mp-att', JSON.stringify(a)); } catch (x) {} }
