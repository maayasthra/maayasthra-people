import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { html, Icon } from './ui.jsx';
import { AWAY_WHY, EARLY_WHY, dayKey, addDays, toTs, getDay, overlapsAway, hm } from './attendance.js';

// One row of single-choice reason chips
function Why({ list, value, onChange, label }) {
  return html`<div className="aw-ch" role="radiogroup" aria-label=${label}>${list.map(([k, l, ic]) => html`<button type="button" key=${k} role="radio" aria-checked=${value === k} className=${value === k ? 'on' : ''} onClick=${() => onChange(k)}><${Icon} n=${ic} s=${16}/>${l}</button>`)}</div>`;
}
const useEsc = fn => useEffect(() => { const k = ev => { if (ev.key === 'Escape') fn(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);

/* Add time that was already away, for today or yesterday (the power was out, so nothing could be pressed). */
export function AddAwayDialog({ user, att, onSave, onCancel }) {
  const today = dayKey(), yday = addDays(today, -1);
  const [day, setDay] = useState(today), [from, setFrom] = useState(''), [to, setTo] = useState(''), [why, setWhy] = useState('power'), [note, setNote] = useState(''), [err, setErr] = useState('');
  const first = useRef(null);
  useEsc(onCancel); useEffect(() => { first.current && first.current.focus(); }, []);
  const submit = ev => {
    ev.preventDefault();
    if (!from || !to) { setErr('Enter when you were away from and until.'); return; }
    const a = toTs(day, from), b = toTs(day, to), rec = getDay(att, user.n, day), now = Date.now();
    if (!rec.sessions.length) { setErr('You have no check-in on that day.'); return; }
    if (b <= a) { setErr('“Until” must be after “from”.'); return; }
    if (b > now) { setErr('That time has not happened yet.'); return; }
    if (b - a > 12 * 3600000) { setErr('Away time can be 12 hours at most.'); return; }
    if (overlapsAway(rec.away, a, b, now)) { setErr('That overlaps time you already marked away.'); return; }
    onSave(day, a, b, why, note.trim());
  };
  return createPortal(html`<div className="dlg-bg" onClick=${onCancel}></div>
    <div className="dlg aw" role="dialog" aria-modal="true" aria-labelledby="aw-t">
      <div className="dlg-i"><${Icon} n="cup" s=${22}/></div><h2 id="aw-t">Add time you were away</h2>
      <p>Use this when you could not press Away, for example during a power cut. This time is not counted as worked, and admins can see it was added afterwards.</p>
      <form onSubmit=${submit} noValidate>
        <div className="fld"><label>Day</label><div className="seg" role="group" aria-label="Day">${[[today, 'Today'], [yday, 'Yesterday']].map(([d, l]) => html`<button type="button" key=${d} className=${day === d ? 'on' : ''} onClick=${() => { setDay(d); setErr(''); }}>${l}</button>`)}</div></div>
        <div className="aw-t"><div className="fld"><label htmlFor="aw-from">From</label><input id="aw-from" ref=${first} className="inp" type="time" value=${from} onChange=${ev => { setFrom(ev.target.value); setErr(''); }}/></div>
          <div className="fld"><label htmlFor="aw-to">Until</label><input id="aw-to" className="inp" type="time" value=${to} onChange=${ev => { setTo(ev.target.value); setErr(''); }}/></div></div>
        <div className="fld"><label>Reason</label><${Why} list=${AWAY_WHY} value=${why} onChange=${setWhy} label="Reason"/></div>
        <div className="fld"><label htmlFor="aw-note">Note <span className="aw-opt">optional</span></label><input id="aw-note" className="inp" maxLength="200" value=${note} placeholder="For example: power back at 11:40" onChange=${ev => setNote(ev.target.value)}/></div>
        ${err && html`<div className="eod-e" role="alert">${err}</div>`}
        <div className="dlg-a"><button type="button" className="btn ghost" onClick=${onCancel}>Cancel</button><button type="submit" className="btn pri">Add away time</button></div>
      </form></div>`, document.body);
}

/* Asked once when someone checks out well before their shift ends. Skipping is fine. */
export function EarlyDialog({ onDone, onCancel, left }) {
  const [why, setWhy] = useState(''), [note, setNote] = useState('');
  useEsc(onCancel);
  return html`<div className="dlg-bg" onClick=${onCancel}></div>
    <div className="dlg aw" role="dialog" aria-modal="true" aria-labelledby="ea-t">
      <div className="dlg-i"><${Icon} n="logout" s=${22}/></div><h2 id="ea-t">Leaving early?</h2>
      <p>Your shift has ${hm(left)} left. Add a reason so your hours are easy to understand. You can skip this.</p>
      <div className="fld"><label>Reason</label><${Why} list=${EARLY_WHY} value=${why} onChange=${setWhy} label="Reason for leaving early"/></div>
      <div className="fld"><label htmlFor="ea-note">Note <span className="aw-opt">optional</span></label><input id="ea-note" className="inp" maxLength="200" value=${note} onChange=${ev => setNote(ev.target.value)}/></div>
      <div className="dlg-a"><button type="button" className="btn ghost" onClick=${() => onDone(null)}>Skip</button><button type="button" className="btn pri" disabled=${!why} onClick=${() => onDone({ why, note: note.trim() })}>Continue</button></div>
    </div>`;
}
