import { useState, useRef, useEffect } from 'react';
import { html, Icon } from './ui.jsx';
import { useCover, saveCover, prepareCover } from './coverDb.js';

/* The picture across the top of Home, with the date and greeting on it. Admins get a small button to change it. */
export function Cover({ canEdit, children }) {
  const img = useCover(), [menu, setMenu] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const file = useRef(null), box = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const f = ev => { if (box.current && !box.current.contains(ev.target)) setMenu(false); }, k = ev => { if (ev.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [menu]);
  const pick = async ev => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
    setBusy(true); setErr(''); setMenu(false);
    try { await saveCover(await prepareCover(f)); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const reset = async () => { setBusy(true); setErr(''); setMenu(false); try { await saveCover(''); } catch (e) { setErr(e.message); } setBusy(false); };
  return html`<section className=${'cv' + (img ? ' has' : '')} style=${img ? { '--cv': 'url("' + img + '")' } : undefined} aria-busy=${busy}>
    <div className="cv-in">${children}</div>
    ${canEdit && html`<div className="cv-e" ref=${box}>
      <button className="cv-b" onClick=${() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded=${menu} disabled=${busy}><${Icon} n="edit" s=${15}/>${busy ? 'Saving…' : 'Change cover'}</button>
      ${menu && html`<div className="menu cv-m" role="menu">
        <button role="menuitem" onClick=${() => file.current && file.current.click()}><${Icon} n="download" s=${15}/> Upload a picture</button>
        ${img && html`<button role="menuitem" onClick=${reset}><${Icon} n="x" s=${15}/> Use the default</button>`}
        <p>Wide pictures work best, at least 1600 px across. Everyone sees the same cover.</p></div>`}
      <input ref=${file} type="file" accept="image/*" hidden onChange=${pick}/></div>`}
    ${err && html`<div className="cv-err" role="alert">${err}</div>`}
  </section>`;
}
