import { useState, useRef, useLayoutEffect } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { activeEmps, BY } from '../data.js';

// The chart always fits the page: the tree is scaled down instead of scrolling.
export function OrgChart({ open, user }) {
  const people = activeEmps();
  const ids = new Set(people.map(e => e.n));
  const kids = n => people.filter(e => e.mgr === n).sort((a, b) => a.name.localeCompare(b.name));
  const roots = people.filter(e => !e.mgr || !ids.has(e.mgr));
  const startOpen = () => { const o = {}; roots.forEach(r => { o[r.n] = true; }); let c = user; while (c && c.mgr && BY[c.mgr]) { o[c.mgr] = true; c = BY[c.mgr]; } return o; };
  const [on, setOn] = useState(startOpen);
  const wrap = useRef(null), inner = useRef(null);
  const [fit, setFit] = useState({ s: 1, h: 'auto' });
  const all = () => { const o = {}; people.forEach(e => { o[e.n] = true; }); setOn(o); };

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrap.current, i = inner.current; if (!w || !i) return;
      const s = Math.min(1, w.clientWidth / i.offsetWidth);
      setFit(f => (Math.abs(f.s - s) < 0.001 && f.h === i.offsetHeight * s) ? f : { s, h: i.offsetHeight * s });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [on]);

  const Card = ({ e, k }) => {
    const isOn = !!on[e.n], mine = e.n === user.n;
    return html`<div className=${'ot' + (mine ? ' me' : '') + (k.length ? ' has' : '')}>
      <button className="ot-p" onClick=${() => open(e.n)} aria-label=${'Open profile of ' + e.name}><${Av} e=${e} s=${44}/><b>${e.name}</b><span>${e.role}</span></button>
      ${k.length > 0 && html`<button className=${'ot-x' + (isOn ? ' on' : '')} onClick=${() => setOn(o => ({ ...o, [e.n]: !o[e.n] }))} aria-expanded=${isOn} aria-label=${(isOn ? 'Hide ' : 'Show ') + k.length + ' reports of ' + e.name}>${k.length}<${Icon} n="next" s=${12}/></button>`}
    </div>`;
  };
  // Below the second level, teams stack vertically so the chart never grows wide.
  const Stack = ({ e }) => { const k = kids(e.n); return html`<li><${Card} e=${e} k=${k}/>${k.length > 0 && on[e.n] && html`<ul className="vl">${k.map(x => html`<${Stack} key=${x.n} e=${x}/>`)}</ul>`}</li>`; };
  const Top = ({ e }) => {
    const k = kids(e.n);
    return html`<li><${Card} e=${e} k=${k}/>${k.length > 0 && on[e.n] && html`<ul className="hz">${k.map(x => html`<${Stack} key=${x.n} e=${x}/>`)}</ul>`}</li>`;
  };
  return html`<div>
    <div className="pg-h"><div><h1>Org chart</h1><p>Click the number under a person to show their team. Click a person to open their profile.</p></div>
      <div style=${{ display: 'flex', gap: 8 }}><button className="btn ghost sm" onClick=${all}>Show everyone</button><button className="btn ghost sm" onClick=${() => setOn(startOpen())}>Reset</button></div></div>
    <div className="tree" ref=${wrap} style=${{ height: fit.h }}>
      <div className="tree-in" ref=${inner} style=${{ transform: 'translateX(-50%) scale(' + fit.s + ')' }}><ul className="top">${roots.map(r => html`<${Top} key=${r.n} e=${r}/>`)}</ul></div>
    </div>
  </div>`;
}
