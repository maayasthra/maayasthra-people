import { useState } from 'react';
import { html, Icon, Av, HI } from '../ui.jsx';
import { downloadLeaveReport } from '../report.js';
import { BY, TODISO, pd, fmtDay, fmtDM, plural, range, workDays, awayList, balances } from '../data.js';
import { dayKey } from '../attendance.js';
import { typeIcon } from './Home.jsx';
import { CopyLeave } from '../CopyLeave.jsx';
import { PayslipRequests, DecidedToggle } from './PayslipRequests.jsx';
import { useConfirm } from '../Confirm.jsx';
import { leaveDialog } from '../leaveFacts.js';
import { FilterBar, matches } from '../Filters.jsx';

const STATE_C = { approved: '#30D158', declined: '#FF453A' };
const COLS = 'minmax(150px,1.4fr) minmax(120px,1fr) 84px minmax(110px,1fr) 118px minmax(120px,1fr) 150px';

export function Requests({ user, leaves: all, setLeaves, open, pay }) {
  const [past, setPast] = useState(false), [kind, setKind] = useState('leave'), [cfEl, ask] = useConfirm(), [q, setQ] = useState(''), [st, setSt] = useState('all'), [ty, setTy] = useState('all');
  const payWaiting = (pay && pay.list ? pay.list : []).filter(r => r.status === 'requested').length;
  const leaves = all.filter(l => !l.past && BY[l.emp]);
  const fit = l => matches(q, BY[l.emp].name, BY[l.emp].dept, l.reason) && (ty === 'all' || l.type === ty) && (st === 'all' || l.state === st);
  const waiting = leaves.filter(l => l.state === 'pending' && fit(l)).sort((a, b) => a.from.localeCompare(b.from));
  const decided = leaves.filter(l => l.state !== 'pending' && fit(l)).sort((a, b) => b.from.localeCompare(a.from));
  const filtering = q.trim() !== '' || st !== 'all' || ty !== 'all', showDone = past || (filtering && decided.length > 0);
  const waitAll = leaves.filter(l => l.state === 'pending').length;
  const types = [...new Set(leaves.map(l => l.type))].sort();
  const away = awayList(all);
  const decide = (l, state) => setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state, by: state === 'pending' ? '' : user.name, byId: state === 'pending' ? 0 : user.n, at: state === 'pending' ? 0 : Date.now() } : x));
  // Approving or declining asks first, with the things worth knowing (balance, who else is out, holidays)
  const confirmDecision = async (l, state) => { if (await ask(leaveDialog(l, all, state))) decide(l, state); };
  // Who decided, and when
  const decidedBy = l => l.by ? (l.byId === user.n ? 'you' : l.by) + (l.at ? ' · ' + fmtDM(dayKey(l.at)) : '') + (l.byId === l.emp ? ' · own request' : '') : '';

  const When = ({ l }) => html`<span className="rq3-w"><b>${l.from === l.to ? fmtDay(pd(l.from)) : range(l.from, l.to)}</b><i></i><b>${l.half ? 'Half day' : plural(l.days, 'day')}</b></span>`;
  const Type = ({ l }) => html`<span className="rq3-t"><${Icon} n=${typeIcon(l.type)} s=${15}/>${l.type}</span>`;

  const Card = ({ l }) => {
    const e = BY[l.emp], pend = l.state === 'pending';
    const peers = [...new Set(away.filter(a => a.emp !== e.n && BY[a.emp] && BY[a.emp].dept === e.dept && l.from <= a.to && l.to >= a.from).map(a => BY[a.emp].name.split(' ')[0]))];
    const bal = balances(all.filter(x => x.emp === e.n)).find(b => b.t === l.type);
    const hol = pend ? workDays(l.from, l.to).hol : [];
    return html`<article className=${'rq3-c' + (pend ? '' : ' done')}>
      <button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${46}/></button>
      <div className="rq3-m">
        <div className="rq3-n"><b>${e.name}</b><span>${e.dept}</span>${e.n === user.n && html`<em className="rq3-you">Your request</em>`}</div>
        <div className="rq3-d"><${When} l=${l}/><${Type} l=${l}/></div>
        ${pend && l.reason && html`<p className="rq3-r">${l.reason}</p>`}
        ${pend && html`<div className="rq3-i">
          ${bal && html`<span><${Icon} n="check" s=${13}/>${Math.max(bal.left - l.days, 0)} of ${bal.total} ${l.type.toLowerCase().replace(' leave', '')} days left after this</span>`}
          <span className=${peers.length ? 'warn' : ''}><${Icon} n="people" s=${13}/>${peers.length ? peers.join(' and ') + (peers.length === 1 ? ' is' : ' are') + ' also out' : 'No one else in ' + e.dept + ' is out'}</span>
          ${hol.length > 0 && html`<span><${Icon} n="calendar" s=${13}/>Skips ${hol.join(', ')}</span>`}</div>`}
      </div>
      <div className="rq3-a">${pend ? html`<button className="btn pri sm" onClick=${() => confirmDecision(l, 'approved')}><${Icon} n="check" s=${15}/> Approve</button><button className="btn ghost sm" onClick=${() => confirmDecision(l, 'declined')}>Decline</button><${CopyLeave} l=${l} all=${all}/>`
        : html`<span className="rq3-sw"><span className="rq3-st" style=${{ '--c': STATE_C[l.state] }}><i></i>${l.state === 'approved' ? 'Approved' : 'Declined'}</span>${decidedBy(l) && html`<small>by ${decidedBy(l)}</small>`}</span><${CopyLeave} l=${l} all=${all}/><button className="rq3-u" onClick=${() => decide(l, 'pending')}>Undo</button>`}</div>
    </article>`;
  };

  // A decided request as one line of the table: the same columns on every row
  const Line = ({ l }) => {
    const e = BY[l.emp], ap = l.state === 'approved';
    return html`<article className="tc-r">
      <div className="tc-who"><button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${36}/></button><span><b>${e.name}</b><small>${e.dept}${e.n === user.n ? ' · Your request' : ''}</small></span></div>
      <div data-l="Dates"><b>${l.from === l.to ? fmtDay(pd(l.from)) : range(l.from, l.to)}</b><small>${l.from.slice(0, 4)}</small></div>
      <div data-l="Days"><b>${l.half ? 'Half day' : plural(l.days, 'day')}</b></div>
      <div data-l="Type"><span className="rq3-t"><${Icon} n=${typeIcon(l.type)} s=${15}/>${l.type}</span></div>
      <div data-l="Status"><span className=${'pay-s ' + (ap ? 'ok' : 'err')}><i></i>${ap ? 'Approved' : 'Declined'}</span></div>
      <div data-l="Decided"><span>${l.by ? (l.byId === user.n ? 'you' : l.by) : '–'}</span><small>${l.at ? fmtDM(dayKey(l.at)) + (l.byId === l.emp ? ' · own request' : '') : ''}</small></div>
      <div className="tc-act"><${CopyLeave} l=${l} all=${all}/><button className="btn ghost sm" onClick=${() => decide(l, 'pending')}>Undo</button></div>
    </article>`;
  };

  return html`<div>
    ${cfEl}
    <div className="pg-h"><div><h1><${HI} n="requests" tone="orange"/>Requests</h1><p>${waitAll + payWaiting ? [waitAll ? waitAll + ' leave' : '', payWaiting ? payWaiting + (payWaiting === 1 ? ' payslip' : ' payslips') : ''].filter(Boolean).join(' and ') + ' waiting for you' : 'All clear'}</p></div>
      ${kind === 'leave' && html`<button className="btn sec2" onClick=${() => downloadLeaveReport(all)}><${Icon} n="download" s=${16}/> Export</button>`}</div>
    <div className="tabs" role="tablist" aria-label="Kind of request">
      <button role="tab" aria-selected=${kind === 'leave'} className=${kind === 'leave' ? 'on' : ''} onClick=${() => setKind('leave')}><${Icon} n="leaves" s=${17}/>Leave${waitAll > 0 ? html`<em>${waitAll}</em>` : null}</button>
      <button role="tab" aria-selected=${kind === 'payslips'} className=${kind === 'payslips' ? 'on' : ''} onClick=${() => setKind('payslips')}><${Icon} n="payslips" s=${17}/>Payslips${payWaiting > 0 ? html`<em>${payWaiting}</em>` : null}</button></div>
    ${kind === 'payslips' ? html`<${PayslipRequests} user=${user} pay=${pay || { list: [], err: '' }} open=${open}/>` : html`<div className="rq-body">
    ${leaves.length > 3 && html`<${FilterBar} q=${q} setQ=${setQ} placeholder="Search by name or reason" shown=${waiting.length + decided.length} total=${leaves.length} noun="requests" groups=${[
      { label: 'Status', value: st, set: setSt, options: [['all', 'All statuses'], ['pending', 'Waiting'], ['approved', 'Approved'], ['declined', 'Declined']] },
      { label: 'Leave type', value: ty, set: setTy, options: [['all', 'All types'], ...types.map(t => [t, t])] }]}/>`}
    ${filtering && waiting.length + decided.length === 0 ? html`<div className="tc-empty"><b>No requests match</b>Try a different search or clear the filters.</div>`
      : waiting.length === 0 ? (!filtering && html`<div className="rq3-e"><span><${Icon} n="check" s=${22}/></span><div><b>You are all caught up</b><p>New leave requests will show up here.</p></div></div>`)
      : html`<div className="rq3-l">${waiting.map(l => html`<${Card} key=${l.id} l=${l}/>`)}</div>`}
    ${!filtering && html`<${DecidedToggle} n=${decided.length} open=${past} set=${setPast} label="decided requests"/>`}
    ${showDone && html`<div className="tc" style=${{ '--cols': COLS }} role="table" aria-label="Decided leave requests">
      <div className="tc-h" role="row"><span>Employee</span><span>Dates</span><span>Days</span><span>Type</span><span>Status</span><span>Decided by</span><span></span></div>
      ${decided.map(l => html`<${Line} key=${l.id} l=${l}/>`)}</div>`}
  </div>`}
  </div>`;
}
