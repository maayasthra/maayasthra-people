import { useState, useRef, useEffect } from 'react';
import { html, Icon } from './ui.jsx';
import { useCover, saveCover, prepareCover } from './coverDb.js';

/* The picture across the top of Home, with the date and greeting on it. Everyone can set their own (up to 2 MB); only they see it. */
export function Cover({ user, children }) {
  const img = useCover(user.n), [menu, setMenu] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const file = useRef(null), box = useRef(null), generation = useRef(0);
  useEffect(() => {
    generation.current++; setBusy(false); setErr(''); setMenu(false);
    return () => { generation.current++; };
  }, [user.n]);
  useEffect(() => {
    if (!menu) return;
    const f = ev => { if (box.current && !box.current.contains(ev.target)) setMenu(false); }, k = ev => { if (ev.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [menu]);
  const pick = async ev => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
    const started = generation.current;
    setBusy(true); setErr(''); setMenu(false);
    try {
      const image = await prepareCover(f);
      if (started !== generation.current) return;
      await saveCover(user.n, image);
    } catch (e) { if (started === generation.current) setErr(e.message); }
    finally { if (started === generation.current) setBusy(false); }
  };
  const reset = async () => {
    const started = generation.current; setBusy(true); setErr(''); setMenu(false);
    try { await saveCover(user.n, ''); } catch (e) { if (started === generation.current) setErr(e.message); }
    finally { if (started === generation.current) setBusy(false); }
  };
  return html`<section className=${'cv' + (img ? ' has' : '')} style=${img ? { '--cv': 'url("' + img + '")' } : undefined} aria-busy=${busy}>
    <div className="cv-in">${children}</div>
    ${html`<div className=${'cv-e' + (menu || busy ? ' open' : '')} ref=${box}>
      <button className="cv-b" onClick=${() => setMenu(m => !m)} aria-label="Change cover" aria-haspopup="menu" aria-expanded=${menu} disabled=${busy}><${Icon} n="edit" s=${15}/><span className="cv-l">${busy ? 'Saving…' : 'Change cover'}</span></button>
      ${menu && html`<div className="menu cv-m" role="menu">
        <button role="menuitem" onClick=${() => file.current && file.current.click()}><${Icon} n="download" s=${15}/> Upload a picture</button>
        ${img && html`<button role="menuitem" onClick=${reset}><${Icon} n="x" s=${15}/> Use the default</button>`}
        <p>JPG or PNG, up to 2 MB. Wide pictures work best. Only you see your cover.</p></div>`}
      <input ref=${file} type="file" accept="image/*" hidden onChange=${pick}/></div>`}
    ${err && html`<div className="cv-err" role="alert">${err}</div>`}
  </section>`;
}
