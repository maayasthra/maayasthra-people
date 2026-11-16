import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { html, Icon } from '../ui.jsx';
import { hoursOf, totalOf, fmtH, loadEods } from '../eodDb.js';
import { dayKey, hm, dayStart } from '../attendance.js';
import { isDoing, myTasksOf } from '../tasks.js';
import { trackedIn, hoursText, autoNote, subLines } from '../taskTime.js';

let uid = 0;
const blankSub = (title = '') => ({ id: 's' + ++uid, title, desc: '', hours: '' });
const blankRow = (o = {}) => ({ id: 'r' + ++uid, project: '', task: null, desc: '', hours: '', subs: [], ...o });
// Time is typed as hours and minutes; it is kept as decimal hours (1h 30m = 1.5)
function HM({ value, onChange, label, onKeyDown }) {
  const tot = Math.round((Number(value) || 0) * 60), h = Math.floor(tot / 60), m = tot % 60;
  const set = (nh, nm) => { const t = nh * 60 + nm; onChange(t > 0 ? String(+(t / 60).toFixed(4)) : ''); };
  const num = v => parseInt(v.replace(/\D/g, '').slice(0, 2) || '0', 10);
  return html`<span className="eod-hm"><input className="inp" inputMode="numeric" autoComplete="off" value=${h || ''} placeholder="0" aria-label=${label + ', hours'} onChange=${ev => set(Math.min(24, num(ev.target.value)), m)}/><i>h</i><input className="inp" inputMode="numeric" autoComplete="off" value=${m || ''} placeholder="0" aria-label=${label + ', minutes'} onChange=${ev => set(h, Math.min(59, num(ev.target.value)))} onKeyDown=${onKeyDown}/><i>m</i></span>`;
}
const byTitle = (tasks, name) => tasks.find(t => t.title.trim().toLowerCase() === String(name).trim().toLowerCase());

/* A draft is kept in this browser as you type, so clicking away or closing the box never loses what was written.
   It is removed once the report is sent. */
const hm2 = t => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const draftKey = (n, d = dayKey()) => 'mp-eoddraft-' + n + '-' + d;
const readDraft = (n, d) => { try { const v = JSON.parse(localStorage.getItem(draftKey(n, d)) || 'null'); return v && Array.isArray(v.rows) && v.rows.length ? v : null; } catch (x) { return null; } };
const hasText = rows => rows.some(r => r.project.trim() || r.desc.trim() || Number(r.hours) > 0 || (r.subs || []).some(x => x.title.trim() || x.desc.trim() || Number(x.hours) > 0));
const writeDraft = (n, rows, d) => { try { if (hasText(rows)) localStorage.setItem(draftKey(n, d), JSON.stringify({ rows, at: Date.now() })); else localStorage.removeItem(draftKey(n, d)); } catch (x) { /* ignore */ } };
export const clearEodDraft = (n, d) => { try { localStorage.removeItem(draftKey(n, d)); } catch (x) { /* ignore */ } };

/* The end-of-day report. Opens when someone checks out, and nobody can check out without sending it.
   mode 'out' sends the report and then checks out; mode 'save' only updates today's report. */
