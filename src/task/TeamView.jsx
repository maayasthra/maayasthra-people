import { html, Av, Tile } from '../ui.jsx';
import { activeEmps, TODISO } from '../data.js';
import { COLS, isOpen } from '../tasks.js';

export function TeamView({ tasks, onPick }) {
  const people = activeEmps();
  const rows = people.map(e => { const ts = tasks.filter(t => t.assignee === e.n); return { e, ts, open: ts.filter(isOpen), over: ts.filter(t => isOpen(t) && t.due && t.due < TODISO) }; })
    .filter(r => r.ts.length).sort((a, b) => b.open.length - a.open.length || a.e.name.localeCompare(b.e.name));
  const open = tasks.filter(isOpen), over = open.filter(t => t.due && t.due < TODISO), unassigned = open.filter(t => !t.assignee);
  const busiest = rows[0];
  return html`<div>
    <div className="pg-h"><div><h1>Team</h1><p>Who is working on what. Click a person to see their cards on the board.</p></div></div>
    <div className="tiles">
      <${Tile} icon="board" tone="blue" label="Open tasks" value=${open.length} sub=${tasks.length - open.length + ' completed'}/>
      <${Tile} icon="bell" tone="red" hot=${over.length > 0} label="Overdue" value=${over.length} sub=${over.length ? 'need attention' : 'nothing overdue'}/>
      <${Tile} icon="clock" tone="orange" label="In review" value=${tasks.filter(t => t.status === 'review').length} sub="waiting for sign-off"/>
      <${Tile} icon="people" tone="purple" label="Unassigned" value=${unassigned.length} sub=${busiest ? 'busiest: ' + busiest.e.name.split(' ')[0] + ' (' + busiest.open.length + ')' : ''}/>
    </div>
    <div className="card tv" style=${{ marginTop: 28, padding: '6px 18px' }}>
      <div className="tv-r tv-h"><span>Person</span>${COLS.map(c => html`<span key=${c[0]}>${c[1]}</span>`)}<span>Overdue</span></div>
      ${rows.map(r => html`<button key=${r.e.n} className="tv-r row" onClick=${() => onPick(r.e.n)}>
        <span className="at-p"><${Av} e=${r.e} s=${34}/><span className="row-t"><b>${r.e.name}</b><span>${r.e.dept}</span></span></span>
        ${COLS.map(c => html`<span key=${c[0]} className=${'tv-n' + (r.ts.filter(t => t.status === c[0]).length ? '' : ' z')}>${r.ts.filter(t => t.status === c[0]).length}</span>`)}
        <span className=${'tv-n' + (r.over.length ? ' bad' : ' z')}>${r.over.length}</span></button>`)}
    </div>
  </div>`;
}
