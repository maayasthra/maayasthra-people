import { useState } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { activeEmps, plural } from '../data.js';

// Teams are laid out as readable cards instead of one wide tree, so nothing has to shrink or scroll.
export function OrgChart({ open, user }) {
  const people = activeEmps();
  const [q, setQ] = useState('');
  const ids = new Set(people.map(e => e.n));
  const kids = n => people.filter(e => e.mgr === n).sort((a, b) => a.name.localeCompare(b.name));
  const roots = people.filter(e => !e.mgr || !ids.has(e.mgr));
  const count = n => kids(n).reduce((s, x) => s + 1 + count(x.n), 0);
  const term = q.trim().toLowerCase();
  const hit = e => !term || (e.name + ' ' + e.role + ' ' + e.dept).toLowerCase().includes(term);
  const has = e => hit(e) || kids(e.n).some(has);

  const Person = ({ e, size = 38 }) => html`<button className=${'oc2-p' + (e.n === user.n ? ' me' : '') + (term && hit(e) ? ' hit' : '')} onClick=${() => open(e.n)}>
    <${Av} e=${e} s=${size}/><span className="row-t"><b>${e.name}</b><span>${e.role}</span></span></button>`;
  const Tree = ({ list }) => html`<ul className="oc2-l">${list.filter(has).map(x => html`<li key=${x.n}><${Person} e=${x}/>${kids(x.n).some(has) && html`<${Tree} list=${kids(x.n)}/>`}</li>`)}</ul>`;

  const lead = roots[0];
  const direct = lead ? kids(lead.n) : [];
  const teams = direct.filter(e => kids(e.n).length > 0 && has(e));
  const solo = direct.filter(e => kids(e.n).length === 0 && has(e));

  return html`<div>
    <div className="pg-h"><div><h1>Org chart</h1><p>${people.length} people in ${plural(teams.length + (solo.length ? 1 : 0), 'group')}. Click anyone to open their profile.</p></div>
      <div className="search" style=${{ margin: 0 }}><${Icon} n="search"/><input id="org-search" value=${q} placeholder="Find a person or role" onChange=${ev => setQ(ev.target.value)} aria-label="Find in org chart"/></div></div>
    ${lead && html`<div className="oc2-top"><button className=${'oc2-lead' + (lead.n === user.n ? ' me' : '')} onClick=${() => open(lead.n)}>
      <${Av} e=${lead} s=${64}/><b>${lead.name}</b><span>${lead.role}</span><small>${count(lead.n)} people across the studio</small></button><i className="oc2-line"></i></div>`}
    <div className="oc2-g">
      ${teams.map(t => html`<section className="oc2-c" key=${t.n}>
        <header><${Person} e=${t} size=${48}/><span className="oc2-n">${count(t.n)}<small>${count(t.n) === 1 ? 'person' : 'people'}</small></span></header>
        <${Tree} list=${kids(t.n)}/></section>`)}
      ${solo.length > 0 && html`<section className="oc2-c" key="solo"><header className="oc2-sh"><b>Reporting directly</b><span>${plural(solo.length, 'person')}</span></header>
        <ul className="oc2-l flat">${solo.map(x => html`<li key=${x.n}><${Person} e=${x}/></li>`)}</ul></section>`}
    </div>
    ${term && teams.length === 0 && solo.length === 0 && !hit(lead) && html`<div className="none"><b>No one matches "${q}"</b>Try a different name or role.</div>`}
  </div>`;
}
