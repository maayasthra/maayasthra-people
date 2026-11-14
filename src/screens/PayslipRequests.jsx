import { useState, useRef } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { BY, fmtDM } from '../data.js';
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
  const first = e.name.split(' ')[0];
  return html`<article className=${'rq3-c' + (pend ? '' : ' done')}>
    <button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${46}/></button>
    <div className="rq3-m">
      <div className="rq3-n"><b>${e.name}</b><span>${e.dept}</span>${e.n === admin.n && html`<em className="rq3-you">Your request</em>`}</div>
      <div className="rq3-d"><span className="pay-mo"><${Icon} n="payslips" s=${15}/>${monthLong(r.month)}</span><span className=${'pay-s ' + st.tone}><i></i>${st.label}</span><span className="pay-when">Requested ${when(r.requestedAt)}</span></div>
      ${r.note && html`<p className="rq3-r">${r.note}</p>`}
      ${r.status === 'delivered' && html`<div className="pay-file"><${Icon} n="eod" s=${16}/><span><b>${r.fileName}</b><small>${fmtSize(r.fileSize)} · delivered ${when(r.decidedAt)}${r.decidedBy && BY[r.decidedBy] ? ' by ' + (r.decidedBy === admin.n ? 'you' : BY[r.decidedBy].name) : ''}</small></span></div>`}
      ${r.status === 'declined' && html`<p className="rq3-r">Not available${r.reason ? ': ' + r.reason : ''} <small>${when(r.decidedAt)}</small></p>`}
      ${f && html`<div className="pay-file chosen"><${Icon} n="eod" s=${16}/><span><b>${f.name}</b><small>${fmtSize(f.size)} · ready to send to ${first}</small></span></div>`}
      ${declining && html`<div className="pay-dec"><input className="inp" autoFocus maxLength="300" value=${reason} placeholder=${'Why ' + first + ' cannot have it yet (optional)'} aria-label="Reason" onChange=${ev => setReason(ev.target.value)}/></div>`}
      ${err && html`<div className="lg-err" role="alert" style=${{ margin: '10px 0 0' }}>${err}</div>`}
    </div>
    <div className="rq3-a">
      <input ref=${file} type="file" accept=${ACCEPT} hidden onChange=${pick}/>
      ${f ? html`<button className="btn pri sm" disabled=${busy} onClick=${send}><${Icon} n="check" s=${15}/> ${busy ? 'Sending…' : 'Send payslip'}</button><button className="btn ghost sm" disabled=${busy} onClick=${() => file.current && file.current.click()}>Change file</button><button className="btn ghost sm" disabled=${busy} onClick=${() => setF(null)}>Cancel</button>`
        : declining ? html`<button className="btn danger sm" disabled=${busy} onClick=${decline}>${busy ? 'Saving…' : 'Decline request'}</button><button className="btn ghost sm" disabled=${busy} onClick=${() => { setDeclining(false); setErr(''); }}>Back</button>`
        : pend ? html`<button className="btn pri sm" onClick=${() => file.current && file.current.click()}><${Icon} n="upload" s=${15}/> Upload payslip</button><button className="btn ghost sm" onClick=${() => { setDeclining(true); setErr(''); }}>Not available</button>`
        : r.status === 'delivered' ? html`<button className="btn sec2 sm" disabled=${busy} onClick=${() => run(() => downloadPayslip(r.id))}><${Icon} n="download" s=${15}/> Download</button><button className="btn ghost sm" onClick=${() => file.current && file.current.click()}>Replace file</button>` : null}
    </div>
  </article>`;
}

/* Admin: payslip requests. Upload the file for a request to deliver it; the employee is notified and downloads it from their Payslips page. */
export function PayslipRequests({ user, pay, open }) {
  const [tab, setTab] = useState('pending');
  const all = (pay.list || []).filter(r => BY[r.emp]);
  const waiting = all.filter(r => r.status === 'requested').sort((a, b) => a.requestedAt - b.requestedAt);
  const done = all.filter(r => r.status !== 'requested').sort((a, b) => (b.decidedAt || b.requestedAt) - (a.decidedAt || a.requestedAt));
  const list = tab === 'pending' ? waiting : done;
  const Tab = ({ k, label, n }) => html`<button className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${label}${n > 0 && html`<em className=${k === 'pending' ? 'hot' : ''}>${n}</em>`}</button>`;
  return html`<div>
    <div className="seg seg-t" role="group" aria-label="Payslip requests"><${Tab} k="pending" label="Waiting" n=${waiting.length}/><${Tab} k="done" label="Done" n=${done.length}/></div>
    ${pay.err && html`<div className="eod-e" role="alert" style=${{ marginTop: 16 }}>${pay.err}</div>`}
    ${pay.list === null ? html`<div className="none">Loading…</div>`
      : list.length === 0 ? html`<div className="rq3-e"><span><${Icon} n=${tab === 'pending' ? 'check' : 'payslips'} s=${22}/></span><div><b>${tab === 'pending' ? 'No payslip requests waiting' : 'Nothing delivered yet'}</b><p>${tab === 'pending' ? 'When an employee asks for a payslip it appears here. Upload the file to deliver it.' : 'Delivered and closed requests appear here.'}</p></div></div>`
      : html`<div className="rq3-l">${list.map(r => html`<${Card} key=${r.id} r=${r} admin=${user} open=${open}/>`)}</div>`}
  </div>`;
}
