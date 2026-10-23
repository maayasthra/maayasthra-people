import { useState } from 'react';
import { html, Icon, Av, HI } from '../ui.jsx';
import { downloadLeaveReport } from '../report.js';
import { BY, TODISO, pd, fmtDay, fmtDM, plural, range, workDays, awayList, balances } from '../data.js';
import { dayKey } from '../attendance.js';
import { typeIcon } from './Home.jsx';

const STATE_C = { approved: '#30D158', declined: '#FF453A' };

export function Requests({ user, leaves: all, setLeaves, open }) {
  const [tab, setTab] = useState('pending');
  const leaves = all.filter(l => !l.past && BY[l.emp]);
  const waiting = leaves.filter(l => l.state === 'pending').sort((a, b) => a.from.localeCompare(b.from));
  const decided = leaves.filter(l => l.state !== 'pending').sort((a, b) => b.from.localeCompare(a.from));
  const away = awayList(all);
  const decide = (l, state) => setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state, by: state === 'pending' ? '' : user.name, byId: state === 'pending' ? 0 : user.n, at: state === 'pending' ? 0 : Date.now() } : x));
  // Who decided, and when
  const decidedBy = l => l.by ? (l.byId === user.n ? 'you' : l.by) + (l.at ? ' · ' + fmtDM(dayKey(l.at)) : '') + (l.byId === l.emp ? ' · own request' : '') : '';
  const list = tab === 'pending' ? waiting : decided;

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
      <div className="rq3-a">${pend ? html`<button className="btn pri sm" onClick=${() => decide(l, 'approved')}><${Icon} n="check" s=${15}/> Approve</button><button className="btn ghost sm" onClick=${() => decide(l, 'declined')}>Decline</button>`
        : html`<span className="rq3-sw"><span className="rq3-st" style=${{ '--c': STATE_C[l.state] }}><i></i>${l.state === 'approved' ? 'Approved' : 'Declined'}</span>${decidedBy(l) && html`<small>by ${decidedBy(l)}</small>`}</span><button className="rq3-u" onClick=${() => decide(l, 'pending')}>Undo</button>`}</div>
    </article>`;
  };

  const Tab = ({ k, label, n }) => html`<button className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${label}${n > 0 && html`<em className=${k === 'pending' ? 'hot' : ''}>${n}</em>`}</button>`;
  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="requests" tone="orange"/>Requests</h1><p>${waiting.length ? waiting.length + ' waiting for you' : 'All clear'}</p></div>
      <button className="btn sec2" onClick=${() => downloadLeaveReport(all)}><${Icon} n="download" s=${16}/> Export</button></div>
    <div className="seg seg-t" role="group" aria-label="Requests"><${Tab} k="pending" label="Pending" n=${waiting.length}/><${Tab} k="decided" label="Decided" n=${decided.length}/></div>
    ${list.length === 0
      ? html`<div className="rq3-e"><span><${Icon} n=${tab === 'pending' ? 'check' : 'requests'} s=${22}/></span><div><b>${tab === 'pending' ? 'You are all caught up' : 'Nothing decided yet'}</b><p>${tab === 'pending' ? 'New leave requests will show up here.' : 'Approved and declined requests will be listed here.'}</p></div></div>`
      : html`<div className="rq3-l">${list.map(l => html`<${Card} key=${l.id} l=${l}/>`)}</div>`}
  </div>`;
}
