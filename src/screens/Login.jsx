import { useState, useEffect } from 'react';
import React from 'react';
import { html, Icon, Av, Photo, Logo } from '../ui.jsx';
import { ThemeSwitch } from '../ThemeSwitch.jsx';
import { EMP, BY, DEMO_PW, isAdminRole, ROLEMAP } from '../data.js';
import { IS_DEMO } from '../env.js';
import { authEnabled, signIn, signUp, sendReset, verifyResetCode, endResetFlow, setNewPassword, resolveUser, currentSession, signOutAuth } from '../auth.js';

/* ---------- Login ---------- */
// Illustrated portraits for the sign-in art. They are drawings, not staff records.
const FACES = [[3, 'm'], [10, 'f'], [6, 'f'], [17, 'm'], [14, 'f']].map(([n, g]) => ({ n, g, name: 'Illustrated portrait', photo: '' }));
export function Login({ onLogin }) {
  const [mode, setMode] = useState('employee'); const [view, setView] = useState('signin');
  const [pw2, setPw2] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  // Forgot password: step 'email' asks for the address, step 'code' takes the emailed 6-digit code and a new password
  const [step, setStep] = useState('email'), [code, setCode] = useState(''), [verified, setVerified] = useState(false), [cool, setCool] = useState(0), [done, setDone] = useState(false);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(c => c - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const check = (em, p, md) => {
    const e = EMP.find(x => x.email === em.trim().toLowerCase());
    if (!em.trim()) return 'Enter your work email.';
    if (!e) return 'We could not find that email in the studio directory.';
    if (!p) return 'Enter your password.';
    if (p !== DEMO_PW) return 'That password does not match. Try again.';
    if (e.status === 'Exited') return 'This account is no longer active.';
    if (md === 'admin' && !isAdminRole(e)) return 'This account does not have admin access.';
    if (md === 'pm' && ROLEMAP[e.n] !== 'Project manager') return 'This account is not a project manager.';
    return e;
  };
  const run = (em, p, md) => {
    const r = check(em, p, md);
    if (typeof r === 'string') { setErr(r); return; }
    setErr(''); setBusy(true); setTimeout(() => onLogin(r, md === 'admin' ? 'admin' : md === 'pm' ? 'pm' : 'employee'), 650);
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
  // Send (or send again) the code
  const sendCode = ev => {
    if (ev) ev.preventDefault(); if (busy || cool > 0) return;
    if (!email.trim()) { setErr('Enter your work email.'); return; } setErr('');
    const next = () => { setStep('code'); setCode(''); setPw(''); setPw2(''); setVerified(false); setCool(45); setBusy(false); };
    if (!authEnabled) { next(); return; }
    setBusy(true); sendReset(email).then(next).catch(e => { setErr(e.message); setBusy(false); });
  };
  const resetWithCode = ev => {
    ev.preventDefault(); if (busy) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) { setErr('Enter the 6-digit code from the email.'); return; }
    if (pw.length < 8) { setErr('Use at least 8 characters for the new password.'); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    setErr('');
    if (!authEnabled) { if (digits !== '123456') { setErr('That code is wrong. In this demo it is 123456.'); return; } setDone(true); return; }
    setBusy(true);
    // The code works once, so if choosing the password fails (too weak, say) it is not asked for again
    (verified ? Promise.resolve() : verifyResetCode(email, digits).then(() => setVerified(true)))
      .then(() => setNewPassword(pw)).then(() => currentSession()).then(sess => sess ? resolveUser(sess) : { error: 'Your password was changed. Please sign in.' })
      .then(r => { if (r.error) { signOutAuth(); setErr(r.error); setBusy(false); setDone(true); return; } onLogin(r.user, r.role); })
      .catch(e => { setErr(e.message); setBusy(false); })
      .finally(endResetFlow);
  };
  const register = ev => {
    ev.preventDefault(); if (busy) return;
    if (!email.trim()) { setErr('Enter your work email.'); return; }
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    setErr(''); setBusy(true);
    signUp(email, pw).then(() => { setSent(true); setBusy(false); }).catch(e => { setErr(e.message); setBusy(false); });
  };
  return html`<div className="lx">
    <section className="lx-art">
      <i className="lx-orb a" aria-hidden="true"></i><i className="lx-orb b" aria-hidden="true"></i><i className="lx-orb c" aria-hidden="true"></i>
      <div className="lx-top"><${Logo} w=${168} h=${50}/></div>
      <div className="lx-hero">
        <span className="lx-eyebrow"><i></i>Your workspace</span>
        <h1>Everything your team needs, <em>in one place.</em></h1>
        <p>Leave, attendance, tasks and announcements for everyone at Maayasthra. Sign in with your work email.</p>
        <ul className="lx-feats">
          <li><span><${Icon} n="attendance" s=${18}/></span><div><b>Time and leave</b><small>Check in, apply for leave and see your hours.</small></div></li>
          <li><span><${Icon} n="board" s=${18}/></span><div><b>Tasks that stay clear</b><small>A shared board, your own list and a quick end-of-day report.</small></div></li>
          <li><span><${Icon} n="megaphone" s=${18}/></span><div><b>Nothing gets missed</b><small>Announcements and reminders reach everyone.</small></div></li>
        </ul>
      </div>
      <div className="lx-stage" aria-hidden="true">
        <div className="lx-gc lx-today"><div className="lx-gh"><b>Today</b><span><i></i>Checked in</span></div><div className="lx-big">6h 42m</div><div className="lx-bar"><i></i></div><small>Shift 10:00 AM – 6:00 PM</small></div>
        <div className="lx-gc lx-leave"><span className="lx-ok"><${Icon} n="check" s=${14}/></span><div><b>Leave approved</b><small>28 – 30 Oct · 3 days</small></div></div>
        <div className="lx-gc lx-tasks"><div className="lx-gh"><b>My tasks</b><small>5 of 8</small></div><p className="done"><i></i>Festive ad creatives</p><p className="done"><i></i>Brand asset requests</p><p><i></i>Quarterly strategy note</p></div>
        <div className="lx-faces">${FACES.map(f => html`<span key=${f.n}><${Av} e=${f} s=${34}/></span>`)}<small>Join your teammates</small></div>
      </div>
      <div className="lx-foot">people.maayasthra.com</div>
    </section>
    <section className="lx-main"><div className="th-fix"><${ThemeSwitch}/></div><div className="lx-card lg-box">
      <div className="lx-mlogo"><${Logo} w=${150} h=${45}/></div>
      ${view === 'signin' ? html`<${React.Fragment}>
        <h2>Welcome back</h2><p>Sign in with your work email to pick up where you left off.</p>
        ${!authEnabled && html`<div className="seg" role="group" aria-label="Sign in as"><button type="button" className=${mode === 'employee' ? 'on' : ''} onClick=${() => { setMode('employee'); setErr(''); }}>Employee</button><button type="button" className=${mode === 'admin' ? 'on' : ''} onClick=${() => { setMode('admin'); setErr(''); }}>Admin</button></div>`}
        <form onSubmit=${submit} noValidate>
          <div className="fld"><label htmlFor="login-email">Work email</label><div className="lx-in"><${Icon} n="user" s=${17}/><input id="login-email" className="inp" type="email" autoComplete="username" placeholder="name@maayasthra.com" value=${email} onChange=${ev => setEmail(ev.target.value)}/></div></div>
           <div className="fld"><label htmlFor="login-pw">Password</label><div className="pw lx-in"><${Icon} n="lock" s=${17}/><input id="login-pw" className="inp" type=${show ? 'text' : 'password'} autoComplete="current-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
          <div className="lg-row"><button type="button" className="link" onClick=${() => { setView('forgot'); setStep('email'); setDone(false); setErr(''); setSent(false); }}>Forgot password?</button></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Signing in…' : !authEnabled && mode === 'admin' ? 'Sign in as Admin' : 'Sign in'}${!busy && html`<${Icon} n="arrow" s=${17}/>`}</button>
        </form>
        ${!authEnabled && html`<div className="lg-demo"><h3>Try a demo account</h3>
          <button className="dm" onClick=${() => demo(2, 'admin')} disabled=${busy}><${Av} e=${BY[2]} s=${38}/><span className="row-t"><b>Meera Iyer</b><span>Admin · approves leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <button className="dm" onClick=${() => demo(5, 'pm')} disabled=${busy}><${Av} e=${BY[5]} s=${38}/><span className="row-t"><b>Vikram Nair</b><span>Project manager · runs the board</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
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
        <button className="back" onClick=${() => { if (step === 'code' && !done) { setStep('email'); setErr(''); } else { setView('signin'); setStep('email'); setErr(''); setDone(false); setPw(''); setPw2(''); } }}><${Icon} n="back" s=${16}/> ${step === 'code' && !done ? 'Use a different email' : 'Back to sign in'}</button>
        ${done ? html`<h2>Password changed</h2><p>You can sign in with your new password.</p>
          <button className="btn pri" type="button" onClick=${() => { setView('signin'); setStep('email'); setDone(false); setPw(''); setPw2(''); setErr(''); }}>Go to sign in</button>`
        : step === 'email' ? html`<h2>Forgot your password?</h2><p>Enter your work email. We will send you a 6-digit code to reset it.</p>
          <form onSubmit=${sendCode} noValidate>
            <div className="fld"><label htmlFor="reset-email">Work email</label><div className="lx-in"><${Icon} n="user" s=${17}/><input id="reset-email" className="inp" type="email" autoComplete="username" placeholder="name@maayasthra.com" value=${email} onChange=${ev => setEmail(ev.target.value)}/></div></div>
            ${err && html`<div className="lg-err" role="alert">${err}</div>`}
            <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Sending…' : 'Send code'}</button>
          </form>`
        : html`<h2>Enter your code</h2><p>We sent a 6-digit code to <b>${email.trim()}</b>. It works once and expires in 10 minutes. Check your spam folder if it does not arrive.</p>
          ${!authEnabled && html`<div className="lg-note" style=${{ marginTop: 0 }}>Demo: the code is 123456.</div>`}
          <form onSubmit=${resetWithCode} noValidate>
            <div className="fld"><label htmlFor="rs-code">6-digit code</label><input id="rs-code" className="inp lx-code" inputMode="numeric" autoComplete="one-time-code" maxLength="7" placeholder="000000" value=${code} onChange=${ev => { setCode(ev.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} autoFocus/></div>
            <div className="fld"><label htmlFor="rs-pw">New password</label><div className="pw lx-in"><${Icon} n="lock" s=${17}/><input id="rs-pw" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
            <div className="fld"><label htmlFor="rs-pw2">Repeat the new password</label><div className="lx-in"><${Icon} n="lock" s=${17}/><input id="rs-pw2" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw2} onChange=${ev => setPw2(ev.target.value)}/></div></div>
            ${err && html`<div className="lg-err" role="alert">${err}</div>`}
            <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Resetting…' : 'Reset password'}</button>
          </form>
          <div className="lg-alt"><span>Did not get it?</span><button type="button" className="link" disabled=${cool > 0 || busy} onClick=${() => sendCode()}>${cool > 0 ? 'Send a new code in ' + cool + 's' : 'Send a new code'}</button></div>`}
      <//>`}
    </div><p className="lx-help">Trouble signing in? Ask an admin to check your access.</p></section>
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
    <div className="brand" style=${{ padding: '0 0 28px' }}><${Logo}/></div>
    <h2>Choose a password</h2>
    <form onSubmit=${submit} noValidate>
      <div className="fld"><label htmlFor="np1">New password</label><div className="pw"><input id="np1" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
      <div className="fld"><label htmlFor="np2">Repeat it</label><input id="np2" className="inp" type=${show ? 'text' : 'password'} autoComplete="new-password" value=${pw2} onChange=${ev => setPw2(ev.target.value)}/></div>
      ${err && html`<div className="lg-err" role="alert">${err}</div>`}
      <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Saving…' : 'Save and continue'}</button>
    </form></div></section></div>`;
}
