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

export { EmployeeForm } from './EmployeeForm.jsx';