export function EodDialog({ user, tasks, worked, mode, noHours, onSend, onCancel, day }) {
  const D = day || dayKey(), late = mode === 'late', edit = mode === 'edit';
  const mine = tasks.filter(t => (t.cols || []).includes(user.n) && !t.done);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [restored, setRestored] = useState(null), [savedAt, setSavedAt] = useState(0), [filled, setFilled] = useState(false), [shared, setShared] = useState(false);
  const first = useRef(null);

  // Every task worked on that day, with the time from your Start, Pause and Done presses; then anything in progress that has no time yet
  const fromClock = () => {
    const from = dayStart(D), tracked = trackedIn(myTasksOf(tasks, user.n), user.n, from, from + 86400000); setShared(!!tracked.shared);
    const rows = tracked.map(x => {
      const card = tasks.find(t => t.id === x.id), subs = card && !noHours ? subLines(card, x.ms) : [];
      return blankRow({ project: x.title, task: x.id, desc: card && !subs.length ? autoNote(card) : '', hours: noHours || subs.length ? '' : hoursText(x.ms), subs: subs.map(q => blankSub(q.title)).map((b, i) => ({ ...b, hours: subs[i].hours })) });
    });
    return late ? rows : [...rows, ...mine.filter(t => isDoing(t, user.n) && !tracked.some(x => x.id === t.id)).map(t => blankRow({ project: t.title, task: t.id, desc: autoNote(t) }))];
  };

  // Start from today's report if one was already sent, otherwise from the tasks that are in progress
  useEffect(() => {
    let live = true; const d = D;
    const dr = readDraft(user.n, D);
    if (dr) { setRows(dr.rows.map(x => ({ ...blankRow(), ...x, id: 'r' + ++uid, subs: (x.subs || []).map(q => ({ ...q, id: 's' + ++uid })) }))); setRestored(dr.at); return () => { live = false; }; }
    loadEods(d, d).then(l => {
      if (!live) return;
      const r = l.find(x => x.emp === user.n);
      const start = r && r.rows.length ? r.rows.map(x => ({ ...blankRow(), ...x, id: 'r' + ++uid, hours: x.hours || '', subs: (x.subs || []).map(s => ({ ...s, id: 's' + ++uid, hours: s.hours || '' })) }))
        : fromClock();
      if (!(r && r.rows.length) && start.some(x => Number(x.hours) > 0 || (x.subs || []).length)) setFilled(true);
      setRows(start.length ? start : [blankRow()]);
    }).catch(() => live && setRows([blankRow()]));
    return () => { live = false; };
  }, []);
  useLayoutEffect(() => {
    if (!rows) return;
    writeDraft(user.n, rows, D);
    if (hasText(rows)) setSavedAt(Date.now());
  }, [rows]);
  useEffect(() => { const k = ev => { if (ev.key === 'Escape' && !busy) onCancel(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [busy]);
  useEffect(() => { if (rows && first.current) first.current.focus(); }, [rows === null]);

  if (!rows) return html`<div className="dlg-bg"></div><div className="dlg eod" role="dialog" aria-busy="true"><p>Loading…</p></div>`;

  const patch = (id, p) => { setRows(rs => rs.map(r => r.id === id ? { ...r, ...p } : r)); setErr(''); };
  const patchSub = (id, sid, p) => { setRows(rs => rs.map(r => r.id === id ? { ...r, subs: r.subs.map(s => s.id === sid ? { ...s, ...p } : s) } : r)); setErr(''); };
  const setProject = (r, v) => { const t = byTitle(mine, v); patch(r.id, { project: v, task: t ? t.id : null }); };
  const cardOf = r => r.task ? tasks.find(t => t.id === r.task) : byTitle(mine, r.project);
  const addSubsFrom = r => { const c = cardOf(r); if (c) patch(r.id, { subs: [...r.subs, ...c.subs.filter(s => !r.subs.some(x => x.title === s.t)).map(s => blankSub(s.t))] }); };
  const removeRow = id => setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : [blankRow()]);

  const total = totalOf(rows);
  const check = () => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], n = 'Line ' + (i + 1) + ': ';
      if (!r.project.trim()) return n + 'add the project name.';
      const c = cardOf(r);
      if (c && c.subs.length && !r.subs.length) return n + '“' + r.project.trim() + '” has subtasks. Add the ones you worked on.';
      if (r.subs.length) {
        for (const s of r.subs) { if (!s.title.trim()) return n + 'name each subtask.'; if (!noHours && !(Number(s.hours) > 0)) return n + 'enter the time for “' + s.title.trim() + '”.'; }
      } else {
        if (!r.desc.trim()) return n + 'describe what you did.';
        if (!noHours && (!(Number(r.hours) > 0) || Number(r.hours) > 24)) return n + 'enter the time (up to 24 hours).';
      }
    }
    if (!noHours && total > 24) return 'That adds up to more than 24 hours.';
    return '';
  };
  const send = async () => {
    const e = check(); if (e) { setErr(e); return; }
    setBusy(true);
    try { await onSend(rows); clearEodDraft(user.n, D); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const over = !noHours && worked > 0 && total * 3600000 > worked + 30 * 60000;

  return html`<div className="dlg-bg"></div>
    <div className=${'dlg eod' + (noHours ? ' nh' : '')} role="dialog" aria-modal="true" aria-labelledby="eod-t">
      <div className="eod-h"><div className="dlg-i"><${Icon} n="timer" s=${22}/></div>
        <div><h2 id="eod-t">${edit ? 'Edit report' : late ? 'Missed report' : mode === 'out' ? 'End-of-day report' : 'Today’s report'}</h2>
          <p>${edit ? 'Change what you sent for ' + new Date(D + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) + '.' : late ? 'Fill in what you worked on ' + new Date(D + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) + ', with the time.' : mode === 'out' ? 'Fill in what you worked on today' + (noHours ? '' : ', with the time') + '. You can check out once it is sent.' : 'Save it now, then check out when you are done. A later save replaces this one.'}</p></div></div>
      ${restored && html`<div className="eod-note" role="status"><span>We brought back your draft from ${hm2(restored)}.</span><button className="link" onClick=${() => { clearEodDraft(user.n, D); setRestored(null); const f = fromClock(); setFilled(f.some(x => Number(x.hours) > 0 || (x.subs || []).length)); setRows(f.length ? f : [blankRow()]); }}>Start over</button></div>`}
      ${filled && !restored && html`<div className="eod-note" role="status"><span>Project, description and time are filled in from your tasks and your Start and Pause presses. Change anything that is not right.${shared ? ' Time when you had several tasks running together is shared between them.' : ''}</span></div>`}
      <div className="ed-list">
        ${rows.map((r, i) => {
          const c = cardOf(r), hasSubs = r.subs.length > 0, canPull = c && c.subs.length > 0 && c.subs.some(s => !r.subs.some(x => x.title === s.t));
          return html`<section className="ed-card" key=${r.id} aria-label=${'Task ' + (i + 1)}>
            <div className=${'ed-top' + (noHours ? ' nh' : '')}>
              <span className="ed-num" aria-hidden="true">${i + 1}</span>
              <label className="ed-f ed-name"><span className="ed-lb">Task or project</span>
                <input ref=${i === 0 ? first : null} className="inp" autoComplete="off" value=${r.project} placeholder="Name of the task" aria-label=${'Task or project, number ' + (i + 1)} maxLength="200" onChange=${ev => setProject(r, ev.target.value)}/></label>
              ${!noHours && html`<div className="ed-f ed-time"><span className="ed-lb">${hasSubs ? 'Total time' : 'Time'}</span>
                ${hasSubs ? html`<b className="ed-sum" title="Total of the subtasks">${hoursOf(r) ? fmtH(hoursOf(r)) : '0h'}</b>`
                  : html`<${HM} label=${'Time, task ' + (i + 1)} value=${r.hours} onChange=${v => patch(r.id, { hours: v })} onKeyDown=${ev => { if (ev.key === 'Enter' && i === rows.length - 1) { ev.preventDefault(); setRows(rs => [...rs, blankRow()]); } }}/>`}</div>`}
              <button className="ib ed-x" onClick=${() => removeRow(r.id)} aria-label=${'Remove task ' + (i + 1)} title="Remove this task"><${Icon} n="x" s=${14}/></button>
            </div>
            ${!hasSubs && html`<label className="ed-f"><span className="ed-lb">What did you do?</span>
              <textarea className="inp" rows="1" autoComplete="off" value=${r.desc} placeholder="Describe the work" aria-label=${'Description, task ' + (i + 1)} maxLength="1000" onChange=${ev => patch(r.id, { desc: ev.target.value })}></textarea></label>`}
            ${hasSubs && html`<div className=${'ed-subs' + (noHours ? ' nh' : '')} role="group" aria-label=${'Subtasks of task ' + (i + 1)}>
              <div className="ed-subs-h">Subtasks</div>
              ${r.subs.map(sb => html`<div className="ed-sub" key=${sb.id}>
                <input className="inp ed-st" value=${sb.title} placeholder="Name of the subtask" aria-label="Subtask" maxLength="200" onChange=${ev => patchSub(r.id, sb.id, { title: ev.target.value })}/>
                ${!noHours && html`<${HM} label="Subtask time" value=${sb.hours} onChange=${v => patchSub(r.id, sb.id, { hours: v })}/>`}
                <button className="ib ed-x" onClick=${() => patch(r.id, { subs: r.subs.filter(x => x.id !== sb.id) })} aria-label="Remove subtask" title="Remove this subtask"><${Icon} n="x" s=${14}/></button>
              </div>`)}
            </div>`}
            <div className="ed-acts"><button className="eod-l" onClick=${() => patch(r.id, { subs: [...r.subs, blankSub()] })}>+ Add subtask</button>${canPull && html`<button className="eod-l" onClick=${() => addSubsFrom(r)}>Add this task’s subtasks</button>`}</div>
          </section>`;
        })}
      </div>
      <button className="ed-new" onClick=${() => setRows(rs => [...rs, blankRow()])}><${Icon} n="plus" s=${18}/> Add a task</button>
      ${!noHours && html`<div className="eod-f"><span>Total <b>${fmtH(total)}</b></span>${worked > 0 && html`<span className=${over ? 'eod-warn' : ''}>Checked in today: ${hm(worked)}${over ? ' · more than you were here' : ''}</span>`}</div>`}
      ${err && html`<div className="eod-e" role="alert">${err}</div>`}
      <div className="dlg-a"><span className="eod-ds">${savedAt ? 'Draft saved' : ''}</span><button className="btn ghost" disabled=${busy} onClick=${onCancel}>${mode === 'out' ? 'Keep working' : late ? 'Close' : 'Cancel'}</button>
        <button className="btn pri" disabled=${busy} onClick=${send}>${mode === 'out' && !busy && html`<${Icon} n="logout" s=${18}/>`}${busy ? (edit ? 'Saving…' : 'Sending…') : mode === 'out' ? 'Send and check out' : edit ? 'Save changes' : late ? 'Send report' : 'Save report'}</button></div>
    </div>`;
}
