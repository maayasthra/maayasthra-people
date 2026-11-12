import { useRef, useEffect, useState } from 'react';
import { html, Icon } from './ui.jsx';
import { fmt } from './data.js';

// A new announcement, shown over everything until the person closes it
export function AnnouncementAlert({ a, count, perm, askPerm, onClose }) {
  const btn = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const acknowledge = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onClose(); } catch (e) { setError(e.message || 'Could not acknowledge. Please try again.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (btn.current) btn.current.focus(); }, [a.id]);
  return html`<div className="dlg-bg al-bg"></div>
    <div className="dlg al" role="alertdialog" aria-modal="true" aria-labelledby="al-t" aria-describedby="al-b">
      <div className="al-top"><span className="al-bell"><${Icon} n="bell" s=${22}/></span><span className="al-k">New announcement${count > 1 ? ' · 1 of ' + count : ''}</span></div>
      <h2 id="al-t">${a.title}</h2>
      ${a.body && html`<p id="al-b" className="al-body">${a.body}</p>`}
      <small className="al-m">Posted by ${a.by} · ${fmt(a.date)}</small>
      ${perm === 'default' && html`<div className="al-p"><span>Get a desktop alert when this page is in the background.</span><button className="btn sec2 sm" onClick=${askPerm}>Turn on alerts</button></div>`}
      ${error && html`<p role="alert">${error}</p>`}
      <div className="dlg-a"><button ref=${btn} className="btn pri" disabled=${busy} onClick=${acknowledge}>${count > 1 ? 'Got it, next' : 'Got it'}</button></div>
    </div>`;
}
