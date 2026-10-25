import { useState } from 'react';
import { html, Icon, Photo } from '../ui.jsx';
import { IS_DEMO } from '../env.js';
import { saveEmployee, saveMyProfile } from '../staff.js';
import { EMP, BY, DEPTS, STATUSES, TODISO, ROLE_NAMES, ROLEMAP, defaultStart, activeEmps, addEmployee, updateEmployee, emailFor, fmt, fmtTime } from '../data.js';

/* One labelled field. It must stay outside EmployeeForm: a component defined inside would be rebuilt on every keystroke and lose the cursor. */
const Fld = ({ id, label, children, hint }) => html`<div className="fld"><label htmlFor=${id}>${label}</label>${children}${hint && html`<small className="fld-h">${hint}</small>`}</div>`;

/* ---------- Add / edit a person ---------- */
export function EmployeeForm({ id, role, user, done, bump }) {
  const e = id ? BY[id] : null;
  const isAdmin = role === 'admin', self = !!e && e.n === user.n;
  const [f, setF] = useState(() => e ? { ...e } : { name: '', email: '', role: '', dept: '', city: '', mgr: 0, status: 'Full-time', join: TODISO, dob: '', g: 'f', phone: '', emergency: '', emergencyPhone: '', bio: '', photo: '', shiftStart: '10:00', shiftEnd: '18:00' });
  const [access, setAccess] = useState(e ? ROLEMAP[e.n] : 'Employee');
  const [base0] = useState(() => e ? { ...e, access: ROLEMAP[e.n] } : undefined); // what the form opened with, so only real changes are saved
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = p => { setF(o => ({ ...o, ...p })); setErr(''); };
  if (e && !isAdmin && !self) return html`<div className="none"><b>You can only edit your own profile</b></div>`;

  // A square crop of the middle of the picture, small enough to load quickly for everyone.
  const onPhoto = ev => {
    const file = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { setErr('Choose a picture file, like a JPG or PNG.'); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const S = 320, side = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = S; c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      set({ photo: c.toDataURL('image/jpeg', 0.85) }); URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setErr('That picture could not be opened. Try a JPG or PNG.'); };
    img.src = url;
  };

  const submit = async ev => {
    ev.preventDefault(); if (busy) return;
    const contact = { phone: f.phone.trim(), emergency: f.emergency.trim(), emergencyPhone: f.emergencyPhone.trim(), bio: f.bio.trim(), photo: f.photo };
    if (!isAdmin) {
      if (IS_DEMO) { updateEmployee(e.n, contact); bump(); done(e.n); return; }
      setBusy(true);
      try { await saveMyProfile({ ...contact }); bump(); done(e.n); } catch (x) { setErr(x.message); setBusy(false); }
      return;
    }
    const email = IS_DEMO ? emailFor(f.name) : (f.email || '').trim().toLowerCase();
    if (!f.name.trim() || !f.role.trim() || !f.dept.trim() || (IS_DEMO && (!f.join || !f.dob))) { setErr(IS_DEMO ? 'Fill in name, job title, department, joining date and birthday.' : 'Fill in name, work email, job title and department.'); return; }
    if (!IS_DEMO && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Enter a valid work email.'); return; }
    const dupe = EMP.find(x => x.email === email && (!e || x.n !== e.n));
    if (dupe) { setErr('Another person already has the email ' + dupe.email + '.'); return; }
    if (!f.shiftStart || !f.shiftEnd || f.shiftEnd <= f.shiftStart) { setErr('Working hours need a start time that is earlier than the end time.'); return; }
    const core = { shiftStart: f.shiftStart, shiftEnd: f.shiftEnd, name: f.name.trim(), role: f.role.trim(), dept: f.dept.trim(), city: f.city.trim() || 'Chennai', mgr: Number(f.mgr) || 0, status: f.status, join: f.join, dob: f.dob, g: f.g };
    if (IS_DEMO) { const saved = e ? updateEmployee(e.n, { ...core, ...contact }) : addEmployee({ ...core, ...contact }); ROLEMAP[saved.n] = access; bump(); done(saved.n); return; }
    setBusy(true);
    try { const saved = await saveEmployee({ ...core, ...contact, n: e ? e.n : 0, email, access }, base0); bump(); done(saved.n); } catch (x) { setErr(x.message); setBusy(false); }
  };

  const preview = { n: e ? e.n : 99, g: f.g, name: f.name || 'New person', photo: f.photo };
  const mgrs = activeEmps().filter(x => !e || x.n !== e.n).sort((a, b) => a.name.localeCompare(b.name));
  const title = !e ? 'Add a person' : self && !isAdmin ? 'Edit your profile' : self ? 'Edit your profile' : 'Edit ' + e.name;

  return html`<div className="ef2">
    <button className="back" onClick=${() => done(e ? e.n : null)}><${Icon} n="back" s=${16}/> ${e ? 'Back to profile' : 'Back to people'}</button>
    <div className="pg-h"><div><h1>${title}</h1>${e && html`<p>${e.role} · ${e.dept}</p>`}</div></div>
    <form className="ef2-f" onSubmit=${submit} noValidate>
      <section className="ef2-card ef2-photo">
        <div className="ef2-ph"><${Photo} e=${preview}/></div>
        <div className="ef2-pb">
          <label className="btn sec2" htmlFor="ef-photo-in"><${Icon} n="edit" s=${15}/> ${f.photo ? 'Change photo' : 'Upload photo'}</label>
          <input id="ef-photo-in" type="file" accept="image/*" onChange=${onPhoto} hidden/>
          ${f.photo && html`<button type="button" className="btn ghost" onClick=${() => set({ photo: '' })}>Remove</button>`}
        </div>
        <small>Everyone at Maayasthra will see this. A clear, square photo of your face works best.</small>
      </section>

      <div className="ef2-main">
        <section className="ef2-card"><h2>About</h2>
          <${Fld} id="ef-bio" label="A line or two about you"><textarea id="ef-bio" className="inp" value=${f.bio} onChange=${ev => set({ bio: ev.target.value })} placeholder="What you work on, what you enjoy" maxLength="500"></textarea><//></section>

        <section className="ef2-card"><h2>Contact</h2><p className="ef2-s">Only you and the admins can see these.</p>
          <${Fld} id="ef-phone" label="Phone"><input id="ef-phone" className="inp" type="tel" value=${f.phone} onChange=${ev => set({ phone: ev.target.value })} placeholder="+91 98xxx xxxxx"/><//>
          <div className="two"><${Fld} id="ef-em" label="Emergency contact"><input id="ef-em" className="inp" value=${f.emergency} onChange=${ev => set({ emergency: ev.target.value })} placeholder="Name and relationship"/><//>
            <${Fld} id="ef-emp" label="Their phone"><input id="ef-emp" className="inp" type="tel" value=${f.emergencyPhone} onChange=${ev => set({ emergencyPhone: ev.target.value })}/><//></div></section>

        ${isAdmin ? html`<section className="ef2-card"><h2>Employment</h2><p className="ef2-s">Only admins can change these.</p>
          <div className="two"><${Fld} id="ef-name" label="Full name"><input id="ef-name" className="inp" value=${f.name} onChange=${ev => set({ name: ev.target.value })}/><//>
            <${Fld} id="ef-role" label="Job title"><input id="ef-role" className="inp" value=${f.role} onChange=${ev => set({ role: ev.target.value })}/><//></div>
          ${!IS_DEMO && html`<${Fld} id="ef-email" label="Work email" hint=${e ? 'The email is how they sign in, so it cannot be changed here.' : 'They sign up with this email.'}><input id="ef-email" type="email" className="inp" value=${f.email || ''} disabled=${!!e} onChange=${ev => set({ email: ev.target.value })} placeholder="name@maayasthra.com"/><//>`}
          <div className="two"><${Fld} id="ef-dept" label="Department"><input id="ef-dept" className="inp" list="dept-list" value=${f.dept} onChange=${ev => set({ dept: ev.target.value })}/><datalist id="dept-list">${DEPTS.map(d => html`<option key=${d} value=${d}/>`)}</datalist><//>
            <${Fld} id="ef-city" label="City"><input id="ef-city" className="inp" value=${f.city} onChange=${ev => set({ city: ev.target.value })}/><//></div>
          <div className="two"><${Fld} id="ef-mgr" label="Reports to"><select id="ef-mgr" className="inp" value=${f.mgr} onChange=${ev => set({ mgr: ev.target.value })}><option value="0">No one</option>${mgrs.map(m => html`<option key=${m.n} value=${m.n}>${m.name}</option>`)}</select><//>
            <${Fld} id="ef-status" label="Status"><select id="ef-status" className="inp" value=${f.status} onChange=${ev => set({ status: ev.target.value })}>${STATUSES.map(s => html`<option key=${s} value=${s}>${s}</option>`)}</select><//></div>
          <div className="two"><${Fld} id="ef-join" label="Joined"><input id="ef-join" className="inp" type="date" value=${f.join} onChange=${ev => set({ join: ev.target.value })}/><//>
            <${Fld} id="ef-dob" label="Birthday"><input id="ef-dob" className="inp" type="date" value=${f.dob} onChange=${ev => set({ dob: ev.target.value })}/><//></div>
          <div className="two"><${Fld} id="ef-ss" label="Login time"><input id="ef-ss" className="inp" type="time" value=${f.shiftStart} onChange=${ev => set({ shiftStart: ev.target.value })}/><//>
            <${Fld} id="ef-se" label="Logout time"><input id="ef-se" className="inp" type="time" value=${f.shiftEnd} onChange=${ev => set({ shiftEnd: ev.target.value })}/><//></div>
          <div className="two"><${Fld} id="ef-acc" label="App access"><select id="ef-acc" className="inp" value=${access} onChange=${ev => { const r = ev.target.value; if (f.shiftStart === defaultStart(access)) set({ shiftStart: defaultStart(r) }); setAccess(r); }}>${ROLE_NAMES.map(r => html`<option key=${r} value=${r}>${r}</option>`)}</select><//>
            <${Fld} id="ef-g" label="Avatar style" hint="Used until a photo is added."><select id="ef-g" className="inp" value=${f.g} onChange=${ev => set({ g: ev.target.value })}><option value="f">Style A</option><option value="m">Style B</option></select><//></div></section>`
        : html`<section className="ef2-card"><h2>Work details</h2><p className="ef2-s">Your admin manages these. Ask them if anything is wrong.</p>
          ${[['Name', e.name], ['Job title', e.role], ['Department', e.dept], ['Reports to', BY[e.mgr] ? BY[e.mgr].name : '–'], ['Working hours', fmtTime(e.shiftStart) + ' – ' + fmtTime(e.shiftEnd)], ['Joined', e.join ? fmt(e.join) : '–']].map(([k, v]) => html`<div className="pf2-row" key=${k}><span>${k}</span><div>${v}</div></div>`)}</section>`}
        <div className="ef2-end">
          <span className=${'ef2-msg' + (err ? ' bad' : '')} role=${err ? 'alert' : 'status'}>${err || ''}</span>
          <button type="button" className="btn ghost" onClick=${() => done(e ? e.n : null)}>Cancel</button>
          <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Saving…' : e ? 'Save changes' : 'Add person'}</button>
        </div>
      </div>
    </form>
  </div>`;
}
