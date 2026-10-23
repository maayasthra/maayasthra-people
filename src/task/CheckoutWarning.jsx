import { useEffect } from 'react';
import { html, Icon } from '../ui.jsx';
import { useNow } from '../attendance.js';
import { spentMs, fmtDur } from '../tasks.js';

// Shown when someone checks out while a task timer is still running
export function CheckoutWarning({ running, me, onConfirm, onCancel }) {
  const now = useNow(1000);
  useEffect(() => { const k = ev => { if (ev.key === 'Escape') onCancel(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const many = running.length > 1;
  return html`<div className="dlg-bg" onClick=${onCancel}></div>
    <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
      <div className="dlg-i"><${Icon} n="timer" s=${22}/></div>
      <h2 id="dlg-t">${many ? 'You have ' + running.length + ' running tasks' : 'You have a running task'}</h2>
      <p>Checking out will stop ${many ? 'these timers' : 'this timer'} and log the time so far.</p>
      <div className="dlg-l">${running.map(t => html`<div className="dlg-r" key=${t.id}><span className="row-t"><b>${t.title}</b>${t.client && html`<span>${t.client}</span>`}</span><span className="dlg-t"><i></i>${fmtDur(spentMs(t, now, me), true)}</span></div>`)}</div>
      <div className="dlg-a"><button className="btn ghost" onClick=${onCancel}>Keep working</button><button className="btn pri" autoFocus onClick=${onConfirm}>Stop and check out</button></div>
    </div>`;
}
