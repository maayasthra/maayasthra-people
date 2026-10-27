import { useState, useEffect, useRef } from 'react';
import { html, Icon } from '../ui.jsx';
import { authEnabled, changePassword } from '../auth.js';

// Change your own password while signed in. Forgot it? Use "Forgot password?" on the sign-in screen.
export function ChangePassword({ user, onClose }) {
  const [cur, setCur] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [show, setShow] = useState(false);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const first = useRef(null);
  useEffect(() => { if (first.current) first.current.focus(); const k = ev => { if (ev.key === 'Escape' && !busy) onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [busy]);
  const submit = async ev => {
    ev.preventDefault(); if (busy) return;
    if (!authEnabled) { setErr('Demo accounts share one password, so it cannot be changed here.'); return; }
    if (!cur) { setErr('Enter your current password.'); return; }
    if (pw.length < 8) { setErr('Use at least 8 characters for the new password.'); return; }
    if (pw !== pw2) { setErr('The two new passwords do not match.'); return; }
    if (pw === cur) { setErr('Choose a password you have not used just now.'); return; }
    setErr(''); setBusy(true);
    try { await changePassword(user.email, cur, pw); setDone(true); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const type = show ? 'text' : 'password';
  return html`<div className="dlg-bg" onClick=${() => !busy && onClose()}></div>
    <div className="dlg cp" role="dialog" aria-modal="true" aria-labelledby="cp-t">
      ${done ? html`<div className="dlg-i"><${Icon} n="check" s=${22}/></div><h2 id="cp-t">Password changed</h2><p>Use your new password the next time you sign in.</p><div className="dlg-a"><button className="btn pri" autoFocus onClick=${onClose}>Done</button></div>`
      : html`<div className="dlg-i"><${Icon} n="lock" s=${22}/></div><h2 id="cp-t">Change password</h2><p>Enter your current password, then choose a new one.</p>
        <form onSubmit=${submit} noValidate>
          <div className="fld"><label htmlFor="cp-cur">Current password</label><input id="cp-cur" ref=${first} className="inp" type=${type} autoComplete="current-password" value=${cur} onChange=${ev => { setCur(ev.target.value); setErr(''); }}/></div>
          <div className="fld"><label htmlFor="cp-new">New password</label><input id="cp-new" className="inp" type=${type} autoComplete="new-password" value=${pw} onChange=${ev => { setPw(ev.target.value); setErr(''); }}/><small className="fld-h">At least 8 characters.</small></div>
          <div className="fld"><label htmlFor="cp-new2">Repeat new password</label><input id="cp-new2" className="inp" type=${type} autoComplete="new-password" value=${pw2} onChange=${ev => { setPw2(ev.target.value); setErr(''); }}/></div>
          <label className="cp-show"><input type="checkbox" checked=${show} onChange=${ev => setShow(ev.target.checked)}/> Show passwords</label>
          ${err && html`<div className="eod-e" role="alert">${err}</div>`}
          <div className="dlg-a"><button type="button" className="btn ghost" disabled=${busy} onClick=${onClose}>Cancel</button><button type="submit" className="btn pri" disabled=${busy}>${busy ? 'Saving…' : 'Change password'}</button></div>
        </form>`}
    </div>`;
}
