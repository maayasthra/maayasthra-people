import { useState, useRef } from 'react';
import { FilterBar, matches } from '../Filters.jsx';
import { html, Icon, Av } from '../ui.jsx';
import { BY, ROLEMAP, fmtDM } from '../data.js';
import { dayKey } from '../attendance.js';
import { monthLong, monthLabel, STATUS, fmtSize, fileMonthMismatch } from '../payslipMonths.js';
import { useConfirm } from '../Confirm.jsx';
import { readPayslipFile, deliverPayslip, declinePayslip, downloadPayslip } from '../payslipsDb.js';

const when = ts => ts ? fmtDM(dayKey(ts)) : '';
const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
const Dash = () => html`<span className="tc-dash">–</span>`;

// Shared by the waiting card and the history row: choosing a file, sending it, and the errors that can follow.
function useDeliver(r, admin, ask, e) {
  const file = useRef(null), [f, setF] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const run = async fn => { setBusy(true); setErr(''); try { await fn(); } catch (x) { setErr(x.message); } setBusy(false); };
  const pick = async ev => { const file0 = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!file0) return; setErr(''); try { setF(await readPayslipFile(file0)); } catch (x) { setErr(x.message); } };
  // Sending a payslip asks first: it goes to one person and is private, so the person and month are shown for a last check
  const send = async () => {
    const again = r.status === 'delivered';
    const ok = await ask({ title: again ? 'Replace the payslip file?' : 'Send this payslip?', icon: 'payslips', confirm: again ? 'Replace file' : 'Send payslip',
      body: e.name + ' · ' + monthLong(r.month) + ' · ' + f.name + ' (' + fmtSize(f.size) + ')',
      items: (fileMonthMismatch(f.name, r.month) ? [{ tone: 'bad', text: fileMonthMismatch(f.name, r.month) }] : []).concat([{ tone: 'warn', text: 'Payslips are private. Check this is the right person and the right month.' }]).concat(again ? [{ tone: 'warn', text: 'They have not downloaded the earlier file yet. It will be replaced.' }] : [{ tone: 'ok', text: e.name.split(' ')[0] + ' is told it is ready. The file is removed from the server once they download it.' }]) });
    if (ok) run(async () => { await deliverPayslip(admin.n, r.id, f); setF(null); });
  };
  return { file, f, setF, busy, err, setErr, run, pick, send, choose: () => file.current && file.current.click() };
}
const SendForm = ({ d, first }) => html`<div className="pay-form">
  <div className="pay-file chosen"><${Icon} n="eod" s=${16}/><span><b>${d.f.name}</b><small>${fmtSize(d.f.size)} · ready to send to ${first}</small></span></div>
  <div className="pay-bar"><button className="btn pri sm" disabled=${d.busy} onClick=${d.send}><${Icon} n="check" s=${15}/> ${d.busy ? 'Sending…' : 'Send payslip'}</button><button className="btn ghost sm" disabled=${d.busy} onClick=${d.choose}>Choose another file</button><button className="btn ghost sm" disabled=${d.busy} onClick=${() => { d.setF(null); d.setErr(''); }}>Cancel</button></div></div>`;

