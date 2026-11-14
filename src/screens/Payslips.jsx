import { useState } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { FilterBar, matches } from '../Filters.jsx';
import { TODISO, fmtDM } from '../data.js';
import { dayKey } from '../attendance.js';
import { requestableMonths, monthLabel, monthLong, STATUS, isOpen, fmtSize } from '../payslipMonths.js';
import { requestPayslip, cancelPayslip, downloadPayslip } from '../payslipsDb.js';

const when = ts => ts ? fmtDM(dayKey(ts)) : '';

const COLS = 'minmax(84px,1fr) 168px minmax(100px,1.2fr) 88px 88px 96px minmax(80px,1.1fr) 140px';
// One of my requests, as a line of the table. Defined outside the page so its buttons keep their own busy state while the page updates.
function Mine({ r, again }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const st = STATUS[r.status], run = async fn => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };
  const has = r.status === 'delivered' || r.status === 'downloaded', note = r.status === 'declined' ? r.reason : r.note;
  return html`<article className="tc-r">
    <div className="tc-who" title=${monthLong(r.month)}><span><b>${monthLabel(r.month)}</b></span></div>
    <div data-l="Status"><span className=${'pay-s ' + st.tone}><i></i>${st.label}</span></div>
    <div data-l="File" title=${has ? r.fileName : ''}>${has ? html`<span className="tc-fn">${r.fileName}</span><small>${fmtSize(r.fileSize)}${r.status === 'downloaded' ? ' · removed' : ''}</small>` : html`<span className="tc-dash">–</span>`}</div>
    <div data-l="Requested"><span>${when(r.requestedAt)}</span></div>
    <div data-l="Answered">${has ? html`<span>${when(r.decidedAt)}</span>` : r.status === 'declined' || r.status === 'cancelled' ? html`<span>${when(r.decidedAt)}</span><small>${r.status}</small>` : html`<span className="tc-dash">–</span>`}</div>
    <div data-l="Downloaded">${r.status === 'downloaded' ? html`<span className="pay-dl">${when(r.downloadedAt)}</span>` : r.status === 'delivered' ? html`<small>not yet</small>` : html`<span className="tc-dash">–</span>`}</div>
    <div data-l="Note" data-w="all" title=${note || ''}>${note ? html`<span className="tc-fn">${note}</span>` : html`<span className="tc-dash">–</span>`}</div>
    <div className="tc-act">
      ${r.status === 'delivered' && html`<button className="btn pri sm" disabled=${busy} onClick=${() => run(() => downloadPayslip(r.id, r.emp))}><${Icon} n="download" s=${15}/> ${busy ? 'Downloading…' : 'Download'}</button>`}
      ${r.status === 'requested' && html`<button className="btn ghost sm" disabled=${busy} onClick=${() => run(() => cancelPayslip(r.emp, r.id))}>Cancel request</button>`}
      ${(r.status === 'declined' || r.status === 'cancelled' || r.status === 'downloaded') && html`<button className="btn sec2 sm" onClick=${() => again(r.month)}>Request again</button>`}</div>
    ${err && html`<div className="tc-f"><div className="lg-err" role="alert">${err}</div></div>`}
  </article>`;
}

/* The employee's Payslips page: ask for a month, then download it when it is delivered. */
export function Payslips({ user, pay }) {
  const mine = (pay.list || []).filter(r => r.emp === user.n).sort((a, b) => b.month.localeCompare(a.month) || b.requestedAt - a.requestedAt);
  const months = requestableMonths(TODISO, user.join), taken = new Set(mine.filter(isOpen).map(r => r.month)), free = months.filter(m => !taken.has(m.iso));
  const [q, setQ] = useState(''), [fs, setFs] = useState('all'), [fy, setFy] = useState('all'), [month, setMonth] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [sent, setSent] = useState('');
  const pick = free.some(m => m.iso === month) ? month : (free[0] ? free[0].iso : '');
  const shownList = mine.filter(r => matches(q, monthLong(r.month), r.fileName, r.note, r.reason) && (fs === 'all' || r.status === fs) && (fy === 'all' || r.month.slice(0, 4) === fy));
  const years = [...new Set(mine.map(r => r.month.slice(0, 4)))].sort().reverse(), anyReady = mine.some(r => r.status === 'delivered');
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
        : html`${mine.length > 3 && html`<${FilterBar} q=${q} setQ=${setQ} placeholder="Search month, file or note" shown=${shownList.length} total=${mine.length} noun="requests" groups=${[
            { label: 'Status', value: fs, set: setFs, options: [['all', 'All statuses'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])] },
            ...(years.length > 1 ? [{ label: 'Year', value: fy, set: setFy, options: [['all', 'All years'], ...years.map(y => [y, y])] }] : [])]}/>`}
          ${anyReady && html`<p className="pay-note" style=${{ marginTop: 10 }}>When you download a payslip, the file is removed from our servers, so keep your copy safe.</p>`}
          ${shownList.length === 0 ? html`<div className="tc-empty"><b>No requests match</b>Try a different search or clear the filters.</div>`
            : html`<div className="tc" style=${{ '--cols': COLS }} role="table" aria-label="Your payslip requests">
              <div className="tc-h" role="row"><span>Month</span><span>Status</span><span>File</span><span>Requested</span><span>Answered</span><span>Downloaded</span><span>Note</span><span></span></div>
              ${shownList.map(r => html`<${Mine} key=${r.id} r=${r} again=${m => { setMonth(m); setSent(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}/>`)}</div>`}`}
    </section>
  </div>`;
}
