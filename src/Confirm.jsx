import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { html, Icon } from './ui.jsx';

/* A second look before something important happens. Used for actions that affect other people or cannot easily be undone.
     const [confirmEl, ask] = useConfirm();            // render ${confirmEl} somewhere in the component
     if (await ask({ title, body, quote, items, icon, confirm, danger })) { ...do it... }
   items are short facts the person should see first: { tone: 'ok' | 'warn' | 'bad', text }. Any warning or problem puts the
   focus on Cancel, so a stray Enter never confirms something risky. Escape or a click outside cancels. */
export function useConfirm() {
  const [st, setSt] = useState(null);
  const ask = useCallback(opts => new Promise(resolve => setSt({ opts, resolve })), []);
  const close = ok => { if (st) { st.resolve(ok); setSt(null); } };
  return [st ? html`<${ConfirmDialog} opts=${st.opts} onClose=${close}/>` : null, ask];
}

const TONE_ICON = { ok: 'check', warn: 'alert', bad: 'alert' };

function ConfirmDialog({ opts, onClose }) {
  const { title, body, quote, items = [], icon, confirm = 'Confirm', cancel = 'Cancel', danger = false } = opts;
  const risky = danger || items.some(i => i.tone === 'warn' || i.tone === 'bad'), cancelRef = useRef(null), okRef = useRef(null), box = useRef(null);
  const tone = items.some(i => i.tone === 'bad') || danger ? 'bad' : items.some(i => i.tone === 'warn') ? 'warn' : 'ok';
  useEffect(() => { (risky ? cancelRef : okRef).current && (risky ? cancelRef : okRef).current.focus(); }, []);
  useEffect(() => {
    const k = ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); onClose(false); return; }
      if (ev.key === 'Tab' && box.current) {      // keep the focus inside the dialog
        const f = [...box.current.querySelectorAll('button:not(:disabled)')]; if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  return createPortal(html`<div className="dlg-bg" onClick=${() => onClose(false)}></div>
    <div className="dlg cf" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" ref=${box}>
      <div className=${'dlg-i cf-i ' + tone}><${Icon} n=${icon || (tone === 'ok' ? 'check' : 'alert')} s=${22}/></div>
      <h2 id="cf-t">${title}</h2>
      ${body && html`<p className="cf-b">${body}</p>`}
      ${quote && html`<blockquote className="cf-q">${quote}</blockquote>`}
      ${items.length > 0 && html`<ul className="cf-l">${items.map((i, n) => html`<li key=${n} className=${i.tone || 'ok'}><${Icon} n=${TONE_ICON[i.tone || 'ok']} s=${16}/><span>${i.text}</span></li>`)}</ul>`}
      <div className="dlg-a"><button className="btn ghost" ref=${cancelRef} onClick=${() => onClose(false)}>${cancel}</button><button className=${'btn ' + (danger ? 'danger' : 'pri')} ref=${okRef} onClick=${() => onClose(true)}>${confirm}</button></div>
    </div>`, document.body);
}
