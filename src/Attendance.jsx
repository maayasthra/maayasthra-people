import { useState, useEffect, useRef } from 'react';
import { html, Icon } from './ui.jsx';
import { fmtTime } from './data.js';
import { checkInSound, awayStartSound, backSound, moveSound } from './alerts.js';
import { sessionsOf, isIn, workedNet, hms, hm, clock, lunchInfo, startDelta, checkIn, checkOut, useNow, getDay, dayKey, AWAY_WHY, whyLabel, awayOpen, goAway, comeBack, addAway } from './attendance.js';
import { AddAwayDialog } from './AwayDialog.jsx';

export function SessionList({ sessions, now }) {
  if (!sessions.length) return html`<div className="ck-empty">No check-ins yet today.</div>`;
  return html`<div className="ck-list">${sessions.map((s, i) => html`<div className="ck-s" key=${i}>
    <span className=${'ck-n' + (s.out ? '' : ' live')}>${i + 1}</span>
    <span className="ck-r"><b>${clock(s.in)} – ${s.out ? clock(s.out) : 'now'}</b><small>${s.out ? hm(s.out - s.in) : 'running ' + hm(now - s.in)}</small></span></div>`)}</div>`;
}

// The breaks taken today and the totals under them. Used in the Today pop-up and on the Home "Your day" panel.
export function AwaySummary({ sessions, away, worked, now }) {
  if (!away.length) return sessions.length ? html`<div className="ck-sum"><span>Worked today</span><b>${hm(worked)}</b></div>` : null;
  const total = away.reduce((t, a) => t + ((a.to == null ? now : a.to) - a.from), 0);
  return html`<div className="ck-awl"><b>Away</b>${away.map((a, i) => html`<div key=${i}><span>${clock(a.from)} – ${a.to == null ? 'now' : clock(a.to)}</span><small>${whyLabel(a.why)}${a.later ? ' · added later' : ''}</small></div>`)}</div>
    ${sessions.length > 0 && html`<div className="ck-sum"><span>Worked today</span><b>${hm(worked)}</b></div>`}
    <div className="ck-sum"><span>Away</span><b>${hm(total)}</b></div>`;
}

export function useDay(user, att) {
  const now = useNow(1000);
  const sessions = sessionsOf(att, user.n), live = isIn(sessions), away = getDay(att, user.n, dayKey()).away || [], open = live ? awayOpen(away) : null;
  return { now, sessions, live, away, open, worked: workedNet(sessions, away, now) };
}

/* Top-right check-in / check-out with a running timer. While checked in you can step away; that time is not counted. */
export function CheckWidget({ user, att, setAtt, onOut, onAway, onBack }) {
  const { now, sessions, live, away, open, worked } = useDay(user, att);
  const [pop, setPop] = useState(false), [aw, setAw] = useState(false), [add, setAdd] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!pop && !aw) return;
    const f = ev => { if (ref.current && !ref.current.contains(ev.target)) { setPop(false); setAw(false); } };
    const k = ev => { if (ev.key === 'Escape') { setPop(false); setAw(false); } };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [pop, aw]);
  const lunch = lunchInfo(now);
  const line2 = open ? 'Away · ' + whyLabel(open.why) + ' · ' + hm(now - open.from)
    : lunch.state === 'on' || lunch.state === 'soon' ? lunch.text
    : live ? 'Shift ends ' + fmtTime(user.shiftEnd)
    : sessions.length ? 'Checked out ' + clock(sessions[sessions.length - 1].out) : fmtTime(user.shiftStart) + ' – ' + fmtTime(user.shiftEnd);
  const main = live ? hms(worked) : sessions.length ? hm(worked) + ' worked' : 'Not checked in';
  const act = () => { if (open) { backSound(); setAtt(a => comeBack(a, user.n)); if (onBack) onBack(); } else if (live) onOut(); else { checkInSound(); setAtt(a => checkIn(a, user.n)); } };
  const step = why => { setAw(false); awayStartSound(why); setAtt(a => goAway(a, user.n, why)); if (onAway) onAway(); };
  const awayTotal = away.reduce((t, a) => t + ((a.to == null ? now : a.to) - a.from), 0);
  return html`<div className="ck" ref=${ref}>
    <button className="ck-t" onClick=${() => { setPop(p => !p); setAw(false); }} aria-expanded=${pop} aria-label="Today's check-ins">
      <span className=${'ck-dot' + (open ? ' away' : live ? ' on' : '')}></span>
      <span className="ck-tx"><b className=${live ? 'run' : ''}>${main}</b><span className=${open ? 'away' : lunch.state === 'on' ? 'lunch on' : lunch.state === 'soon' ? 'lunch' : ''}>${line2}</span></span></button>
    ${live && !open && html`<button className="ib ck-aw" onClick=${() => { setAw(a => !a); setPop(false); }} aria-label="Step away" aria-haspopup="menu" aria-expanded=${aw} title="Step away"><${Icon} n="cup" s=${18}/></button>`}
    <button className=${'btn sm ' + (live && !open ? 'ghost' : 'pri')} onClick=${act}>${open ? 'I’m back' : live ? 'Check out' : sessions.length ? 'Check in again' : 'Check in'}</button>
    ${aw && html`<div className="menu ck-pop ck-away" role="menu"><div className="menu-h"><b>Step away</b><span>Your timer pauses until you are back</span></div>
      ${AWAY_WHY.map(([k, l, ic]) => html`<button key=${k} role="menuitem" onClick=${() => step(k)}><${Icon} n=${ic} s=${18}/>${l}</button>`)}</div>`}
    ${pop && html`<div className="menu ck-pop"><div className="menu-h"><b>Today</b><span>Shift ${fmtTime(user.shiftStart)} – ${fmtTime(user.shiftEnd)} · Lunch 1:00 – 2:00 PM</span></div>
      <${SessionList} sessions=${sessions} now=${now}/>
      ${away.length > 0 && html`<div className="ck-awl"><b>Away</b>${away.map((a, i) => html`<div key=${i}><span>${clock(a.from)} – ${a.to == null ? 'now' : clock(a.to)}</span><small>${whyLabel(a.why)}${a.later ? ' · added later' : ''}</small></div>`)}</div>`}
      ${sessions.length > 0 && html`<div className="ck-sum"><span>Worked today</span><b>${hm(worked)}</b></div>`}
      ${away.length > 0 && html`<div className="ck-sum"><span>Away</span><b>${hm(awayTotal)}</b></div>`}
      <div className="ck-acts">${open && html`<button className="btn ghost sm" onClick=${() => { setPop(false); onOut(); }}>Check out</button>`}<button className="btn ghost sm" onClick=${() => { setPop(false); setAdd(true); }}><${Icon} n="plus" s=${14}/> Add time I was away</button></div></div>`}
    ${add && html`<${AddAwayDialog} user=${user} att=${att} onCancel=${() => setAdd(false)} onSave=${(day, a, b, why, note) => { moveSound(); setAtt(x => addAway(x, user.n, day, a, b, why, note)); setAdd(false); }}/>`}
  </div>`;
}

export function dayNote(sessions, user) {
  const d = startDelta(sessions, user.shiftStart);
  if (d === null) return 'Check in to start your day.';
  return d <= 0 ? 'First check-in was on time.' : 'First check-in was ' + d + ' min after shift start.';
}
