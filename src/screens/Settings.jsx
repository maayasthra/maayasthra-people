import { useState } from 'react';
import { html, Icon, Av, Switch } from '../ui.jsx';
import { EMP, HOL, TODISO, WD, POLICY, ROLE_NAMES, ROLEMAP, fmt, pd, plural, searchPeople } from '../data.js';

const PERMS = [
  ['See the people directory and org chart', [1, 1, 1, 1]], ['Apply for leave and see own balances', [1, 1, 1, 1]], ['Edit own photo and contact details', [1, 1, 1, 1]],
  ['Approve leave for own team', [0, 1, 1, 1]], ['Approve leave for everyone', [0, 0, 1, 1]], ['See everyone\'s leave balances and export reports', [0, 0, 1, 1]],
  ['Add and edit employee records', [0, 0, 1, 1]], ['Post announcements', [0, 0, 1, 1]], ['Manage leave policy, holidays and roles', [0, 0, 1, 1]]
];

function Access({ onChange }) {
  const [q, setQ] = useState('');
  const counts = r => EMP.filter(e => e.status !== 'Exited' && ROLEMAP[e.n] === r).length;
  const list = searchPeople(q).sort((a, b) => ROLE_NAMES.indexOf(ROLEMAP[b.n]) - ROLE_NAMES.indexOf(ROLEMAP[a.n]) || a.name.localeCompare(b.name)).slice(0, q.trim() ? 20 : 8);
  return html`<div className="st-w" style=${{ maxWidth: 900 }}>
    <h2 className="st-h">What each role can do</h2><p className="st-p">Everyone starts as an Employee. Managers approve for their own team. HR and Admin work across the whole studio.</p>
    <div className="mx"><table><thead><tr><th></th>${ROLE_NAMES.map(r => html`<th key=${r}>${r}<small>${plural(counts(r), 'person').replace('persons', 'people')}</small></th>`)}</tr></thead>
      <tbody>${PERMS.map(([l, v]) => html`<tr key=${l}><td>${l}</td>${v.map((x, i) => html`<td key=${i}>${x ? html`<${Icon} n="check" s=${17}/>` : '–'}</td>`)}</tr>`)}</tbody></table></div>
    <div className="st-s"><h2 className="st-h">Who has which role</h2><p className="st-p">Search for anyone to change their role. It takes effect the next time they sign in.</p>
      <div className="search" style=${{ maxWidth: 'none', marginBottom: 8 }}><${Icon} n="search"/><input id="role-search" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Search by name or department" aria-label="Search people to change role"/></div>
      ${list.map(e => html`<div className="pr" key=${e.n}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role} · ${e.dept}</span></span>
        <select className="sel" value=${ROLEMAP[e.n]} aria-label=${'Role for ' + e.name} onChange=${ev => { ROLEMAP[e.n] = ev.target.value; onChange(); }}>${ROLE_NAMES.map(r => html`<option key=${r} value=${r}>${r}</option>`)}</select></div>`)}
      ${list.length === 0 && html`<div className="empty" style=${{ textAlign: 'left' }}>No one matches "${q}".</div>`}
      <div className="bar-l">${q.trim() ? 'Showing ' + list.length + ' result' + (list.length === 1 ? '' : 's') : 'Showing 8 people. Search to find anyone.'}</div></div>
  </div>`;
}

