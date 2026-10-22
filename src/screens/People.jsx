import { useState, useMemo } from 'react';
import { html, Icon, Av, Photo, HI, Sel } from '../ui.jsx';
import { IS_DEMO } from '../env.js';
import { saveEmployee, saveMyProfile } from '../staff.js';
import {
  EMP, BY, DEPTS, STATUSES, TODISO, ROLE_NAMES, ROLEMAP, defaultStart, fmtDM, pd, searchPeople, activeEmps, addEmployee, updateEmployee, emailFor
} from '../data.js';

/* ---------- Directory ---------- */
export function People({ pf, setPf, open, openForm, role, ver }) {
  const cities = useMemo(() => [...new Set(EMP.map(e => e.city))].sort(), [ver]);
  const list = useMemo(() => {
    let l = searchPeople(pf.q, pf.former);
    if (!pf.former) l = l.filter(e => e.status !== 'Exited');
    if (pf.dept !== 'All') l = l.filter(e => e.dept === pf.dept);
    if (pf.city !== 'All') l = l.filter(e => e.city === pf.city);
    const s = [...l];
    if (pf.sort === 'name') s.sort((a, b) => a.name.localeCompare(b.name));
    else if (pf.sort === 'new') s.sort((a, b) => pd(b.join) - pd(a.join));
    else s.sort((a, b) => pd(a.join) - pd(b.join));
    return s;
  }, [pf, ver]);
  const clear = () => setPf({ ...pf, q: '', dept: 'All', city: 'All' });
  const act = activeEmps();
  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="people"/>People</h1><p>${act.length}</p></div>
      ${role === 'admin' && html`<button className="btn pri" onClick=${() => openForm(null)}><${Icon} n="plus" s=${16}/> Add</button>`}</div>
    <div className="tools">
      <div className="search"><${Icon} n="search"/><input id="people-search" value=${pf.q} placeholder="Search" onChange=${ev => setPf({ ...pf, q: ev.target.value })} aria-label="Search people"/></div>
      <div className="filters">
      <${Sel} icon="building" id="dept-filter" value=${pf.dept} label="Department" onChange=${ev => setPf({ ...pf, dept: ev.target.value })}><option value="All">All</option>${DEPTS.map(d => html`<option key=${d} value=${d}>${d}</option>`)}<//>
      <${Sel} icon="pin" id="city-filter" value=${pf.city} label="City" onChange=${ev => setPf({ ...pf, city: ev.target.value })}><option value="All">All</option>${cities.map(c => html`<option key=${c} value=${c}>${c}</option>`)}<//>
      <${Sel} icon="filter" id="sort-by" value=${pf.sort} label="Sort" onChange=${ev => setPf({ ...pf, sort: ev.target.value })}><option value="name">A–Z</option><option value="new">Newest</option><option value="old">Longest serving</option><//>
      ${role === 'admin' && html`<button className=${'ibx' + (pf.former ? ' on' : '')} title="Include former employees" aria-label="Include former employees" aria-pressed=${!!pf.former} onClick=${() => setPf({ ...pf, former: !pf.former })}><${Icon} n="user" s=${18}/></button>`}
      </div>
      ${list.length !== act.length && html`<span className="tools-n">${list.length} of ${act.length}</span>`}
    </div>
    ${list.length === 0 ? html`<div className="none"><b>No match</b><button className="btn ghost" onClick=${clear}>Clear</button></div>` :
    html`<div className="dir">${list.map(e => html`<button key=${e.n} className="di" onClick=${() => open(e.n)}>
      <${Av} e=${e} s=${52}/>
      <span className="row-t"><b>${e.name}${e.status === 'Exited' ? ' (former)' : ''}</b><span>${e.role}</span><span className="di-m">${e.dept} · ${e.city}</span></span></button>`)}</div>`}
  </div>`;
}

/* ---------- Add / edit employee ---------- */
export function EmployeeForm({ id, role, user, done, bump }) {
  const e = id ? BY[id] : null;
  const isAdmin = role === 'admin';
  const [f, setF] = useState(() => e ? { ...e } : { name: '', email: '', role: '', dept: '', city: '', mgr: 0, status: 'Full-time', join: TODISO, dob: '', g: 'f', phone: '', emergency: '', emergencyPhone: '', bio: '', photo: '', shiftStart: '10:00', shiftEnd: '18:00' });
  const [access, setAccess] = useState(e ? ROLEMAP[e.n] : 'Employee');
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = p => { setF(o => ({ ...o, ...p })); setErr(''); };
  if (e && !isAdmin && e.n !== user.n) return html`<div className="none"><b>You can only edit your own profile</b></div>`;

  const onPhoto = ev => {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 480 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); set({ photo: c.toDataURL('image/jpeg', 0.82) });
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  };
  const submit = async ev => {
    ev.preventDefault();
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
    try { const saved = await saveEmployee({ ...core, ...contact, n: e ? e.n : 0, email, access }); bump(); done(saved.n); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const preview = { n: e ? e.n : 99, g: f.g, name: f.name || 'New hire', photo: f.photo };
  const mgrs = activeEmps().filter(x => !e || x.n !== e.n).sort((a, b) => a.name.localeCompare(b.name));
  const dis = !isAdmin;
  return html`<div>
    <button className="back" onClick=${() => done(e ? e.n : null)}><${Icon} n="back" s=${16}/> ${e ? 'Back to profile' : 'Back to people'}</button>
    <div className="pg-h"><div><h1>${e ? (isAdmin && e.n !== user.n ? 'Edit ' + e.name : 'Edit your profile') : 'Add employee'}</h1>
      </div></div>
    <form className="ef" onSubmit=${submit} noValidate>
      <div className="ef-photo"><div style=${{ width: 160 }}><${Photo} e=${preview}/></div>
        <label className="btn ghost sm" htmlFor="ef-photo-in" style=${{ marginTop: 14, cursor: 'pointer' }}>Upload photo</label>
        <input id="ef-photo-in" type="file" accept="image/*" onChange=${onPhoto} hidden/>
        ${f.photo && html`<button type="button" className="link" style=${{ marginTop: 10 }} onClick=${() => set({ photo: '' })}>Remove photo</button>`}</div>
      <div>
        <div className="eyebrow" style=${{ marginBottom: 14 }}>Contact and about</div>
        <div className="two"><div className="fld"><label htmlFor="ef-phone">Phone</label><input id="ef-phone" className="inp" value=${f.phone} onChange=${ev => set({ phone: ev.target.value })} placeholder="+91 98xxx xxxxx"/></div>
          <div className="fld"><label htmlFor="ef-em">Emergency contact</label><input id="ef-em" className="inp" value=${f.emergency} onChange=${ev => set({ emergency: ev.target.value })} placeholder="Name and relationship"/></div></div>
        <div className="fld"><label htmlFor="ef-emp">Emergency contact phone</label><input id="ef-emp" className="inp" value=${f.emergencyPhone} onChange=${ev => set({ emergencyPhone: ev.target.value })}/></div>
        <div className="fld"><label htmlFor="ef-bio">About</label><textarea id="ef-bio" className="inp" value=${f.bio} onChange=${ev => set({ bio: ev.target.value })} placeholder="A line or two about what you work on"></textarea></div>
        <div className="eyebrow" style=${{ margin: '36px 0 14px' }}>Employment</div>
        <div className="two"><div className="fld"><label htmlFor="ef-name">Full name</label><input id="ef-name" className="inp" value=${f.name} disabled=${dis} onChange=${ev => set({ name: ev.target.value })}/></div>
          <div className="fld"><label htmlFor="ef-role">Job title</label><input id="ef-role" className="inp" value=${f.role} disabled=${dis} onChange=${ev => set({ role: ev.target.value })}/></div></div>
        ${!IS_DEMO && html`<div className="fld"><label htmlFor="ef-email">Work email</label><input id="ef-email" type="email" className="inp" value=${f.email || ''} disabled=${dis || !!e} onChange=${ev => set({ email: ev.target.value })} placeholder="name@maayasthra.com"/></div>`}
        <div className="two"><div className="fld"><label htmlFor="ef-dept">Department</label><input id="ef-dept" className="inp" list="dept-list" value=${f.dept} disabled=${dis} onChange=${ev => set({ dept: ev.target.value })}/><datalist id="dept-list">${DEPTS.map(d => html`<option key=${d} value=${d}/>`)}</datalist></div>
          <div className="fld"><label htmlFor="ef-city">City</label><input id="ef-city" className="inp" value=${f.city} disabled=${dis} onChange=${ev => set({ city: ev.target.value })}/></div></div>
        <div className="two"><div className="fld"><label htmlFor="ef-join">Date of joining</label><input id="ef-join" className="inp" type="date" value=${f.join} disabled=${dis} onChange=${ev => set({ join: ev.target.value })}/></div>
          <div className="fld"><label htmlFor="ef-dob">Birthday</label><input id="ef-dob" className="inp" type="date" value=${f.dob} disabled=${dis} onChange=${ev => set({ dob: ev.target.value })}/></div></div>
        <div className="two"><div className="fld"><label htmlFor="ef-mgr">Reporting manager</label><select id="ef-mgr" className="inp" value=${f.mgr} disabled=${dis} onChange=${ev => set({ mgr: ev.target.value })}><option value="0">No one (leads the studio)</option>${mgrs.map(m => html`<option key=${m.n} value=${m.n}>${m.name}</option>`)}</select></div>
          <div className="fld"><label htmlFor="ef-status">Employment status</label><select id="ef-status" className="inp" value=${f.status} disabled=${dis} onChange=${ev => set({ status: ev.target.value })}>${STATUSES.map(s => html`<option key=${s} value=${s}>${s}</option>`)}</select></div></div>
        <div className="two"><div className="fld"><label htmlFor="ef-ss">Login time</label><input id="ef-ss" className="inp" type="time" value=${f.shiftStart} disabled=${dis} onChange=${ev => set({ shiftStart: ev.target.value })}/></div>
          <div className="fld"><label htmlFor="ef-se">Logout time</label><input id="ef-se" className="inp" type="time" value=${f.shiftEnd} disabled=${dis} onChange=${ev => set({ shiftEnd: ev.target.value })}/></div></div>
        ${isAdmin && html`<div className="two"><div className="fld"><label htmlFor="ef-g">Portrait style</label><select id="ef-g" className="inp" value=${f.g} onChange=${ev => set({ g: ev.target.value })}><option value="f">Style A</option><option value="m">Style B</option></select></div>
          <div className="fld"><label htmlFor="ef-acc">App access</label><select id="ef-acc" className="inp" value=${access} onChange=${ev => { const r = ev.target.value; if (f.shiftStart === defaultStart(access)) set({ shiftStart: defaultStart(r) }); setAccess(r); }}>${ROLE_NAMES.map(r => html`<option key=${r} value=${r}>${r}</option>`)}</select></div></div>`}
        ${err && html`<div className="lg-err" role="alert">${err}</div>`}
        <div style=${{ display: 'flex', gap: 12, marginTop: 28 }}><button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Saving…' : e ? 'Save changes' : 'Add employee'}</button><button type="button" className="btn ghost" onClick=${() => done(e ? e.n : null)}>Cancel</button></div>
        ${!e && IS_DEMO && html`<p className="bar-l">Their work email will be ${emailFor(f.name || 'first last')}.</p>`}
      </div>
    </form>
  </div>`;
}
