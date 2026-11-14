import { useState, useRef } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { BY, ROLEMAP, fmtDM } from '../data.js';
import { dayKey } from '../attendance.js';
import { monthLong, STATUS, fmtSize } from '../payslipMonths.js';
import { readPayslipFile, deliverPayslip, declinePayslip, downloadPayslip } from '../payslipsDb.js';

const when = ts => ts ? fmtDM(dayKey(ts)) : '';
const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

// One request. Each card keeps its own chosen file, busy state and errors, so it lives outside the list.
function Card({ r, admin, open }) {
  const e = BY[r.emp], st = STATUS[r.status], pend = r.status === 'requested', file = useRef(null);
  const [f, setF] = useState(null), [declining, setDeclining] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  if (!e) return null;
  const run = async fn => { setBusy(true); setErr(''); try { await fn(); } catch (x) { setErr(x.message); } setBusy(false); };
  const pick = async ev => { const file0 = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!file0) return; setErr(''); try { setF(await readPayslipFile(file0)); } catch (x) { setErr(x.message); } };
  const send = () => run(async () => { await deliverPayslip(admin.n, r.id, f); setF(null); });
  const decline = () => run(async () => { await declinePayslip(admin.n, r.id, reason); setDeclining(false); setReason(''); });
  const first = e.name.split(' ')[0], editing = !!f || declining;      // while sending a file or declining, the form takes the whole card
  const choose = () => file.current && file.current.click();
  const fileRow = html`<div className="pay-file"><${Icon} n="eod" s=${16}/><span><b>${r.fileName}</b><small>${fmtSize(r.fileSize)} · delivered ${when(r.decidedAt)}${r.decidedBy && BY[r.decidedBy] ? ' by ' + (r.decidedBy === admin.n ? 'you' : BY[r.decidedBy].name) : ''}</small></span></div>`;
  return html`<article className=${'rq3-c' + (pend ? '' : ' done') + (editing ? ' pay-solo' : '')}>
    <button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${46}/></button>
    <div className="rq3-m">
      <div className="rq3-n"><b>${e.name}</b><span>${e.dept}</span>${ROLEMAP[e.n] === 'Project manager' && html`<em className="pay-role">Project manager</em>`}${e.n === admin.n && html`<em className="rq3-you">Your request</em>`}</div>
      <div className="rq3-d"><span className="pay-mo"><${Icon} n="payslips" s=${15}/>${monthLong(r.month)}</span><span className=${'pay-s ' + st.tone}><i></i>${st.label}</span><span className="pay-when">Requested ${when(r.requestedAt)}</span></div>
      ${r.note && html`<p className="rq3-r">${r.note}</p>`}
      ${r.status === 'delivered' && !editing && fileRow}
      ${r.status === 'declined' && html`<p className="rq3-r">Declined${r.reason ? ': ' + r.reason : ''} <small>${when(r.decidedAt)}</small></p>`}
      ${f && html`<div className="pay-form">
        <div className="pay-file chosen"><${Icon} n="eod" s=${16}/><span><b>${f.name}</b><small>${fmtSize(f.size)} · ready to send to ${first}</small></span></div>
        <div className="pay-bar"><button className="btn pri sm" disabled=${busy} onClick=${send}><${Icon} n="check" s=${15}/> ${busy ? 'Sending…' : 'Send payslip'}</button><button className="btn ghost sm" disabled=${busy} onClick=${choose}>Choose another file</button><button className="btn ghost sm" disabled=${busy} onClick=${() => { setF(null); setErr(''); }}>Cancel</button></div></div>`}
      ${declining && html`<div className="pay-form">
        <label className="pay-l" htmlFor=${'pay-r-' + r.id}>Reason for ${first} <span className="aw-opt">optional</span></label>
        <input id=${'pay-r-' + r.id} className="inp" autoFocus maxLength="300" value=${reason} placeholder="For example: payroll is not closed yet" onChange=${ev => setReason(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') decline(); if (ev.key === 'Escape') { setDeclining(false); setErr(''); } }}/>
        <div className="pay-bar"><button className="btn danger sm" disabled=${busy} onClick=${decline}>${busy ? 'Saving…' : 'Decline request'}</button><button className="btn ghost sm" disabled=${busy} onClick=${() => { setDeclining(false); setErr(''); }}>Back</button></div></div>`}
      ${err && html`<div className="lg-err" role="alert" style=${{ margin: '10px 0 0' }}>${err}</div>`}
    </div>
    <input ref=${file} type="file" accept=${ACCEPT} hidden onChange=${pick}/>
    ${!editing && html`<div className="rq3-a">
      ${pend ? html`<button className="btn pri sm" onClick=${choose}><${Icon} n="upload" s=${15}/> Upload payslip</button><button className="btn ghost sm" onClick=${() => { setDeclining(true); setErr(''); }}>Decline</button>`
        : r.status === 'delivered' ? html`<button className="btn sec2 sm" disabled=${busy} onClick=${() => run(() => downloadPayslip(r.id))}><${Icon} n="download" s=${15}/> Download</button><button className="btn ghost sm" onClick=${choose}>Replace file</button>` : null}</div>`}
  </article>`;
}

/* Admin: payslip requests. Upload the file for a request to deliver it; the employee is notified and downloads it from their Payslips page. */
// A quiet link under the waiting list that reveals the older, decided requests. Used by both kinds of request.
export const DecidedToggle = ({ n, open, set, label }) => n > 0 ? html`<button className="rq-more" onClick=${() => set(!open)} aria-expanded=${open}><span>${open ? 'Hide' : 'Show'} ${label} (${n})</span><${Icon} n=${open ? 'up' : 'chevD'} s=${16}/></button>` : null;

export function PayslipRequests({ user, pay, open }) {
  const [past, setPast] = useState(false);
  const all = (pay.list || []).filter(r => BY[r.emp]);
  const waiting = all.filter(r => r.status === 'requested').sort((a, b) => a.requestedAt - b.requestedAt);
  const done = all.filter(r => r.status !== 'requested').sort((a, b) => (b.decidedAt || b.requestedAt) - (a.decidedAt || a.requestedAt));
  return html`<div className="rq-body">
    ${pay.err && html`<div className="eod-e" role="alert">${pay.err}</div>`}
    ${pay.list === null ? html`<div className="none">Loading…</div>`
      : waiting.length === 0 ? html`<div className="rq3-e"><span><${Icon} n="check" s=${22}/></span><div><b>No payslip requests waiting</b><p>When an employee asks for a payslip it appears here. Upload the file to deliver it.</p></div></div>`
      : html`<div className="rq3-l">${waiting.map(r => html`<${Card} key=${r.id} r=${r} admin=${user} open=${open}/>`)}</div>`}
    <${DecidedToggle} n=${done.length} open=${past} set=${setPast} label="delivered and declined"/>
    ${past && html`<div className="rq3-l rq-past">${done.map(r => html`<${Card} key=${r.id} r=${r} admin=${user} open=${open}/>`)}</div>`}
  </div>`;
}