function Policy({ onChange }) {
  const [saved, setSaved] = useState(false);
  const touch = () => { setSaved(true); onChange(); };
  const num = (ev, max) => Math.max(0, Math.min(max, Number(ev.target.value) || 0));
  return html`<div className="st-w">
    <h2 className="st-h">Yearly allowances</h2><p className="st-p">Days each person receives per leave year. Balances update straight away.</p>
    ${Object.keys(POLICY.allow).map(k => html`<div className="sr" key=${k}><span><b>${k}</b></span><span className="sr-c"><input id=${'al-' + k.split(' ')[0]} className="inp" type="number" min="0" max="60" value=${POLICY.allow[k]} aria-label=${k + ' days per year'} onChange=${ev => { POLICY.allow[k] = num(ev, 60); touch(); }}/><span style=${{ color: 'var(--muted)', fontSize: 13 }}>days</span></span></div>`)}
    <div className="st-s"><h2 className="st-h">Rules</h2><p className="st-p" style=${{ marginBottom: 6 }}>Applied to every new leave request.</p>
      <div className="sr"><span><b>Minimum notice</b><span className="d">Planned leave must be requested this many working days ahead. Sick leave is exempt.</span></span><span className="sr-c"><input id="notice" className="inp" type="number" min="0" max="30" value=${POLICY.notice} aria-label="Minimum notice in days" onChange=${ev => { POLICY.notice = num(ev, 30); touch(); }}/><span style=${{ color: 'var(--muted)', fontSize: 13 }}>days</span></span></div>
      <div className="sr"><span><b>Allow half-day leave</b><span className="d">People can request half a day for a single date.</span></span><span className="sr-c"><${Switch} on=${POLICY.half} set=${v => { POLICY.half = v; touch(); }} label="Allow half-day leave"/></span></div>
      <div className="sr"><span><b>Require a note on every request</b><span className="d">The note field becomes mandatory when applying.</span></span><span className="sr-c"><${Switch} on=${POLICY.note} set=${v => { POLICY.note = v; touch(); }} label="Require a note"/></span></div></div>
    <div style=${{ marginTop: 24, minHeight: 24 }}>${saved && html`<span className="saved"><${Icon} n="check" s=${16}/> Saved. New requests follow these rules.</span>`}</div>
  </div>`;
}

function Holidays({ onChange }) {
  const [d, setD] = useState(''); const [n, setN] = useState('');
  const keys = Object.keys(HOL).sort();
  const add = ev => { ev.preventDefault(); if (!d || !n.trim()) return; HOL[d] = n.trim(); setD(''); setN(''); onChange(); };
  const del = k => { delete HOL[k]; onChange(); };
  return html`<div className="st-w">
    <h2 className="st-h">Holiday calendar</h2><p className="st-p">${keys.length} days off. These show on the Calendar and are skipped when leave days are counted. The list is a sample until the confirmed calendar is added.</p>
    <form className="hol-add" onSubmit=${add}>
      <div className="fld"><label htmlFor="hol-d">Date</label><input id="hol-d" className="inp" type="date" value=${d} onChange=${ev => setD(ev.target.value)}/></div>
      <div className="fld"><label htmlFor="hol-n">Name</label><input id="hol-n" className="inp" value=${n} onChange=${ev => setN(ev.target.value)} placeholder="For example, Pongal"/></div>
      <button className="btn pri" type="submit" disabled=${!d || !n.trim()}>Add holiday</button></form>
    ${keys.map(k => html`<div className=${'hol-r' + (k < TODISO ? ' past' : '')} key=${k}><time>${fmt(k)}</time><span className="nm">${HOL[k]}</span><span className="wk">${WD[new Date(pd(k)).getUTCDay()]}</span>
      <button className="link" onClick=${() => del(k)} aria-label=${'Remove ' + HOL[k]}>Remove</button></div>`)}
  </div>`;
}

export function Settings({ onChange }) {
  const tabs = [['access', 'Access'], ['policy', 'Leave policy'], ['holidays', 'Holidays']];
  const [tab, setTab] = useState('access');
  return html`<div><div className="pg-h"><div><h1>Settings</h1><p>Roles, leave rules and the holiday calendar for the studio.</p></div></div>
    <div className="chips" style=${{ marginTop: 28 }}>${tabs.map(([k, l]) => html`<button key=${k} className=${'chip' + (tab === k ? ' on' : '')} onClick=${() => setTab(k)}>${l}</button>`)}</div>
    ${tab === 'access' ? html`<${Access} onChange=${onChange}/>` : tab === 'policy' ? html`<${Policy} onChange=${onChange}/>` : html`<${Holidays} onChange=${onChange}/>`}</div>`;
}
