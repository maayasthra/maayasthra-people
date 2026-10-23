import { useState } from 'react';
import React from 'react';
import { html, Icon, Av, Photo } from '../ui.jsx';
import { EMP, BY, DEMO_PW, isAdminRole } from '../data.js';
import { IS_DEMO } from '../env.js';
import { authEnabled, signIn, signUp, sendReset, setNewPassword, resolveUser, currentSession, signOutAuth } from '../auth.js';

/* ---------- Login ---------- */
export function Login({ onLogin }) {
  const [mode, setMode] = useState('employee'); const [view, setView] = useState('signin');
  const [pw2, setPw2] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const check = (em, p, md) => {
    const e = EMP.find(x => x.email === em.trim().toLowerCase());
    if (!em.trim()) return 'Enter your work email.';
    if (!e) return 'We could not find that email in the studio directory.';
    if (!p) return 'Enter your password.';
    if (p !== DEMO_PW) return 'That password does not match. Try again.';
    if (e.status === 'Exited') return 'This account is no longer active.';
    if (md === 'admin' && !isAdminRole(e)) return 'This account does not have admin access.';
    return e;
  };
  const run = (em, p, md) => {
    const r = check(em, p, md);
    if (typeof r === 'string') { setErr(r); return; }
    setErr(''); setBusy(true); setTimeout(() => onLogin(r, md === 'admin' ? 'admin' : 'employee'), 650);
  };
  const demo = (n, md) => { const e = BY[n]; setMode(md); setEmail(e.email); setPw(DEMO_PW); run(e.email, DEMO_PW, md); };
  const submit = ev => {
    ev.preventDefault(); if (busy) return;
    if (!authEnabled) { run(email, pw, mode); return; }
    if (!email.trim()) { setErr('Enter your work email.'); return; }
    if (!pw) { setErr('Enter your password.'); return; }
    setErr(''); setBusy(true);
    signIn(email, pw).then(resolveUser).then(r => {
      if (r.error) { signOutAuth(); setErr(r.error); setBusy(false); return; }
      onLogin(r.user, r.role);
    }).catch(e => { setErr(e.message); setBusy(false); });
  };
  const forgot = ev => {
    ev.preventDefault(); if (!email.trim()) { setErr('Enter your work email.'); return; } setErr('');
    if (!authEnabled) { setSent(true); return; }
    setBusy(true); sendReset(email).then(() => { setSent(true); setBusy(false); }).catch(e => { setErr(e.message); setBusy(false); });
  };
  const register = ev => {
    ev.preventDefault(); if (busy) return;
    if (!email.trim()) { setErr('Enter your work email.'); return; }
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    setErr(''); setBusy(true);
    signUp(email, pw).then(() => { setSent(true); setBusy(false); }).catch(e => { setErr(e.message); setBusy(false); });
  };
  const art = [3, 10, 6, 17, 14];
  return html`<div className="lg-wrap">
    <section className="lg-art">
      <div className="brand" style=${{ padding: 0 }}><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>
      <div className="lg-copy"><h1>Everyone at Maayasthra, in one place.</h1><p>Your team, your time off, your hours and your tasks. Sign in with your work email.</p></div>
      <div>${IS_DEMO ? html`<div className="lg-mos" aria-hidden="true">${art.map(n => html`<div key=${n}><${Photo} e=${BY[n]}/></div>`)}</div>`
        : html`<ul className="lg-feat">${[['people', 'Team directory', 'Find anyone, see who reports to whom'], ['leaves', 'Leave', 'Apply, get approved, see balances'], ['hours', 'Hours', 'Check in and out, track your day'], ['board', 'Tasks', 'One board for everything in flight']].map(([ic, t, d]) => html`<li key=${t}><span><${Icon} n=${ic} s=${18}/></span><div><b>${t}</b><small>${d}</small></div></li>`)}</ul>`}
        <div className="lg-url">people.maayasthra.com</div></div>
    </section>
    <section className="lg-form"><div className="lg-box">
      ${view === 'signin' ? html`<${React.Fragment}>
        <h2>Sign in</h2>${authEnabled && html`<p>Welcome back. Use your work email.</p>`}
        ${!authEnabled && html`<div className="seg" role="group" aria-label="Sign in as"><button type="button" className=${mode === 'employee' ? 'on' : ''} onClick=${() => { setMode('employee'); setErr(''); }}>Employee</button><button type="button" className=${mode === 'admin' ? 'on' : ''} onClick=${() => { setMode('admin'); setErr(''); }}>Admin</button></div>`}
        <form onSubmit=${submit} noValidate>
          <div className="fld"><label htmlFor="login-email">Work email</label><input id="login-email" className="inp" type="email" autoComplete="username" placeholder="name@maayasthra.com" value=${email} onChange=${ev => setEmail(ev.target.value)}/></div>
          <div className="fld"><label htmlFor="login-pw">Password</label><div className="pw"><input id="login-pw" className="inp" type=${show ? 'text' : 'password'} autoComplete="current-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
          <div className="lg-row"><button type="button" className="link" onClick=${() => { setView('forgot'); setErr(''); setSent(false); }}>Forgot password?</button></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Signing in…' : !authEnabled && mode === 'admin' ? 'Sign in as Admin' : 'Sign in'}</button>
        </form>
        ${!authEnabled && html`<div className="lg-demo"><h3>Try a demo account</h3>
          <button className="dm" onClick=${() => demo(2, 'admin')} disabled=${busy}><${Av} e=${BY[2]} s=${38}/><span className="row-t"><b>Meera Iyer</b><span>Admin · approves leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <button className="dm" onClick=${() => demo(9, 'employee')} disabled=${busy}><${Av} e=${BY[9]} s=${38}/><span className="row-t"><b>Dev Malhotra</b><span>Employee · applies for leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <div className="lg-note">Demo password: ${DEMO_PW}</div></div>`}
        ${authEnabled && html`<div className="lg-alt"><span>New to Maayasthra People?</span><button type="button" className="link" onClick=${() => { setView('signup'); setErr(''); setSent(false); setPw(''); setPw2(''); }}>Create your account</button></div>`}
      <//>` : view === 'signup' ? html`<${React.Fragment}>
        <button className="back" onClick=${() => { setView('signin'); setErr(''); setPw(''); setPw2(''); }}><${Icon} n="back" s=${16}/> Back to sign in</button>
        <h2>Create your account</h2><p>Use your work email. We will send a link to confirm it.</p>
        ${sent ? html`<div className="lg-sent" role="status"><span><${Icon} n="check" s=${20}/></span><b>Check your inbox</b><p>We sent a confirmation link to ${email.trim()}. Open it to finish, then sign in.</p></div>` : html`<form onSubmit=${register} noValidate>
          <div className="fld"><label htmlFor="su-email">Work email</label><input id="su-email" className="inp" type="email" autoComplete="username" placeholder="name@maayasthra.com" value=${email} onChange=${ev => setEmail(ev.target.value)}/></div>
          <div className="fld"><label htmlFor="su-pw">Password</label><div className="pw"><input id="su-pw" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div><small className="fld-h">At least 8 characters.</small></div>
          <div className="fld"><label htmlFor="su-pw2">Repeat password</label><input id="su-pw2" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw2} onChange=${ev => setPw2(ev.target.value)}/></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Creating…' : 'Create account'}</button>
        </form>`}
      <//>` : html`<${React.Fragment}>
        <button className="back" onClick=${() => { setView('signin'); setErr(''); }}><${Icon} n="back" s=${16}/> Back to sign in</button>
        <h2>Reset your password</h2><p>Enter your work email and we will send a reset link.</p>
        <form onSubmit=${forgot} noValidate>
          <div className="fld"><label htmlFor="reset-email">Work email</label><input id="reset-email" className="inp" type="email" placeholder="name@maayasthra.com" value=${email} onChange=${ev => { setEmail(ev.target.value); setSent(false); }}/></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit" disabled=${busy}>Send reset link</button>
          ${sent && html`<div className="lg-ok" role="status"><${Icon} n="check" s=${16}/> If that email has an account, a reset link is on its way.</div>`}
        </form><//>`}
    </div></section>
  </div>`;
}


/* ---------- Choose a password (from an invite or reset link) ---------- */
export function SetPassword({ onDone }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
  const submit = ev => {
    ev.preventDefault();
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    setErr(''); setBusy(true);
    setNewPassword(pw).then(() => currentSession()).then(sess => sess ? resolveUser(sess) : { error: 'Your link expired. Request a new one.' }).then(r => {
      if (r.error) { setErr(r.error); setBusy(false); return; }
      window.history.replaceState(null, '', window.location.pathname); onDone(r.user, r.role);
    }).catch(e => { setErr(e.message); setBusy(false); });
  };
  return html`<div className="lg-wrap" style=${{ gridTemplateColumns: 'minmax(0,1fr)' }}><section className="lg-form"><div className="lg-box">
    <div className="brand" style=${{ padding: '0 0 28px' }}><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>
    <h2>Choose a password</h2>
    <form onSubmit=${submit} noValidate>
      <div className="fld"><label htmlFor="np1">New password</label><div className="pw"><input id="np1" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
      <div className="fld"><label htmlFor="np2">Repeat it</label><input id="np2" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw2} onChange=${ev => setPw2(ev.target.value)}/></div>
      ${err && html`<div className="lg-err" role="alert">${err}</div>`}
      <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Saving…' : 'Save and continue'}</button>
    </form></div></section></div>`;
}
