import { useState } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { activeEmps } from '../data.js';

export function OrgChart({ open, user }) {
  const people = activeEmps();
  const kids = n => people.filter(e => e.mgr === n).sort((a, b) => a.name.localeCompare(b.name));
  const ids = new Set(people.map(e => e.n));
  const roots = people.filter(e => !e.mgr || !ids.has(e.mgr));
  const [open_, setOpen] = useState(() => { const o = {}; roots.forEach(r => { o[r.n] = true; }); return o; });
  const count = n => { const k = kids(n); return k.length + k.reduce((s, x) => s + count(x.n), 0); };
  const all = () => { const o = {}; people.forEach(e => { o[e.n] = true; }); setOpen(o); };
  const Node = ({ e }) => {
    const k = kids(e.n), on = !!open_[e.n];
    return html`<li>
      <div className=${'oc-n' + (e.n === user.n ? ' me' : '')}>
        ${k.length > 0 ? html`<button className="oc-t" onClick=${() => setOpen(o => ({ ...o, [e.n]: !o[e.n] }))} aria-expanded=${on} aria-label=${(on ? 'Collapse ' : 'Expand ') + e.name}><${Icon} n="next" s=${14}/></button>` : html`<span className="oc-t"></span>`}
        <button className="oc-p" onClick=${() => open(e.n)}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role}${k.length ? ' · ' + count(e.n) + ' in team' : ''}</span></span></button>
      </div>
      ${k.length > 0 && on && html`<ul>${k.map(x => html`<${Node} key=${x.n} e=${x}/>`)}</ul>`}
    </li>`;
  };
  return html`<div>
    <div className="pg-h"><div><h1>Org chart</h1><p>Who reports to whom across the studio.</p></div>
      <div style=${{ display: 'flex', gap: 8 }}><button className="btn ghost sm" onClick=${all}>Expand all</button><button className="btn ghost sm" onClick=${() => { const o = {}; roots.forEach(r => { o[r.n] = true; }); setOpen(o); }}>Collapse</button></div></div>
    <ul className="oc root">${roots.map(r => html`<${Node} key=${r.n} e=${r}/>`)}</ul>
  </div>`;
}
