import { useState, useRef, useEffect } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { activeEmps, BY } from '../data.js';

export function OrgChart({ open, user }) {
  const people = activeEmps();
  const ids = new Set(people.map(e => e.n));
  const kids = n => people.filter(e => e.mgr === n).sort((a, b) => a.name.localeCompare(b.name));
  const roots = people.filter(e => !e.mgr || !ids.has(e.mgr));
  const startOpen = () => { const o = {}; roots.forEach(r => { o[r.n] = true; }); let c = user; while (c && c.mgr && BY[c.mgr]) { o[c.mgr] = true; c = BY[c.mgr]; } return o; };
  const [on, setOn] = useState(startOpen);
  const me = useRef(null), box = useRef(null);
  useEffect(() => { const b = box.current; if (b) b.scrollLeft = (b.scrollWidth - b.clientWidth) / 2; }, []);
  const count = n => { const k = kids(n); return k.length + k.reduce((s, x) => s + count(x.n), 0); };
  const all = () => { const o = {}; people.forEach(e => { o[e.n] = true; }); setOn(o); };

  const Node = ({ e }) => {
    const k = kids(e.n), isOn = !!on[e.n], mine = e.n === user.n;
    return html`<li>
      <div className=${'ot' + (mine ? ' me' : '') + (k.length ? ' has' : '')} ref=${mine ? me : null}>
        <button className="ot-p" onClick=${() => open(e.n)} aria-label=${'Open profile of ' + e.name}><${Av} e=${e} s=${48}/><b>${e.name}</b><span>${e.role}</span></button>
        ${k.length > 0 && html`<button className=${'ot-x' + (isOn ? ' on' : '')} onClick=${() => setOn(o => ({ ...o, [e.n]: !o[e.n] }))} aria-expanded=${isOn} aria-label=${(isOn ? 'Hide ' : 'Show ') + k.length + ' reports of ' + e.name}>${k.length}<${Icon} n="next" s=${12}/></button>`}
      </div>
      ${k.length > 0 && isOn && html`<ul>${k.map(x => html`<${Node} key=${x.n} e=${x}/>`)}</ul>`}
    </li>`;
  };
  return html`<div>
    <div className="pg-h"><div><h1>Org chart</h1><p>Click the number under a person to show their team. Click a person to open their profile.</p></div>
      <div style=${{ display: 'flex', gap: 8 }}><button className="btn ghost sm" onClick=${all}>Show everyone</button><button className="btn ghost sm" onClick=${() => setOn(startOpen())}>Reset</button></div></div>
    <div className="tree" ref=${box}><ul>${roots.map(r => html`<${Node} key=${r.n} e=${r}/>`)}</ul></div>
  </div>`;
}