// A request that is waiting for you: a card with room for the upload and decline forms. Each card keeps its own state, so it lives outside the list.
function Card({ r, admin, open, ask }) {
  const e = BY[r.emp], st = STATUS[r.status], d = useDeliver(r, admin, ask, BY[r.emp]);
  const [declining, setDeclining] = useState(false), [reason, setReason] = useState('');
  if (!e) return null;
  const decline = () => d.run(async () => { await declinePayslip(admin.n, r.id, reason); setDeclining(false); setReason(''); });
  const first = e.name.split(' ')[0], editing = !!d.f || declining;      // while sending a file or declining, the form takes the whole card
  return html`<article className=${'rq3-c' + (editing ? ' pay-solo' : '')}>
    <button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${46}/></button>
    <div className="rq3-m">
      <div className="rq3-n"><b>${e.name}</b><span>${e.dept}</span>${ROLEMAP[e.n] === 'Project manager' && html`<em className="pay-role">Project manager</em>`}${e.n === admin.n && html`<em className="rq3-you">Your request</em>`}</div>
      <div className="rq3-d"><span className="pay-mo"><${Icon} n="payslips" s=${15}/>${monthLong(r.month)}</span><span className=${'pay-s ' + st.tone}><i></i>${st.label}</span><span className="pay-when">Requested ${when(r.requestedAt)}</span></div>
      ${r.note && html`<p className="rq3-r">${r.note}</p>`}
      ${d.f && html`<${SendForm} d=${d} first=${first}/>`}
      ${declining && html`<div className="pay-form">
        <label className="pay-l" htmlFor=${'pay-r-' + r.id}>Reason for ${first} <span className="aw-opt">optional</span></label>
        <input id=${'pay-r-' + r.id} className="inp" autoFocus maxLength="300" value=${reason} placeholder="For example: payroll is not closed yet" onChange=${ev => setReason(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') decline(); if (ev.key === 'Escape') { setDeclining(false); d.setErr(''); } }}/>
        <div className="pay-bar"><button className="btn danger sm" disabled=${d.busy} onClick=${decline}>${d.busy ? 'Saving…' : 'Decline request'}</button><button className="btn ghost sm" disabled=${d.busy} onClick=${() => { setDeclining(false); d.setErr(''); }}>Back</button></div></div>`}
      ${d.err && html`<div className="lg-err" role="alert" style=${{ margin: '10px 0 0' }}>${d.err}</div>`}
    </div>
    <input ref=${d.file} type="file" accept=${ACCEPT} hidden onChange=${d.pick}/>
    ${!editing && html`<div className="rq3-a"><button className="btn pri sm" onClick=${d.choose}><${Icon} n="upload" s=${15}/> Upload payslip</button><button className="btn ghost sm" onClick=${() => { setDeclining(true); d.setErr(''); }}>Decline</button></div>`}
  </article>`;
}

// One line of the history. Every row uses the same columns (see .pay-tbl), so the dates, files and notes line up from card to card.
function Row({ r, admin, open, ask }) {
  const e = BY[r.emp], st = STATUS[r.status], d = useDeliver(r, admin, ask, BY[r.emp]);
  if (!e) return null;
  const first = e.name.split(' ')[0], hasFile = r.status === 'delivered' || r.status === 'downloaded';
  const who = r.decidedBy && BY[r.decidedBy] ? (r.decidedBy === admin.n ? 'you' : BY[r.decidedBy].name.split(' ')[0]) : '';
  const note = r.status === 'declined' ? r.reason : r.note;
  return html`<article className="tc-r">
    <div className="tc-who"><button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${36}/></button>
      <span><b>${e.name}</b><small>${e.dept}${ROLEMAP[e.n] === 'Project manager' ? ' · Project manager' : ''}${e.n === admin.n ? ' · Your request' : ''}</small></span></div>
    <div data-l="Month" title=${monthLong(r.month)}><b>${monthLabel(r.month)}</b></div>
    <div data-l="Status"><span className=${'pay-s ' + st.tone}><i></i>${st.label}</span></div>
    <div data-l="File" title=${hasFile ? r.fileName : ''}>${hasFile ? html`<span className="tc-fn">${r.fileName}</span><small>${fmtSize(r.fileSize)}</small>` : html`<${Dash}/>`}</div>
    <div data-l="Answered">${hasFile ? html`<span>${when(r.decidedAt)}</span><small>delivered${who ? ' by ' + who : ''}</small>` : r.status === 'declined' || r.status === 'cancelled' ? html`<span>${when(r.decidedAt)}</span><small>${r.status}</small>` : html`<${Dash}/>`}</div>
    <div data-l="Downloaded" title=${r.status === 'downloaded' ? 'The file has been removed from the server' : ''}>${r.status === 'downloaded' ? html`<span className="pay-dl">${when(r.downloadedAt)}</span><small>file removed</small>` : r.status === 'delivered' ? html`<small>not yet</small>` : html`<${Dash}/>`}</div>
    <div data-l="Note" data-w="all" title=${note || ''}>${note ? html`<span className="tc-fn">${note}</span>` : html`<${Dash}/>`}</div>
    <div className="tc-act">${r.status === 'delivered' && !d.f && html`<button className="ib dl" disabled=${d.busy} onClick=${() => d.run(() => downloadPayslip(r.id))} aria-label=${'Download ' + r.fileName} title="Download the file"><${Icon} n="download" s=${17}/></button><button className="ib rp" onClick=${d.choose} aria-label="Replace the file" title="Replace the file"><${Icon} n="upload" s=${17}/></button>`}</div>
    <input ref=${d.file} type="file" accept=${ACCEPT} hidden onChange=${d.pick}/>
    ${(d.f || d.err) && html`<div className="tc-f">${d.f && html`<${SendForm} d=${d} first=${first}/>`}${d.err && html`<div className="lg-err" role="alert" style=${{ margin: '10px 0 0' }}>${d.err}</div>`}</div>`}
  </article>`;
}

// A quiet link under the waiting list that reveals the older, decided requests. Used by both kinds of request.
export const DecidedToggle = ({ n, open, set, label }) => n > 0 ? html`<button className="rq-more" onClick=${() => set(!open)} aria-expanded=${open}><span>${open ? 'Hide' : 'Show'} ${label} (${n})</span><${Icon} n=${open ? 'up' : 'chevD'} s=${16}/></button>` : null;

/* Admin: payslip requests. Upload the file for a request to deliver it; the employee is notified and downloads it from their Payslips page.
   Waiting requests are cards; past ones are cards lined up in columns under one header. */
const COLS = 'minmax(170px,1.4fr) 80px 168px minmax(90px,1.1fr) 100px 90px minmax(70px,1fr) 84px';
export function PayslipRequests({ user, pay, open }) {
  const [past, setPast] = useState(false), [cfEl, ask] = useConfirm(), [q, setQ] = useState(''), [st, setSt] = useState('all'), [mo, setMo] = useState('all');
  const every = (pay.list || []).filter(r => BY[r.emp]);
  const fit = r => matches(q, BY[r.emp].name, BY[r.emp].dept, r.fileName, r.note) && (st === 'all' || r.status === st) && (mo === 'all' || r.month === mo);
  const all = every.filter(fit);
  const waiting = all.filter(r => r.status === 'requested').sort((a, b) => a.requestedAt - b.requestedAt);
  const done = all.filter(r => r.status !== 'requested').sort((a, b) => (b.decidedAt || b.requestedAt) - (a.decidedAt || a.requestedAt));
  const filtering = q.trim() !== '' || st !== 'all' || mo !== 'all', showDone = past || (filtering && done.length > 0);
  const months = [...new Set(every.map(r => r.month))].sort().reverse();
  return html`<div className="rq-body">
    ${cfEl}
    ${pay.err && html`<div className="eod-e" role="alert">${pay.err}</div>`}
    ${every.length > 3 && html`<${FilterBar} q=${q} setQ=${setQ} placeholder="Search by name or file" shown=${all.length} total=${every.length} noun="requests" groups=${[
      { label: 'Status', value: st, set: setSt, options: [['all', 'All statuses'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])] },
      { label: 'Month', value: mo, set: setMo, options: [['all', 'All months'], ...months.map(m => [m, monthLabel(m)])] }]}/>`}
    ${pay.list === null ? html`<div className="none">Loading…</div>`
      : filtering && all.length === 0 ? html`<div className="tc-empty"><b>No requests match</b>Try a different search or clear the filters.</div>`
      : waiting.length === 0 ? !filtering && html`<div className="rq3-e"><span><${Icon} n="check" s=${22}/></span><div><b>No payslip requests waiting</b><p>When an employee asks for a payslip it appears here. Upload the file to deliver it.</p></div></div>`
      : html`<div className="rq3-l">${waiting.map(r => html`<${Card} key=${r.id} r=${r} admin=${user} open=${open} ask=${ask}/>`)}</div>`}
    ${!filtering && html`<${DecidedToggle} n=${done.length} open=${past} set=${setPast} label="past requests"/>`}
    ${showDone && html`<div className="tc" style=${{ '--cols': COLS }} role="table" aria-label="Past payslip requests">
      <div className="tc-h" role="row"><span>Employee</span><span>Month</span><span>Status</span><span>File</span><span>Answered</span><span>Downloaded</span><span>Note</span><span></span></div>
      ${done.map(r => html`<${Row} key=${r.id} r=${r} admin=${user} open=${open} ask=${ask}/>`)}</div>`}
  </div>`;
}
