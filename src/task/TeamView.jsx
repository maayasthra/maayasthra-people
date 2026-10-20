import { html, Av, Tile } from '../ui.jsx';
import { activeEmps, TODISO } from '../data.js';
import { POOL, isOpen } from '../tasks.js';

export function TeamView({ tasks, boards, onPick }) {
  const open = tasks.filter(isOpen), over = open.filter(t => t.due && t.due < TODISO);
  const pool = open.filter(t => t.cols.includes(POOL));
  const rows = activeEmps().map(e => { const ts = open.filter(t => t.cols.includes(e.n)); return { e, ts, over: ts.filter(t => t.due && t.due < TODISO) }; })
    .filter(r => r.ts.length).sort((a, b) => b.ts.length - a.ts.length || a.e.name.localeCompare(b.e.name));
  const busiest = rows[0];
  return html`<div>
    <div className="pg-h"><div><h1>Team</h1><p>Open cards per person across every board. Click a person to jump to their column.</p></div></div>
    <div className="tiles">
      <${Tile} icon="board" tone="blue" label="Open cards" value=${open.length} sub=${tasks.length - open.length + ' completed'}/>
      <${Tile} icon="bell" tone="red" hot=${over.length > 0} label="Overdue" value=${over.length} sub=${over.length ? 'need attention' : 'nothing overdue'}/>
      <${Tile} icon="flag" tone="orange" label="Priority Tasks" value=${pool.length} sub="waiting to be handed out"/>
      <${Tile} icon="people" tone="purple" label="Busiest" value=${busiest ? busiest.ts.length : 0} sub=${busiest ? busiest.e.name : ''}/>
    </div>
    <div className="card tv" style=${{ marginTop: 28, padding: '6px 18px' }}>
      <div className="tv-r tv-h" style=${{ '--n': boards.length }}><span>Person</span>${boards.map(b => html`<span key=${b.id}>${b.name}</span>`)}<span>Total</span><span>Overdue</span></div>
      ${rows.map(r => html`<button key=${r.e.n} className="tv-r row" style=${{ '--n': boards.length }} onClick=${() => onPick(r.e.n, boards.map(b => [b.id, r.ts.filter(t => t.board === b.id).length]).sort((a, b) => b[1] - a[1])[0][0])}>
        <span className="at-p"><${Av} e=${r.e} s=${34}/><span className="row-t"><b>${r.e.name}</b><span>${r.e.dept}</span></span></span>
        ${boards.map(b => { const n = r.ts.filter(t => t.board === b.id).length; return html`<span key=${b.id} className=${'tv-n' + (n ? '' : ' z')}>${n}</span>`; })}
        <span className="tv-n">${r.ts.length}</span>
        <span className=${'tv-n' + (r.over.length ? ' bad' : ' z')}>${r.over.length}</span></button>`)}
    </div>
  </div>`;
}
