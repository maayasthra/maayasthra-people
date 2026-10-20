import { useState, useMemo } from 'react';
import { html, Icon, Av, Photo, Status } from '../ui.jsx';
import { BY, fmt, fmtDM, rel, ago, plural, tenure, tenureText, nextOcc, journey, balances, activeEmps, ROLEMAP } from '../data.js';

export function Profile({ id, from, back, open, openForm, user, role, leaves, ver }) {
  const e = BY[id]; const [copied, setCopied] = useState(false);
  const mgr = BY[e.mgr], team = activeEmps().filter(x => x.mgr === e.n);
  const ten = tenure(e.join), nx = nextOcc(e.join), nxYrs = nx.year - Number(e.join.slice(0, 4));
  const pct = Math.max(4, Math.min(100, Math.round((1 - nx.days / 365) * 100)));
  const bd = nextOcc(e.dob);
  const J = useMemo(() => journey(e), [id, ver]);
  const self = e.n === user.n, canEdit = role === 'admin' || self, canSee = role === 'admin' || self;
  const copy = () => { try { navigator.clipboard.writeText(e.email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {}); } catch (x) {} };
  const Fact = ({ l, children }) => html`<div className="fact"><label>${l}</label><div>${children}</div></div>`;
  const bal = canSee ? balances(leaves.filter(l => l.emp === e.n)) : [];
  return html`<div>
    <button className="back" onClick=${back}><${Icon} n="back" s=${16}/> ${from === 'home' ? 'Home' : from === 'org' ? 'Org chart' : 'People'}</button>
    <div className="prof">
      <${Photo} e=${e}/>
      <div>
        <div style=${{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <h1>${e.name}</h1>
          ${canEdit && html`<button className="btn ghost sm" onClick=${() => openForm(e.n)}><${Icon} n="edit" s=${15}/> ${self && role !== 'admin' ? 'Edit your profile' : 'Edit'}</button>`}</div>
        <div className="prof-r">${e.role}</div>
        <div className="prof-t"><${Status} s=${e.status}/><span className="tag">${e.dept}</span><span className="tag">${e.empId}</span>${role === 'admin' && html`<span className="tag">Access: ${ROLEMAP[e.n]}</span>`}</div>
        ${e.bio && html`<p className="lede" style=${{ maxWidth: '60ch' }}>${e.bio}</p>`}
        <div className="facts">
          <${Fact} l="Employee ID">${e.empId}<//>
          <${Fact} l="Department">${e.dept}<//>
          <${Fact} l="Date of joining">${fmt(e.join)}<//>
          <${Fact} l="Work tenure">${tenureText(e.join)}<//>
          <${Fact} l="Birthday">${fmtDM(e.dob)}${bd.days <= 30 ? ' · ' + rel(bd.days).toLowerCase() : ''}<//>
          <${Fact} l="Reporting manager">${mgr ? html`<button onClick=${() => open(mgr.n)}>${mgr.name}</button>` : 'Founder'}<//>
          <${Fact} l="Employment status">${e.status}<//>
          <${Fact} l="Location">${e.city}, India<//>
          ${e.phone && html`<${Fact} l="Phone">${e.phone}<//>`}
          ${canSee && (e.emergency || e.emergencyPhone) && html`<${Fact} l="Emergency contact">${[e.emergency, e.emergencyPhone].filter(Boolean).join(' · ')}<//>`}
        </div>
        ${self && (!e.phone || !e.emergency) && html`<div className="note-row" style=${{ marginTop: 24 }}><${Icon} n="bell" s=${16}/> Add your phone number and an emergency contact. <button className="link" onClick=${() => openForm(e.n)}>Update now</button></div>`}
      </div>
    </div>

    <div className="lower grid2b">
      <section><div className="sec-h"><h2>Career milestones</h2><span>${J.length} moments</span></div>
        <div className="tl">${J.map((m, i) => html`<div key=${i} className=${'tl-i' + (m.hi ? ' hi' : '') + (m.up ? ' up' : '')}>
          <time>${fmt(m.date)}${m.up ? ' · upcoming' : ''}</time><b>${m.title}</b>${m.note && html`<p>${m.note}</p>`}</div>`)}</div></section>
      <aside>
        <div className="side-sec"><h3>Tenure</h3>
          ${ten.total >= 1 ? html`<div className="ten">${ten.yrs > 0 && html`<b>${ten.yrs}<small>${ten.yrs === 1 ? 'year' : 'years'}</small></b>`}<b>${ten.mos}<small>${ten.mos === 1 ? 'month' : 'months'}</small></b></div>`
            : html`<div className="ten"><b>${ten.days}<small>${ten.days === 1 ? 'day' : 'days'}</small></b></div>`}
          ${nxYrs >= 1 ? html`<div className="bar"><u style=${{ width: pct + '%' }}></u></div><div className="bar-l">${plural(nxYrs, 'year')} on ${fmtDM(e.join)} · ${rel(nx.days).toLowerCase()}</div>`
            : html`<div className="bar-l">First day was ${ago(e.join).toLowerCase()}.</div>`}
        </div>
        ${canSee && html`<div className="side-sec"><h3>Leave balance</h3>${bal.map(b => html`<div className="hl" key=${b.t}>${b.t}<span>${b.left} of ${b.total} left</span></div>`)}</div>`}
        <div className="side-sec"><h3>Reports to</h3>
          ${mgr ? html`<button className="row" style=${{ padding: '8px 0' }} onClick=${() => open(mgr.n)}><${Av} e=${mgr} s=${40}/><span className="row-t"><b>${mgr.name}</b><span>${mgr.role}</span></span></button>` : html`<div className="bar-l" style=${{ margin: 0 }}>Leads the studio.</div>`}
        </div>
        ${team.length > 0 && html`<div className="side-sec"><h3>Team · ${team.length}</h3>
          ${team.slice(0, 6).map(x => html`<button key=${x.n} className="row" style=${{ padding: '8px 0' }} onClick=${() => open(x.n)}><${Av} e=${x} s=${36}/><span className="row-t"><b>${x.name}</b><span>${x.role}</span></span></button>`)}
          ${team.length > 6 && html`<div className="bar-l">and ${team.length - 6} more</div>`}</div>`}
        <div className="side-sec"><h3>Contact</h3>
          <div className="mail"><span>${e.email}</span><button className="btn ghost sm" onClick=${copy}><${Icon} n=${copied ? 'check' : 'copy'} s=${14}/> ${copied ? 'Copied' : 'Copy'}</button></div></div>
      </aside>
    </div>
  </div>`;
}
