import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { html, Icon } from './ui.jsx';

/* A date field in the portal's own style. Value and min are ISO text (yyyy-mm-dd); onChange gets the new ISO text. */
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
const parts = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
const show = v => { const p = parts(v); return p ? String(p.d).padStart(2, '0') + ' ' + MON[p.m].slice(0, 3) + ' ' + p.y : ''; };

export function DateField({ id, value, onChange, min, max, placeholder = 'Pick a date' }) {
  const [open, setOpen] = useState(false), [pos, setPos] = useState(null);
  const base = parts(value) || parts(min) || (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: 1 }; })();
  const [view, setView] = useState({ y: base.y, m: base.m });
  const btn = useRef(null), pop = useRef(null);
  const today = (() => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); })();

  const place = () => {
    const r = btn.current.getBoundingClientRect(), w = 300, h = 360;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    const top = r.bottom + 6 + h > window.innerHeight && r.top - h - 6 > 8 ? r.top - h - 6 : r.bottom + 6;
    setPos({ left, top, width: w });
  };
  const openIt = () => { const p = parts(value) || parts(min); if (p) setView({ y: p.y, m: p.m }); place(); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const down = ev => { if (!(pop.current && pop.current.contains(ev.target)) && !(btn.current && btn.current.contains(ev.target))) setOpen(false); };
    const key = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); setOpen(false); btn.current && btn.current.focus(); } };
    const move = () => place();
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true);
    window.addEventListener('resize', move); window.addEventListener('scroll', move, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', move); window.removeEventListener('scroll', move, true); };
  }, [open]);

  const go = n => setView(v => { const t = v.y * 12 + v.m + n; return { y: Math.floor(t / 12), m: t % 12 }; });
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay(), len = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  const years = []; for (let y = new Date().getFullYear() + 5; y >= 1940; y--) years.push(y);
  const bad = d => (min && d < min) || (max && d > max);
  const pick = d => { onChange(d); setOpen(false); btn.current && btn.current.focus(); };

  return html`<span className="df">
    <button type="button" id=${id} ref=${btn} className=${'inp df-b' + (value ? '' : ' empty')} aria-haspopup="dialog" aria-expanded=${open} onClick=${() => open ? setOpen(false) : openIt()}>
      <span>${value ? show(value) : placeholder}</span><${Icon} n="calendar" s=${17}/>
    </button>
    ${open && pos && createPortal(html`<div ref=${pop} className="df-p" role="dialog" aria-label="Choose a date" style=${{ left: pos.left, top: pos.top, width: pos.width }}>
      <div className="df-h">
        <button type="button" className="ib" onClick=${() => go(-1)} aria-label="Previous month"><${Icon} n="chevL" s=${15}/></button>
        <select className="df-s" value=${view.m} onChange=${ev => setView(v => ({ ...v, m: +ev.target.value }))} aria-label="Month">${MON.map((n, i) => html`<option key=${n} value=${i}>${n}</option>`)}</select>
        <select className="df-s" value=${view.y} onChange=${ev => setView(v => ({ ...v, y: +ev.target.value }))} aria-label="Year">${years.map(y => html`<option key=${y} value=${y}>${y}</option>`)}</select>
        <button type="button" className="ib" onClick=${() => go(1)} aria-label="Next month"><${Icon} n="chevR" s=${15}/></button>
      </div>
      <div className="df-w">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => html`<span key=${i}>${d}</span>`)}</div>
      <div className="df-g">${cells.map((d, i) => { if (!d) return html`<span key=${'e' + i}></span>`; const v = iso(view.y, view.m, d);
        return html`<button type="button" key=${v} disabled=${bad(v)} className=${'df-d' + (v === value ? ' on' : '') + (v === today ? ' td' : '')} aria-pressed=${v === value} onClick=${() => pick(v)}>${d}</button>`; })}</div>
      <div className="df-f"><button type="button" className="link" disabled=${bad(today)} onClick=${() => pick(today)}>Today</button>${value && html`<button type="button" className="link" onClick=${() => pick('')}>Clear</button>`}</div>
    </div>`, document.body)}
  </span>`;
}
