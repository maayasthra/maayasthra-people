import { useState } from 'react';
import React from 'react';
import { html, Icon, Av, Photo } from '../ui.jsx';
import { EMP, BY, DEMO_PW, isAdminRole } from '../data.js';

/* ---------- Login ---------- */
export function Login({ onLogin }) {
  const [mode, setMode] = useState('employee'); const [view, setView] = useState('signin');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const check = (em, p, md) => {
    const e = EMP.find(x => x.email === em.trim().toLowerCase());
    if (!em.trim()) return 'Enter your work email.';
    if (!e) return 'We could not find that email in the studio directory.';
    if (!p) return 'Enter your password.';
    if (p !== DEMO_PW) return 'That password does not match. Try again.';
    if (e.status === 'Exited') return 'This account is no longer active.';
    if (md === 'admin' && !isAdminRole(e)) return 'This account does not have HR or admin access.';
    return e;
  };
  const run = (em, p, md) => {
    const r = check(em, p, md);
    if (typeof r === 'string') { setErr(r); return; }
    setErr(''); setBusy(true); setTimeout(() => onLogin(r, md === 'admin' ? 'admin' : 'employee'), 650);
  };
  const demo = (n, md) => { const e = BY[n]; setMode(md); setEmail(e.email); setPw(DEMO_PW); run(e.email, DEMO_PW, md); };
  const submit = ev => { ev.preventDefault(); if (!busy) run(email, pw, mode); };
  const forgot = ev => { ev.preventDefault(); if (!email.trim()) { setErr('Enter your work email.'); return; } setErr(''); setSent(true); };
  const art = [3, 10, 6, 17, 14];
  return html`<div className="lg-wrap">
    <section className="lg-art">
      <div className="brand" style=${{ padding: 0 }}><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>
      <div className="lg-copy"><h1>Everyone at Maayasthra, in one place.</h1><p>Find a colleague, see who is away, and manage your time off from one quiet workspace.</p></div>
      <div><div className="lg-mos" aria-hidden="true">${art.map(n => html`<div key=${n}><${Photo} e=${BY[n]}/></div>`)}</div><div className="lg-url" style=${{ marginTop: 28 }}>people.maayasthra.com</div></div>
    </section>
    <section className="lg-form"><div className="lg-box">
      ${view === 'signin' ? html`<${React.Fragment}>
        <h2>Sign in</h2><p>Use your Maayasthra work email.</p>
        <div className="seg" role="group" aria-label="Sign in as"><button type="button" className=${mode === 'employee' ? 'on' : ''} onClick=${() => { setMode('employee'); setErr(''); }}>Employee</button><button type="button" className=${mode === 'admin' ? 'on' : ''} onClick=${() => { setMode('admin'); setErr(''); }}>HR and Admin</button></div>
        <form onSubmit=${submit} noValidate>
          <div className="fld"><label htmlFor="login-email">Work email</label><input id="login-email" className="inp" type="email" autoComplete="username" placeholder="name@maayasthra.com" value=${email} onChange=${ev => setEmail(ev.target.value)}/></div>
          <div className="fld"><label htmlFor="login-pw">Password</label><div className="pw"><input id="login-pw" className="inp" type=${show ? 'text' : 'password'} autoComplete="current-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
          <div className="lg-row"><button type="button" className="link" onClick=${() => { setView('forgot'); setErr(''); setSent(false); }}>Forgot password?</button></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Signing in' : mode === 'admin' ? 'Sign in as HR or Admin' : 'Sign in'}</button>
        </form>
        <div className="lg-demo"><h3>Try a demo account</h3>
          <button className="dm" onClick=${() => demo(2, 'admin')} disabled=${busy}><${Av} e=${BY[2]} s=${38}/><span className="row-t"><b>Meera Iyer</b><span>HR and Admin · approves leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <button className="dm" onClick=${() => demo(3, 'employee')} disabled=${busy}><${Av} e=${BY[3]} s=${38}/><span className="row-t"><b>Rohan Kapoor</b><span>Manager · approves for his team</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <button className="dm" onClick=${() => demo(9, 'employee')} disabled=${busy}><${Av} e=${BY[9]} s=${38}/><span className="row-t"><b>Dev Malhotra</b><span>Employee · applies for leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <div className="lg-note">Prototype only. The demo password is ${DEMO_PW}.</div></div>
      <//>` : html`<${React.Fragment}>
        <button className="back" onClick=${() => { setView('signin'); setErr(''); }}><${Icon} n="back" s=${16}/> Back to sign in</button>
        <h2>Reset your password</h2><p>Enter your work email and we will send a reset link.</p>
        <form onSubmit=${forgot} noValidate>
          <div className="fld"><label htmlFor="reset-email">Work email</label><input id="reset-email" className="inp" type="email" placeholder="name@maayasthra.com" value=${email} onChange=${ev => { setEmail(ev.target.value); setSent(false); }}/></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit">Send reset link</button>
          ${sent && html`<div className="lg-ok" role="status"><${Icon} n="check" s=${16}/> If that email is in the directory, a reset link is on its way. This prototype does not send email.</div>`}
        </form><//>`}
    </div></section>
  </div>`;
}

