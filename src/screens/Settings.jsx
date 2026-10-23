import { useState } from 'react';
import { html, Icon, Av, Switch, HI } from '../ui.jsx';
import { IS_DEMO } from '../env.js';
import { saveRole } from '../staff.js';
import { saveHoliday, deleteHoliday, savePolicy } from '../leave.js';
import { EMP, HOL, TODISO, WD, POLICY, ROLE_NAMES, ROLEMAP, setRole, fmt, pd, plural, searchPeople } from '../data.js';

const PERMS = [
  ['See the people directory and org chart', [1, 1, 1]], ['Apply for leave and see own balances', [1, 1, 1]], ['Edit own photo and contact details', [1, 1, 1]],
  ['See and work on their own tasks, with a timer', [1, 1, 1]],
  ['See the whole Kanban board, Team and Project hours', [0, 1, 1]], ['Assign tasks to people and remove tasks', [0, 1, 1]],
  ['Approve and decline leave requests', [0, 0, 1]], ['See everyone\'s leave balances and export reports', [0, 0, 1]],
  ['Add and edit employee records', [0, 0, 1]], ['Post announcements', [0, 0, 1]], ['Manage leave policy, holidays and roles', [0, 0, 1]]
];

function Access({ onChange }) {
  const [q, setQ] = useState(''), [err, setErr] = useState('');
  const change = async (e, r) => {
    if (r !== 'Admin' && ROLEMAP[e.n] === 'Admin' && counts('Admin') <= 1) { setErr('There must be at least one admin.'); return; }
    setErr('');
    if (IS_DEMO) { setRole(e.n, r); onChange(); return; }
    try { await saveRole(e.n, r); } catch (x) { setErr(x.message); }
    onChange();
  };
  const counts = r => EMP.filter(e => e.status !== 'Exited' && ROLEMAP[e.n] === r).length;
  const list = searchPeople(q).sort((a, b) => ROLE_NAMES.indexOf(ROLEMAP[b.n]) - ROLE_NAMES.indexOf(ROLEMAP[a.n]) || a.name.localeCompare(b.name)).slice(0, q.trim() ? 20 : 8);
  return html`<div className="st-w" style=${{ maxWidth: 900 }}>
    <h2 className="st-h">Roles</h2>
    <div className="mx"><table><thead><tr><th></th>${ROLE_NAMES.map(r => html`<th key=${r}>${r}<small>${plural(counts(r), 'person').replace('persons', 'people')}</small></th>`)}</tr></thead>
      <tbody>${PERMS.map(([l, v]) => html`<tr key=${l}><td>${l}</td>${v.map((x, i) => html`<td key=${i}>${x ? html`<${Icon} n="check" s=${17}/>` : '–'}</td>`)}</tr>`)}</tbody></table></div>
    <div className="st-s"><h2 className="st-h">People</h2>
      <div className="search" style=${{ maxWidth: 'none', marginBottom: 8 }}><${Icon} n="search"/><input id="role-search" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Search" aria-label="Search people to change role"/></div>
      ${list.map(e => html`<div className="pr" key=${e.n}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role} · ${e.dept}</span></span>
        <select className="sel" value=${ROLEMAP[e.n]} aria-label=${'Role for ' + e.name} onChange=${ev => change(e, ev.target.value)}>${ROLE_NAMES.map(r => html`<option key=${r} value=${r}>${r}</option>`)}</select></div>`)}
      ${err && html`<div className="lg-err" role="alert">${err}</div>`}
      ${list.length === 0 && html`<div className="empty" style=${{ textAlign: 'left' }}>No one matches "${q}".</div>`}
      <div className="bar-l">${q.trim() ? 'Showing ' + list.length + ' result' + (list.length === 1 ? '' : 's') : '8 shown'}</div></div>
  </div>`;
}

