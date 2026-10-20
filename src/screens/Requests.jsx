import { useState } from 'react';
import { html, Icon, Av, downloadCSV } from '../ui.jsx';
import { TODISO, DAY, BY, pd, fmtDay, plural, range, workDays, balances, awayList, activeEmps, leaveTypes } from '../data.js';

export function Requests({ role, user, leaves: all, setLeaves, open }) {
  const [show, setShow] = useState('pending'); const [selKey, setSelKey] = useState(null);
  const leaves = all.filter(l => !l.past && l.emp !== user.n && (role === 'admin' || (BY[l.emp] && BY[l.emp].mgr === user.n)));
  const pendingN = leaves.filter(l => l.state === 'pending').length;
  const visible = leaves.filter(l => show === 'pending' ? l.state === 'pending' : l.state !== 'pending');
  const s = leaves.find(l => l.id === selKey) || visible[0];
  const decide = (l, state) => setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state } : x));
  const away = awayList(all);

  const exportRequests = () => downloadCSV('leave-requests.csv', [
    ['Employee', 'Employee ID', 'Department', 'Type', 'From', 'To', 'Days', 'Status', 'Reason'],
    ...all.map(l => [BY[l.emp].name, BY[l.emp].empId, BY[l.emp].dept, l.type, l.from, l.to, l.days, l.state, l.reason])]);
  const exportBalances = () => downloadCSV('leave-balances.csv', [
    ['Employee', 'Employee ID', 'Department', ...leaveTypes().flatMap(([t]) => [t + ' used', t + ' left'])],
    ...activeEmps().map(e => [e.name, e.empId, e.dept, ...balances(all.filter(l => l.emp === e.n)).flatMap(b => [b.used, b.left])])]);

  let detail = null;
  if (s) {
    const e = BY[s.emp], wd = workDays(s.from, s.to);
    const peers = away.filter(a => a.emp !== e.n && BY[a.emp] && BY[a.emp].dept === e.dept && s.from <= a.to && s.to >= a.from);
    detail = html`<aside className="card qd">
      <div className="qd-p"><button onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${44}/></button><span><b>${e.name}</b><span>${e.role}</span></span></div>
      <h2>${s.type}, ${plural(s.days, 'day')}</h2>
      <div className="facts">
        <div className="fact"><label>Dates</label><div>${fmtDay(pd(s.from))}${s.to !== s.from ? ' to ' + fmtDay(pd(s.to)) : ''}</div></div>
        <div className="fact"><label>Working days</label><div>${wd.days}${wd.hol.length ? ' · skips ' + wd.hol.join(', ') : ''}</div></div>
        <div className="fact"><label>Reason</label><div>${s.reason || 'No note added'}</div></div>
        <div className="fact"><label>In ${e.dept}</label><div>${peers.length ? [...new Set(peers.map(p => BY[p.emp].name))].join(' and ') + ' also out' : 'No one else is out'}</div></div>
      </div>
      <div className="qd-a">${s.state === 'pending'
        ? html`<button className="btn pri" onClick=${() => decide(s, 'approved')}>Approve</button><button className="btn ghost" onClick=${() => decide(s, 'declined')}>Decline</button>`
        : html`<span className="ap-done"><${Icon} n=${s.state === 'approved' ? 'check' : 'x'} s=${15}/> <b>${s.state === 'approved' ? 'Approved' : 'Declined'}</b>
            <button className="link" onClick=${() => decide(s, 'pending')}>Undo</button></span>`}</div>
    </aside>`;
  }
  return html`<div>
    <div className="pg-h"><div><h1>Requests</h1><p>${pendingN ? plural(pendingN, 'leave request') + ' waiting for a decision.' : 'You are all caught up.'}${role !== 'admin' ? ' Showing your team.' : ''}</p></div>
      <div style=${{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        ${role === 'admin' && html`<button className="btn ghost sm" onClick=${exportRequests}><${Icon} n="download" s=${15}/> Requests CSV</button><button className="btn ghost sm" onClick=${exportBalances}><${Icon} n="download" s=${15}/> Balances CSV</button>`}
        <div className="seg" style=${{ width: 220, margin: 0 }} role="group" aria-label="Show"><button className=${show === 'pending' ? 'on' : ''} onClick=${() => setShow('pending')}>Pending</button><button className=${show === 'decided' ? 'on' : ''} onClick=${() => setShow('decided')}>Decided</button></div></div></div>
    <div className="rq">
      <div>${visible.length === 0 ? html`<div className="none" style=${{ padding: '48px 0', textAlign: 'left' }}><b>${show === 'pending' ? 'Nothing is waiting' : 'No decisions yet'}</b>${show === 'pending' ? 'New leave requests will appear here.' : 'Approved and declined requests will be listed here.'}</div>` :
        visible.map(l => html`<button key=${l.id} className=${'qi' + (s && s.id === l.id ? ' sel' : '')} onClick=${() => setSelKey(l.id)}>
          <${Av} e=${BY[l.emp]} s=${40}/>
          <span className="row-t"><b>${BY[l.emp].name}</b><span>${l.type} · ${range(l.from, l.to)} · ${plural(l.days, 'day')}</span></span>
          <span className="row-d" style=${{ color: 'var(--faint)', fontSize: 12 }}>${l.sent}</span></button>`)}</div>
      ${detail}
    </div>
  </div>`;
}
