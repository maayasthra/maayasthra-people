import { html, Icon, Av, HI } from '../ui.jsx';
import { downloadLeaveReport } from '../report.js';
import { BY, pd, fmtDay, plural, range, workDays, awayList } from '../data.js';
import { typeIcon } from './Home.jsx';

const LS_C = { pending: '#FF9F0A', approved: '#30D158', declined: '#FF453A' };

export function Requests({ user, leaves: all, setLeaves, open }) {
  const leaves = all.filter(l => !l.past && l.emp !== user.n);
  const waiting = leaves.filter(l => l.state === 'pending');
  const decided = leaves.filter(l => l.state !== 'pending');
  const away = awayList(all);
  const decide = (l, state) => setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state } : x));

  const Row = ({ l }) => {
    const e = BY[l.emp], wd = workDays(l.from, l.to);
    const peers = [...new Set(away.filter(a => a.emp !== e.n && BY[a.emp] && BY[a.emp].dept === e.dept && l.from <= a.to && l.to >= a.from).map(a => BY[a.emp].name))];
    const pend = l.state === 'pending';
    return html`<article className=${'rr' + (pend ? '' : ' done')}>
      <button onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${44}/></button>
      <div className="rr-m">
        <div className="rr-t"><b>${e.name}</b><span>${e.dept}</span></div>
        <div className="rr-d"><${Icon} n=${typeIcon(l.type)} s=${15}/> ${l.type} · ${range(l.from, l.to)} · ${plural(l.days, 'day')}</div>
        ${pend && html`<p>${l.reason || 'No note added.'}</p>
          <small>${wd.hol.length ? 'Skips ' + wd.hol.join(', ') + '. ' : ''}${peers.length ? peers.join(' and ') + ' in ' + e.dept + (peers.length === 1 ? ' is' : ' are') + ' also out.' : 'No one else in ' + e.dept + ' is out.'}</small>`}
      </div>
      <div className="rr-a">${pend ? html`<button className="btn pri sm" onClick=${() => decide(l, 'approved')}>Approve</button><button className="btn ghost sm" onClick=${() => decide(l, 'declined')}>Decline</button>`
        : html`<span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state === 'approved' ? 'Approved' : 'Declined'}</span><button className="link" onClick=${() => decide(l, 'pending')}>Undo</button>`}</div>
    </article>`;
  };

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="requests" tone="orange"/>Requests</h1><p>${waiting.length ? waiting.length + ' waiting' : 'All clear'}</p></div>
      <button className="btn sec2 sq" title="Download report" aria-label="Download report" onClick=${() => downloadLeaveReport(all)}><${Icon} n="download" s=${16}/></button></div>
    <section className="rq1">
      <div className="sec-h"><h2>Pending</h2><span>${waiting.length}</span></div>
      ${waiting.length === 0 ? html`<div className="pn-e card" style=${{ padding: '40px 20px' }}><span className="pn-ei"><${Icon} n="check" s=${22}/></span><b>All clear</b></div>`
        : html`<div className="card" style=${{ padding: '4px 22px' }}>${waiting.map(l => html`<${Row} key=${l.id} l=${l}/>`)}</div>`}
    </section>
    ${decided.length > 0 && html`<section className="rq1" style=${{ marginTop: 48 }}>
      <div className="sec-h"><h2>Decided</h2><span>${decided.length}</span></div>
      <div className="card" style=${{ padding: '4px 22px' }}>${decided.map(l => html`<${Row} key=${l.id} l=${l}/>`)}</div></section>`}
  </div>`;
}
