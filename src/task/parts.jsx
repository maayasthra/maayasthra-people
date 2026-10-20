import { useEffect } from 'react';
import { html, Icon } from '../ui.jsx';
import { fmtDM, pd, TOD, DAY } from '../data.js';
import { PRIO, dueState } from '../tasks.js';

/* A sheet that slides in from the right (a bottom sheet on phones) */
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = ev => { if (ev.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, []);
  return html`<div className="sh-bg" onClick=${onClose}></div>
    <aside className="sh" role="dialog" aria-modal="true" aria-label=${title}>
      <header className="sh-h"><h2>${title}</h2><button className="ib" onClick=${onClose} aria-label="Close"><${Icon} n="x" s=${16}/></button></header>
      <div className="sh-b">${children}</div>
      ${footer && html`<footer className="sh-f">${footer}</footer>`}
    </aside>`;
}

export function DueChip({ due, done }) {
  const s = dueState(due, done);
  if (s === 'none') return null;
  const days = Math.round((pd(due) - TOD) / DAY);
  const text = s === 'over' ? 'Overdue · ' + Math.abs(days) + 'd' : s === 'today' ? 'Due today' : fmtDM(due);
  return html`<span className=${'kdue d-' + s}><${Icon} n="calendar" s=${12}/>${text}</span>`;
}

export const PrioFlag = ({ p }) => p && PRIO[p] ? html`<span className="kflag" style=${{ '--c': PRIO[p][1] }} title=${PRIO[p][0] + ' priority'}><${Icon} n="flag" s=${13}/></span>` : null;
