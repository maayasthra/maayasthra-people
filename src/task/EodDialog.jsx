import { useState, useEffect, useRef } from 'react';
import { html, Icon } from '../ui.jsx';
import { hoursOf, totalOf, fmtH, loadEods } from '../eodDb.js';
import { dayKey, hm } from '../attendance.js';
import { isDoing } from '../tasks.js';

let uid = 0;
const blankSub = (title = '') => ({ id: 's' + ++uid, title, desc: '', hours: '' });
const blankRow = (o = {}) => ({ id: 'r' + ++uid, project: '', task: null, desc: '', hours: '', subs: [], ...o });
// Hours are typed: digits and one dot, like 2 or 1.5
const cleanHours = v => { const x = v.replace(/[^0-9.]/g, ''), i = x.indexOf('.'); return (i < 0 ? x : x.slice(0, i + 1) + x.slice(i + 1).replace(/\./g, '')).slice(0, 5); };
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
  const D = day || dayKey(), late = mode === 'late';
  const mine = tasks.filter(t => (t.cols || []).includes(user.n) && !t.done);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [restored, setRestored] = useState(null), [savedAt, setSavedAt] = useState(0);
  const first = useRef(null);

  // Start from today's report if one was already sent, otherwise from the tasks that are in progress
  useEffect(() => {
    let live = true; const d = D;
    const dr = readDraft(user.n, D);
    if (dr) { setRows(dr.rows.map(x => ({ ...blankRow(), ...x, id: 'r' + ++uid, subs: (x.subs || []).map(q => ({ ...q, id: 's' + ++uid })) }))); setRestored(dr.at); return () => { live = false; }; }
    loadEods(d, d).then(l => {
      if (!live) return;
      const r = l.find(x => x.emp === user.n);
      const start = r && r.rows.length ? r.rows.map(x => ({ ...blankRow(), ...x, id: 'r' + ++uid, hours: x.hours || '', subs: (x.subs || []).map(s => ({ ...s, id: 's' + ++uid, hours: s.hours || '' })) }))
        : late ? [] : mine.filter(t => isDoing(t, user.n)).map(t => blankRow({ project: t.title, task: t.id }));
      setRows(start.length ? start : [blankRow()]);
    }).catch(() => live && setRows([blankRow()]));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!rows) return;
    const t = setTimeout(() => { writeDraft(user.n, rows, D); if (hasText(rows)) setSavedAt(Date.now()); }, 300);
    return () => clearTimeout(t);
  }, [rows]);
  useEffect(() => { const k = ev => { if (ev.key === 'Escape' && !busy) onCancel(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [busy]);
  useEffect(() => { if (rows && first.current) first.current.focus(); }, [rows === null]);

  if (!rows) return html`<div className="dlg-bg"></div><div className="dlg eod" role="dialog" aria-busy="true"><p>Loading…</p></div>`;

  const patch = (id, p) => { setRows(rs => rs.map(r => r.id === id ? { ...r, ...p } : r)); setErr(''); };
  const patchSub = (id, sid, p) => { setRows(rs => rs.map(r => r.id === id ? { ...r, subs: r.subs.map(s => s.id === sid ? { ...s, ...p } : s) } : r)); setErr(''); };
  const setProject = (r, v) => { const t = byTitle(mine, v); patch(r.id, { project: v, task: t ? t.id : null }); };
  const cardOf = r => r.task ? tasks.find(t => t.id === r.task) : byTitle(mine, r.project);
  const addSubsFrom = r => { const c = cardOf(r); if (c) patch(r.id, { subs: [...r.subs, ...c.subs.filter(s => !r.subs.some(x => x.title === s.title)).map(s => blankSub(s.title))] }); };
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
        <div><h2 id="eod-t">${late ? 'Missed report' : mode === 'out' ? 'End-of-day report' : 'Today’s report'}</h2>
          <p>${late ? 'Fill in what you worked on ' + new Date(D + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) + ', with the time.' : mode === 'out' ? 'Fill in what you worked on today' + (noHours ? '' : ', with the time') + '. You can check out once it is sent.' : 'Save it now, then check out when you are done. A later save replaces this one.'}</p></div></div>
      ${restored && html`<div className="eod-note" role="status"><span>We brought back your draft from ${hm2(restored)}.</span><button className="link" onClick=${() => { clearEodDraft(user.n, D); setRestored(null); setRows([blankRow()]); }}>Start over</button></div>`}
      <div className="eod-t" role="table" aria-label="Today's work">
        <div className="eod-hd" role="row"><span>Project</span><span>Description</span>${!noHours && html`<span>Time</span>`}<span></span></div>
        ${rows.map((r, i) => {
          const c = cardOf(r), canPull = c && c.subs.length > 0 && c.subs.some(s => !r.subs.some(x => x.title === s.title));
          return html`<div className="eod-g" key=${r.id}>
            <div className="eod-r" role="row">
              <input ref=${i === 0 ? first : null} className="inp" autoComplete="off" value=${r.project} placeholder="Project name" aria-label=${'Project, line ' + (i + 1)} maxLength="200" onChange=${ev => setProject(r, ev.target.value)}/>
              <textarea className="inp" rows="1" autoComplete="off" value=${r.desc} placeholder=${r.subs.length ? 'Optional note' : 'What did you do?'} aria-label=${'Description, line ' + (i + 1)} maxLength="1000" onChange=${ev => patch(r.id, { desc: ev.target.value })}></textarea>
              ${noHours ? null : r.subs.length ? html`<span className="eod-sum" title="Total of the subtasks">${hoursOf(r) ? fmtH(hoursOf(r)) : '0h'}</span>`
                : html`<${HM} label=${'Time, line ' + (i + 1)} value=${r.hours} onChange=${v => patch(r.id, { hours: v })} onKeyDown=${ev => { if (ev.key === 'Enter' && i === rows.length - 1) { ev.preventDefault(); setRows(rs => [...rs, blankRow()]); } }}/>`}
              <button className="ib" onClick=${() => removeRow(r.id)} aria-label=${'Remove line ' + (i + 1)} title="Remove this line"><${Icon} n="x" s=${14}/></button>
            </div>
            ${r.subs.map(s => html`<div className="eod-r eod-sub" key=${s.id} role="row">
              <input className="inp" value=${s.title} placeholder="Subtask" aria-label="Subtask" maxLength="200" onChange=${ev => patchSub(r.id, s.id, { title: ev.target.value })}/>
              <textarea className="inp" rows="1" value=${s.desc} placeholder="What did you do?" aria-label="Subtask description" maxLength="1000" onChange=${ev => patchSub(r.id, s.id, { desc: ev.target.value })}></textarea>
              ${!noHours && html`<${HM} label="Subtask time" value=${s.hours} onChange=${v => patchSub(r.id, s.id, { hours: v })}/>`}
              <button className="ib" onClick=${() => patch(r.id, { subs: r.subs.filter(x => x.id !== s.id) })} aria-label="Remove subtask" title="Remove this subtask"><${Icon} n="x" s=${14}/></button>
            </div>`)}
            <div className="eod-add"><button className="eod-l" onClick=${() => patch(r.id, { subs: [...r.subs, blankSub()] })}>+ Subtask</button>${canPull && html`<button className="eod-l" onClick=${() => addSubsFrom(r)}>Add this card’s subtasks</button>`}</div>
          </div>`;
        })}
      </div>
      <button className="btn ghost sm eod-new" onClick=${() => setRows(rs => [...rs, blankRow()])}><${Icon} n="plus" s=${14}/> Add a project</button>
      ${!noHours && html`<div className="eod-f"><span>Total <b>${fmtH(total)}</b></span>${worked > 0 && html`<span className=${over ? 'eod-warn' : ''}>Checked in today: ${hm(worked)}${over ? ' · more than you were here' : ''}</span>`}</div>`}
      ${err && html`<div className="eod-e" role="alert">${err}</div>`}
      <div className="dlg-a"><span className="eod-ds">${savedAt ? 'Draft saved' : ''}</span><button className="btn ghost" disabled=${busy} onClick=${onCancel}>${mode === 'out' ? 'Keep working' : late ? 'Close' : 'Cancel'}</button>
        <button className="btn pri" disabled=${busy} onClick=${send}>${busy ? 'Sending…' : mode === 'out' ? 'Send and check out' : late ? 'Send report' : 'Save report'}</button></div>
    </div>`;
}
