import { useState } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { TODISO, fmtDM } from '../data.js';
import { dayKey } from '../attendance.js';
import { requestableMonths, monthLabel, monthLong, STATUS, isOpen, fmtSize } from '../payslipMonths.js';
import { requestPayslip, cancelPayslip, downloadPayslip } from '../payslipsDb.js';

const when = ts => ts ? fmtDM(dayKey(ts)) : '';

// One of my requests. Defined outside the page so its buttons keep their own busy state while the page updates.
function Mine({ r, again }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const st = STATUS[r.status], run = async fn => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };
  return html`<article className=${'pay-c ' + st.tone}>
    <div className="pay-h"><b>${monthLong(r.month)}</b><span className=${'pay-s ' + st.tone}><i></i>${st.label}</span></div>
    <div className="pay-d">
      ${r.status === 'requested' && html`<span>Requested ${when(r.requestedAt)}${r.note ? ' · “' + r.note + '”' : ''}</span>`}
      ${r.status === 'delivered' && html`<span>Delivered ${when(r.decidedAt)} · ${r.fileName} · ${fmtSize(r.fileSize)}</span>`}
      ${r.status === 'declined' && html`<span>${r.reason || 'This payslip is not available yet.'}</span>`}
      ${r.status === 'cancelled' && html`<span>You cancelled this request on ${when(r.decidedAt)}.</span>`}</div>
    ${err && html`<div className="lg-err" role="alert">${err}</div>`}
    <div className="pay-a">
      ${r.status === 'delivered' && html`<button className="btn pri sm" disabled=${busy} onClick=${() => run(() => downloadPayslip(r.id))}><${Icon} n="download" s=${15}/> ${busy ? 'Opening…' : 'Download'}</button>`}
      ${r.status === 'requested' && html`<button className="btn ghost sm" disabled=${busy} onClick=${() => run(() => cancelPayslip(r.emp, r.id))}>Cancel request</button>`}
      ${(r.status === 'declined' || r.status === 'cancelled') && html`<button className="btn sec2 sm" onClick=${() => again(r.month)}>Request again</button>`}</div>
  </article>`;
}

/* The employee's Payslips page: ask for a month, then download it when it is delivered. */
export function Payslips({ user, pay }) {
  const mine = (pay.list || []).filter(r => r.emp === user.n).sort((a, b) => b.month.localeCompare(a.month) || b.requestedAt - a.requestedAt);
  const months = requestableMonths(TODISO, user.join), taken = new Set(mine.filter(isOpen).map(r => r.month)), free = months.filter(m => !taken.has(m.iso));
  const [month, setMonth] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [sent, setSent] = useState('');
  const pick = free.some(m => m.iso === month) ? month : (free[0] ? free[0].iso : '');
  const send = async ev => {
    ev.preventDefault(); if (!pick || busy) return; setBusy(true); setErr(''); setSent('');
    try { await requestPayslip(user.n, pick, note); setSent('Requested the payslip for ' + monthLabel(pick) + '. You will get a notification when it is ready.'); setNote(''); setMonth(''); await pay.reload(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return html`<div className="pay">
    <div className="pg-h"><div><h1><${HI} n="payslips" tone="green"/>Payslips</h1><p>Ask for a month and download it when it is ready.</p></div></div>
    <section className="pay-req">
      <h2 className="st-h">Request a payslip</h2>
      ${months.length === 0 ? html`<p className="pay-none">There is no finished month to ask for yet.</p>`
        : free.length === 0 ? html`<p className="pay-none">You have already asked for every month you can.</p>`
        : html`<form onSubmit=${send} noValidate>
          <div className="pay-f"><div className="fld"><label htmlFor="pay-m">Month</label>
            <select id="pay-m" className="inp" value=${pick} onChange=${ev => { setMonth(ev.target.value); setSent(''); setErr(''); }}>${free.map(m => html`<option key=${m.iso} value=${m.iso}>${m.label}</option>`)}</select></div>
            <div className="fld"><label htmlFor="pay-n">Note <span className="aw-opt">optional</span></label><input id="pay-n" className="inp" maxLength="300" value=${note} placeholder="For example: needed for a bank form" onChange=${ev => setNote(ev.target.value)}/></div>
            <button type="submit" className="btn pri" disabled=${busy || !pick}>${busy ? 'Sending…' : 'Request payslip'}</button></div>
          ${err && html`<div className="eod-e" role="alert">${err}</div>`}
          ${sent && html`<div className="pay-ok" role="status"><${Icon} n="check" s=${16}/> ${sent}</div>`}</form>`}
    </section>
    <section className="pay-list">
      <h2 className="st-h">Your requests</h2>
      ${pay.err && html`<div className="eod-e" role="alert">${pay.err}</div>`}
      ${pay.list === null ? html`<div className="none">Loading…</div>`
        : mine.length === 0 ? html`<div className="none"><b>No requests yet</b>When you ask for a payslip it appears here.</div>`
        : html`<div className="pay-l">${mine.map(r => html`<${Mine} key=${r.id} r=${r} again=${m => { setMonth(m); setSent(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}/>`)}</div>`}
    </section>
  </div>`;
}
