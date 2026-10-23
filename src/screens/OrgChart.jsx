import { useState } from 'react';
import { html, Icon, Av, HI } from '../ui.jsx';
import { activeEmps, plural } from '../data.js';

// Leaders at the top, each with a trunk line and an elbow to every team. One column, so nothing shrinks or scrolls sideways.
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

  const Person = ({ e, size = 40 }) => html`<button className=${'oc3-p' + (e.n === user.n ? ' me' : '') + (term && hit(e) ? ' hit' : '')} onClick=${() => open(e.n)}>
    <${Av} e=${e} s=${size}/><span className="row-t"><b>${e.name}</b><span>${e.role}</span></span>${e.n === user.n && html`<em>You</em>`}</button>`;
  const Sub = ({ list }) => html`<ul className="oc3-sub">${list.filter(has).map(x => html`<li key=${x.n}><${Person} e=${x} size=${34}/>${kids(x.n).some(has) && html`<${Sub} list=${kids(x.n)}/>`}</li>`)}</ul>`;

  const block = r => {
    const direct = kids(r.n).filter(has);
    const teams = direct.filter(e => kids(e.n).length > 0), solo = direct.filter(e => kids(e.n).length === 0);
    return html`<section className="oc3-b" key=${r.n}>
      <button className=${'oc3-lead' + (r.n === user.n ? ' me' : '')} onClick=${() => open(r.n)}>
        <${Av} e=${r} s=${56}/><span className="row-t"><b>${r.name}</b><span>${r.role}</span></span>
        ${count(r.n) > 0 && html`<span className="oc3-n">${count(r.n)}<small>${count(r.n) === 1 ? 'person' : 'people'}</small></span>`}</button>
      ${direct.length > 0 && html`<div className="oc3-kids">
        ${teams.map(t => html`<div className="oc3-t" key=${t.n}>
          <div className="oc3-c"><header><${Person} e=${t} size=${44}/><span className="oc3-n">${count(t.n)}<small>${count(t.n) === 1 ? 'person' : 'people'}</small></span></header>
            <ul className="oc3-m">${kids(t.n).filter(has).map(x => html`<li key=${x.n}><${Person} e=${x}/>${kids(x.n).some(has) && html`<${Sub} list=${kids(x.n)}/>`}</li>`)}</ul></div></div>`)}
        ${solo.length > 0 && html`<div className="oc3-t" key="solo"><div className="oc3-c"><header className="oc3-sh"><b>${teams.length ? 'Also reporting to ' + r.name.split(' ')[0] : 'Direct reports'}</b><span>${solo.length}</span></header>
          <ul className="oc3-m">${solo.map(x => html`<li key=${x.n}><${Person} e=${x}/></li>`)}</ul></div></div>`}
      </div>`}
    </section>`;
  };

  const shown = roots.filter(has).sort((a, b) => count(b.n) - count(a.n) || a.name.localeCompare(b.name));
  const teamCount = roots.reduce((s, r) => s + kids(r.n).filter(e => kids(e.n).length > 0).length, 0);
  return html`<div>
    <div className="pg-h" style=${{ alignItems: 'center' }}><div><h1><${HI} n="org" tone="green"/>Org chart</h1><p>${plural(people.length, 'person').replace('persons', 'people')}${teamCount ? ' · ' + plural(teamCount, 'team') : ''}</p></div>
      <div className="search oc3-s"><${Icon} n="search"/><input id="org-search" value=${q} placeholder="Find someone" onChange=${ev => setQ(ev.target.value)} aria-label="Find in org chart"/></div></div>
    <div className="oc3">${shown.map(block)}</div>
    ${term && shown.length === 0 && html`<div className="none"><b>No match</b></div>`}
    ${!term && people.length === 0 && html`<div className="none"><b>No one here yet</b></div>`}
  </div>`;
}
