import { html, Av, Tile } from '../ui.jsx';
import { activeEmps, TODISO } from '../data.js';
import { isOpen } from '../tasks.js';

export function TeamView({ tasks, onPick }) {
  const open = tasks.filter(isOpen), done = tasks.filter(t => t.done), over = open.filter(t => t.due && t.due < TODISO);
  const rows = activeEmps().map(e => ({ e, open: open.filter(t => t.cols.includes(e.n)), done: done.filter(t => (t.prev || []).includes(e.n)) }))
    .map(r => ({ ...r, over: r.open.filter(t => t.due && t.due < TODISO) })).filter(r => r.open.length || r.done.length)
    .sort((a, b) => b.open.length - a.open.length || a.e.name.localeCompare(b.e.name));
  return html`<div>
    <div className="pg-h"><div><h1>Team</h1><p>Open and completed cards per person. Click a person to jump to their column.</p></div></div>
    <div className="tiles">
      <${Tile} icon="board" tone="blue" label="Open cards" value=${open.length} sub="across the board"/>
      <${Tile} icon="flag" tone="orange" label="Priority Tasks" value=${open.filter(t => t.cols.includes('priority')).length} sub="waiting to be handed out"/>
      <${Tile} icon="clock" tone="purple" label="Retainer Tasks" value=${open.filter(t => t.cols.includes('retainer')).length} sub="waiting to be handed out"/>
      <${Tile} icon="check" tone="green" label="Completed" value=${done.length} sub=${over.length ? over.length + ' open and overdue' : 'nothing overdue'}/>
    </div>
    <div className="card tv" style=${{ marginTop: 28, padding: '6px 18px' }}>
      <div className="tv-r tv-h" style=${{ '--n': 3 }}><span>Person</span><span>Open</span><span>Completed</span><span>Overdue</span></div>
      ${rows.map(r => html`<button key=${r.e.n} className="tv-r row" style=${{ '--n': 3 }} onClick=${() => onPick(r.e.n)}>
        <span className="at-p"><${Av} e=${r.e} s=${34}/><span className="row-t"><b>${r.e.name}</b><span>${r.e.dept}</span></span></span>
        <span className=${'tv-n' + (r.open.length ? '' : ' z')}>${r.open.length}</span>
        <span className=${'tv-n' + (r.done.length ? '' : ' z')}>${r.done.length}</span>
        <span className=${'tv-n' + (r.over.length ? ' bad' : ' z')}>${r.over.length}</span></button>`)}
    </div>
  </div>`;
}