function Policy({ onChange }) {
  const [saved, setSaved] = useState(false), [perr, setPerr] = useState('');
  // In the live app the rules are saved a moment after the last change.
  const touch = () => {
    setSaved(!IS_DEMO ? false : true); onChange();
    if (IS_DEMO) return;
    clearTimeout(touch.t); setPerr('');
    touch.t = setTimeout(() => savePolicy().then(() => setSaved(true)).catch(x => setPerr(x.message)), 600);
  };
  const num = (ev, max) => Math.max(0, Math.min(max, Number(ev.target.value) || 0));
  return html`<div className="st-w">
    <h2 className="st-h">Yearly days</h2>
    ${Object.keys(POLICY.allow).map(k => html`<div className="sr" key=${k}><span><b>${k}</b></span><span className="sr-c"><input id=${'al-' + k.split(' ')[0]} className="inp" type="number" min="0" max="60" value=${POLICY.allow[k]} aria-label=${k + ' days per year'} onChange=${ev => { POLICY.allow[k] = num(ev, 60); touch(); }}/><span style=${{ color: 'var(--muted)', fontSize: 13 }}>days</span></span></div>`)}
    <div className="st-s"><h2 className="st-h">Rules</h2>
      <div className="sr"><span><b>Notice</b><span className="d">Working days ahead. Not for sick or emergency leave.</span></span><span className="sr-c"><input id="notice" className="inp" type="number" min="0" max="30" value=${POLICY.notice} aria-label="Minimum notice in days" onChange=${ev => { POLICY.notice = num(ev, 30); touch(); }}/><span style=${{ color: 'var(--muted)', fontSize: 13 }}>days</span></span></div>
      <div className="sr"><span><b>Half days</b></span><span className="sr-c"><${Switch} on=${POLICY.half} set=${v => { POLICY.half = v; touch(); }} label="Allow half-day leave"/></span></div>
      <div className="sr"><span><b>Note required</b></span><span className="sr-c"><${Switch} on=${POLICY.note} set=${v => { POLICY.note = v; touch(); }} label="Require a note"/></span></div></div>
    <div style=${{ marginTop: 24, minHeight: 24 }}>${perr ? html`<span className="lg-err" style=${{ margin: 0 }}>${perr}</span>` : saved && html`<span className="saved"><${Icon} n="check" s=${16}/> Saved</span>`}</div>
  </div>`;
}

function Holidays({ onChange }) {
  const [d, setD] = useState(''); const [n, setN] = useState(''); const [herr, setHerr] = useState('');
  const keys = Object.keys(HOL).sort();
  const add = ev => {
    ev.preventDefault(); if (!d || !n.trim()) return;
    const day = d, name = n.trim(), old = HOL[day]; HOL[day] = name; setD(''); setN(''); setHerr(''); onChange();
    if (!IS_DEMO) saveHoliday(day, name).catch(x => { if (old) HOL[day] = old; else delete HOL[day]; setHerr(x.message); onChange(); });
  };
  const del = k => {
    const old = HOL[k]; delete HOL[k]; setHerr(''); onChange();
    if (!IS_DEMO) deleteHoliday(k).catch(x => { HOL[k] = old; setHerr(x.message); onChange(); });
  };
  return html`<div className="st-w">
    <h2 className="st-h">Holidays · ${keys.length}</h2>
    <form className="hol-add" onSubmit=${add}>
      <div className="fld"><label htmlFor="hol-d">Date</label><input id="hol-d" className="inp" type="date" value=${d} onChange=${ev => setD(ev.target.value)}/></div>
      <div className="fld"><label htmlFor="hol-n">Name</label><input id="hol-n" className="inp" value=${n} onChange=${ev => setN(ev.target.value)} placeholder="Name"/></div>
      <button className="btn pri" type="submit" disabled=${!d || !n.trim()}><${Icon} n="plus" s=${16}/> Add</button></form>
    ${herr && html`<div className="lg-err" role="alert">${herr}</div>`}
    ${keys.map(k => html`<div className=${'hol-r' + (k < TODISO ? ' past' : '')} key=${k}><time>${fmt(k)}</time><span className="nm">${HOL[k]}</span><span className="wk">${WD[new Date(pd(k)).getUTCDay()]}</span>
      <button className="link" onClick=${() => del(k)} aria-label=${'Remove ' + HOL[k]}>Remove</button></div>`)}
  </div>`;
}

export function Settings({ onChange }) {
  const tabs = [['access', 'Access', 'user'], ['policy', 'Leave', 'leaves'], ['holidays', 'Holidays', 'calendar']];
  const [tab, setTab] = useState('access');
  return html`<div><div className="pg-h"><div><h1><${HI} n="settings" tone="purple"/>Settings</h1></div></div>
    <div className="seg seg-t" role="group" aria-label="Settings">${tabs.map(([k, l, ic]) => html`<button key=${k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}><${Icon} n=${ic} s=${15}/>${l}</button>`)}</div>
    ${tab === 'access' ? html`<${Access} onChange=${onChange}/>` : tab === 'policy' ? html`<${Policy} onChange=${onChange}/>` : html`<${Holidays} onChange=${onChange}/>`}</div>`;
}
