import { useState, useMemo, useEffect, useRef } from 'react';
import { html, Icon, Av } from './ui.jsx';
import { searchPeople } from './data.js';

/* ---------- Quick search ---------- */
export function QuickSearch({ open }) {
  const [q, setQ] = useState(''); const [hi, setHi] = useState(0); const [on, setOn] = useState(false);
  const ref = useRef(null);
  const res = useMemo(() => q.trim() ? searchPeople(q).slice(0, 6) : [], [q]);
  useEffect(() => {
    const f = ev => { if (ev.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { ev.preventDefault(); ref.current && ref.current.focus(); } };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, []);
  const pick = e => { setQ(''); setOn(false); open(e.n); };
  const key = ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setHi(h => Math.min(h + 1, res.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (ev.key === 'Enter' && res[hi]) pick(res[hi]);
    else if (ev.key === 'Escape') { setOn(false); ev.target.blur(); }
  };
  return html`<div className="qs">
    <${Icon} n="search"/>
    <input ref=${ref} id="quick-search" className="qs-in" value=${q} placeholder="Search people"
      onChange=${ev => { setQ(ev.target.value); setHi(0); }} onFocus=${() => setOn(true)} onBlur=${() => setOn(false)} onKeyDown=${key} autoComplete="off" aria-label="Quick employee search"/>
    <kbd>/</kbd>
    ${on && q.trim() && html`<div className="qs-dd">
      ${res.length === 0 ? html`<div className="qs-e">No one matches "${q}".</div>` :
        res.map((e, i) => html`<button key=${e.n} className=${'qs-r' + (i === hi ? ' hi' : '')} onMouseDown=${ev => { ev.preventDefault(); pick(e); }} onMouseEnter=${() => setHi(i)}>
          <${Av} e=${e} s=${36}/><span><b>${e.name}</b><span>${e.role} · ${e.dept}</span></span></button>`)}
    </div>`}
  </div>`;
}

