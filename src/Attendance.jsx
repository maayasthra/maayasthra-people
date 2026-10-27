import { useState, useEffect, useRef } from 'react';
import { html, Icon } from './ui.jsx';
import { fmtTime } from './data.js';
import { checkInSound } from './alerts.js';
import { sessionsOf, isIn, workedMs, hms, hm, clock, lunchInfo, startDelta, checkIn, checkOut, useNow } from './attendance.js';

export function SessionList({ sessions, now }) {
  if (!sessions.length) return html`<div className="ck-empty">No check-ins yet today.</div>`;
  return html`<div className="ck-list">${sessions.map((s, i) => html`<div className="ck-s" key=${i}>
    <span className=${'ck-n' + (s.out ? '' : ' live')}>${i + 1}</span>
    <span className="ck-r"><b>${clock(s.in)} – ${s.out ? clock(s.out) : 'now'}</b><small>${s.out ? hm(s.out - s.in) : 'running ' + hm(now - s.in)}</small></span></div>`)}</div>`;
}

export function useDay(user, att) {
  const now = useNow(1000);
  const sessions = sessionsOf(att, user.n), live = isIn(sessions);
  return { now, sessions, live, worked: workedMs(sessions, now) };
}

/* Top-right check-in / check-out with a running timer and an Office or Home choice */
export function CheckWidget({ user, att, setAtt, onOut }) {
  const { now, sessions, live, worked } = useDay(user, att);
  const [pop, setPop] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!pop) return;
    const f = ev => { if (ref.current && !ref.current.contains(ev.target)) setPop(false); };
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f);
  }, [pop]);
  const lunch = lunchInfo(now);
  const line2 = lunch.state === 'on' || lunch.state === 'soon' ? lunch.text
    : live ? 'Shift ends ' + fmtTime(user.shiftEnd)
    : sessions.length ? 'Checked out ' + clock(sessions[sessions.length - 1].out) : fmtTime(user.shiftStart) + ' – ' + fmtTime(user.shiftEnd);
  const main = live ? hms(worked) : sessions.length ? hm(worked) + ' worked' : 'Not checked in';
  const act = () => { if (live) onOut(); else { checkInSound(); setAtt(a => checkIn(a, user.n)); } };
  return html`<div className="ck" ref=${ref}>
    <button className="ck-t" onClick=${() => setPop(p => !p)} aria-expanded=${pop} aria-label="Today's check-ins">
      <span className=${'ck-dot' + (live ? ' on' : '')}></span>
      <span className="ck-tx"><b className=${live ? 'run' : ''}>${main}</b><span className=${lunch.state === 'on' ? 'lunch on' : lunch.state === 'soon' ? 'lunch' : ''}>${line2}</span></span></button>
    <button className=${'btn sm ' + (live ? 'ghost' : 'pri')} onClick=${act}>${live ? 'Check out' : sessions.length ? 'Check in again' : 'Check in'}</button>
    ${pop && html`<div className="menu ck-pop"><div className="menu-h"><b>Today</b><span>Shift ${fmtTime(user.shiftStart)} – ${fmtTime(user.shiftEnd)} · Lunch 1:00 – 2:00 PM</span></div>
      <${SessionList} sessions=${sessions} now=${now}/>
      ${sessions.length > 0 && html`<div className="ck-sum"><span>Worked today</span><b>${hm(worked)}</b></div>`}</div>`}
  </div>`;
}

export function dayNote(sessions, user) {
  const d = startDelta(sessions, user.shiftStart);
  if (d === null) return 'Check in to start your day.';
  return d <= 0 ? 'First check-in was on time.' : 'First check-in was ' + d + ' min after shift start.';
}
