import { useEffect, useRef, useState } from 'react';
import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';
import { HOL, pd } from './data.js';
import { dayKey, addDays, minuteOfDay } from './attendance.js';

/* Announcement alerts. A new announcement pops up for everyone who is on shift, with a chime, until they close it.
   If the page is in the background, a system notification is shown as well and the chime repeats now and then.
   This needs the browser to be open: a page that has been closed cannot play a sound. */
const WINDOW_DAYS = 3, REPEAT_MS = 30000, MAX_REPEATS = 8;
const hmMins = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + m; };

// On shift: a working day (not a weekend or holiday), between the person's start and end time, India time
export function onShift(user, now = Date.now()) {
  const iso = dayKey(now), w = new Date(pd(iso)).getUTCDay();
  if (w === 0 || w === 6 || HOL[iso]) return false;
  const m = minuteOfDay(now);
  return m >= hmMins(user.shiftStart) && m < hmMins(user.shiftEnd);
}

/* ---------- sound ---------- */
let ctx = null;
const audio = () => { try { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); } return ctx; } catch (x) { return null; } };
// Browsers only allow sound after the person has used the page. This unlocks it on their first click or key press.
export function unlockAudio() {
  const go = () => { const c = audio(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, go, { passive: true }));
  return () => ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, go));
}
export function chime() {
  const c = audio(); if (!c) return;
  const play = () => {
    const t0 = c.currentTime + 0.02;
    [[880, 0], [1318.5, 0.22], [1760, 0.44]].forEach(([f, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.7);
      o.connect(g); g.connect(c.destination); o.start(t0 + d); o.stop(t0 + d + 0.75);
    });
  };
  if (c.state === 'suspended') c.resume().then(play).catch(() => {}); else play();
}

/* ---------- system notifications (shown outside the browser window) ---------- */
export const notifyState = () => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
export function askNotify() { return typeof Notification === 'undefined' ? Promise.resolve('unsupported') : Notification.requestPermission().catch(() => 'denied'); }
function systemNotify(a) {
  if (notifyState() !== 'granted') return;
  try {
    const n = new Notification(a.title, { body: (a.body || 'New announcement').slice(0, 180), tag: 'ann-' + a.id, requireInteraction: true, icon: '/apple-touch-icon.png' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (x) { /* some browsers only allow notifications from a service worker */ }
}

/* ---------- which announcements are unread ---------- */
const DKEY = 'mp-ann-read';
const demoReads = () => { try { return JSON.parse(localStorage.getItem(DKEY) || '{}'); } catch (x) { return {}; } };
async function loadReads(me) {
  if (IS_DEMO) return new Set(demoReads()[me] || []);
  const { data, error } = await supabase.from('announcement_reads').select('announcement_id');
  if (error) throw new Error('reads');
  return new Set(data.map(r => String(r.announcement_id)));
}
async function markRead(me, id) {
  if (IS_DEMO) { const d = demoReads(); d[me] = [...new Set([...(d[me] || []), String(id)])]; try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch (x) {} return; }
  await supabase.rpc('mark_announcement_read', { p_id: id });
}

export function useAnnouncementAlerts(auth, ann) {
  const me = auth ? auth.user.n : 0;
  const [reads, setReads] = useState(null), [tick, setTick] = useState(0), [perm, setPerm] = useState(notifyState());
  const chimed = useRef(new Set()), repeats = useRef({});

  useEffect(() => unlockAudio(), []);
  useEffect(() => { if (!me) { setReads(null); return; } let live = true; loadReads(me).then(r => { if (live) setReads(r); }).catch(() => { if (live) setReads(new Set()); }); return () => { live = false; }; }, [me]);
  // Re-check every half minute: someone who was off shift when it was posted sees it when their shift starts
  useEffect(() => { if (!me) return; const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, [me]);

  const since = addDays(dayKey(), -WINDOW_DAYS);
  const unread = !auth || !reads ? [] : ann.filter(a => a.date >= since && !reads.has(String(a.id)) && (a.byId ? a.byId !== me : a.by !== auth.user.name));
  const live = auth && unread.length > 0 && onShift(auth.user);
  const current = live ? unread[unread.length - 1] : null;  // the oldest unread first; ann is newest first

  // Chime (and a system notification when the page is not in front) once for each new alert, then now and then while it is unread and the page is in the background
  useEffect(() => {
    if (!live) return;
    unread.forEach(a => { if (!chimed.current.has(a.id)) { chimed.current.add(a.id); chime(); if (document.hidden) systemNotify(a); } });
    const t = setInterval(() => {
      if (!document.hidden) return;
      const a = unread[unread.length - 1]; if (!a) return;
      repeats.current[a.id] = (repeats.current[a.id] || 0) + 1;
      if (repeats.current[a.id] <= MAX_REPEATS) { chime(); if (repeats.current[a.id] % 3 === 0) systemNotify(a); }
    }, REPEAT_MS);
    return () => clearInterval(t);
  }, [live, unread.map(a => a.id).join(',')]);
  // Flash the tab title while there is something to read and the page is in the background
  useEffect(() => {
    if (!live) return;
    const base = document.title; let on = false;
    const t = setInterval(() => { on = !on; document.title = document.hidden && on ? '🔔 New announcement' : base; }, 1000);
    return () => { clearInterval(t); document.title = base; };
  }, [live]);

  const dismiss = id => { setReads(r => new Set([...(r || []), String(id)])); markRead(me, id).catch(() => {}); };
  return { current, count: unread.length, dismiss, perm, askPerm: () => askNotify().then(setPerm), tick };
}
