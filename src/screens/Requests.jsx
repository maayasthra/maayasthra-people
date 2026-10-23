import { useState } from 'react';
import { html, Icon, Av, HI } from '../ui.jsx';
import { downloadLeaveReport } from '../report.js';
import { BY, TODISO, pd, fmtDay, plural, range, workDays, awayList, balances } from '../data.js';
import { typeIcon } from './Home.jsx';

const STATE_C = { approved: '#30D158', declined: '#FF453A' };
const TYPE_C = { 'Annual leave': '#0A84FF', 'Casual leave': '#FF9F0A', 'Sick leave': '#FF453A' };

export function Requests({ user, leaves: all, setLeaves, open }) {
  const [tab, setTab] = useState('pending');
  const leaves = all.filter(l => !l.past && l.emp !== user.n && BY[l.emp]);
  const waiting = leaves.filter(l => l.state === 'pending').sort((a, b) => a.from.localeCompare(b.from));
  const decided = leaves.filter(l => l.state !== 'pending').sort((a, b) => b.from.localeCompare(a.from));
  const away = awayList(all);
  const decide = (l, state) => setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state } : x));
  const list = tab === 'pending' ? waiting : decided;

  const When = ({ l }) => html`<span className="rq3-w">${l.from === l.to ? fmtDay(pd(l.from)) : range(l.from, l.to)}<i></i>${plural(l.days, 'day')}</span>`;
  const Type = ({ l }) => html`<span className="rq3-t" style=${{ '--c': TYPE_C[l.type] || '#8E8E93' }}><${Icon} n=${typeIcon(l.type)} s=${14}/>${l.type}${l.half ? ' · half day' : ''}</span>`;

  const Card = ({ l }) => {
    const e = BY[l.emp], pend = l.state === 'pending';
    const peers = [...new Set(away.filter(a => a.emp !== e.n && BY[a.emp] && BY[a.emp].dept === e.dept && l.from <= a.to && l.to >= a.from).map(a => BY[a.emp].name.split(' ')[0]))];
    const bal = balances(all.filter(x => x.emp === e.n)).find(b => b.t === l.type);
    const hol = pend ? workDays(l.from, l.to).hol : [];
    return html`<article className=${'rq3-c' + (pend ? '' : ' done')}>
      <button className="rq3-av" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${46}/></button>
      <div className="rq3-m">
        <div className="rq3-n"><b>${e.name}</b><span>${e.dept}</span></div>
        <div className="rq3-d"><${Type} l=${l}/><${When} l=${l}/></div>
        ${pend && l.reason && html`<p className="rq3-r">${l.reason}</p>`}
        ${pend && html`<div className="rq3-i">
          ${bal && html`<span><${Icon} n="check" s=${13}/>${Math.max(bal.left - l.days, 0)} of ${bal.total} ${l.type.toLowerCase().replace(' leave', '')} days left after this</span>`}
          <span className=${peers.length ? 'warn' : ''}><${Icon} n="people" s=${13}/>${peers.length ? peers.join(' and ') + (peers.length === 1 ? ' is' : ' are') + ' also out' : 'No one else in ' + e.dept + ' is out'}</span>
          ${hol.length > 0 && html`<span><${Icon} n="calendar" s=${13}/>Skips ${hol.join(', ')}</span>`}</div>`}
      </div>
      <div className="rq3-a">${pend ? html`<button className="btn pri sm" onClick=${() => decide(l, 'approved')}><${Icon} n="check" s=${15}/> Approve</button><button className="btn ghost sm" onClick=${() => decide(l, 'declined')}>Decline</button>`
        : html`<span className="pill" style=${{ '--c': STATE_C[l.state] }}><i></i>${l.state === 'approved' ? 'Approved' : 'Declined'}</span><button className="link" onClick=${() => decide(l, 'pending')}>Undo</button>`}</div>
    </article>`;
  };

  const Tab = ({ k, label, n }) => html`<button className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${label}${n > 0 && html`<em className=${k === 'pending' ? 'hot' : ''}>${n}</em>`}</button>`;
  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="requests" tone="orange"/>Requests</h1><p>${waiting.length ? waiting.length + ' waiting for you' : 'All clear'}</p></div>
      <button className="btn sec2" onClick=${() => downloadLeaveReport(all)}><${Icon} n="download" s=${16}/> Export</button></div>
    <div className="seg rq3-seg" role="group" aria-label="Requests"><${Tab} k="pending" label="Pending" n=${waiting.length}/><${Tab} k="decided" label="Decided" n=${decided.length}/></div>
    ${list.length === 0
      ? html`<div className="rq3-e"><span><${Icon} n=${tab === 'pending' ? 'check' : 'requests'} s=${22}/></span><div><b>${tab === 'pending' ? 'You are all caught up' : 'Nothing decided yet'}</b><p>${tab === 'pending' ? 'New leave requests will show up here.' : 'Approved and declined requests will be listed here.'}</p></div></div>`
      : html`<div className="rq3-l">${list.map(l => html`<${Card} key=${l.id} l=${l}/>`)}</div>`}
  </div>`;
}
