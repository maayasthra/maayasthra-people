import { useState, useMemo } from 'react';
import { html, Icon, Av, Photo } from '../ui.jsx';
import { HoursPanel } from './Hours.jsx';
import { BY, fmtTime, fmt, fmtDM, rel, ago, plural, tenureText, nextOcc, journey, balances, activeEmps, ROLEMAP } from '../data.js';

const Row = ({ k, children }) => html`<div className="pf2-row"><span>${k}</span><div>${children}</div></div>`;

export function Profile({ id, tab: tab0, from, back, open, openForm, user, role, leaves, att, setAtt, ver }) {
  const e = BY[id]; const [copied, setCopied] = useState(false); const [tab, setTab] = useState(tab0 === 'hours' ? 'hours' : 'overview');
  const J = useMemo(() => e ? journey(e) : [], [id, ver]);
  if (!e) return html`<div><button className="back" onClick=${back}><${Icon} n="back" s=${16}/> Back</button><div className="none"><b>This person is no longer in the directory</b></div></div>`;
  const mgr = BY[e.mgr], team = activeEmps().filter(x => x.mgr === e.n);
  const self = e.n === user.n, canEdit = role === 'admin' || self, canSee = role === 'admin' || self;
  const bd = nextOcc(e.dob), bal = canSee ? balances(leaves.filter(l => l.emp === e.n)) : [];
  const copy = () => { try { navigator.clipboard.writeText(e.email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {}); } catch (x) {} };
  const isAdminRole = ROLEMAP[e.n] === 'Admin';

  return html`<div className="pf2">
    <button className="back" onClick=${back}><${Icon} n="back" s=${16}/> ${from === 'home' ? 'Home' : from === 'org' ? 'Org chart' : from === 'members' ? 'Members' : 'Back'}</button>

    <section className="pf2-hero">
      <div className="pf2-ph"><${Photo} e=${e}/></div>
      <div className="pf2-id">
        <div className="pf2-t"><h1>${e.name}</h1>${e.status === 'Exited' && html`<span className="tag">Former employee</span>`}${isAdminRole && role === 'admin' && html`<span className="tag">Admin</span>`}</div>
        <p className="pf2-r">${e.role}</p>
        <div className="pf2-chips">
          ${e.dept && html`<span><${Icon} n="building" s=${14}/>${e.dept}</span>`}
          ${e.city && html`<span><${Icon} n="pin" s=${14}/>${e.city}</span>`}
          <span><${Icon} n="clock" s=${14}/>${fmtTime(e.shiftStart)} – ${fmtTime(e.shiftEnd)}</span>
        </div>
        ${e.bio && html`<p className="pf2-bio">${e.bio}</p>`}
      </div>
      <div className="pf2-act">
        ${canEdit && html`<button className="btn pri" onClick=${() => openForm(e.n)}><${Icon} n="edit" s=${15}/> ${self ? 'Edit profile' : 'Edit'}</button>`}
        <button className="btn sec2" onClick=${copy}><${Icon} n=${copied ? 'check' : 'copy'} s=${15}/> ${copied ? 'Copied' : 'Copy email'}</button>
      </div>
    </section>

    ${self && (!e.phone || !e.emergency) && html`<div className="note-row" style=${{ marginTop: 20 }}><${Icon} n="bell" s=${16}/> <span>Add your phone number and an emergency contact so the team can reach you.</span> <button className="link" onClick=${() => openForm(e.n)}>Add now</button></div>`}

    ${canSee && html`<div className="seg seg-t" role="group" aria-label="Profile section"><button className=${tab === 'overview' ? 'on' : ''} onClick=${() => setTab('overview')}><${Icon} n="user" s=${15}/>Overview</button><button className=${tab === 'hours' ? 'on' : ''} onClick=${() => setTab('hours')}><${Icon} n="clock" s=${15}/>Hours</button></div>`}

    ${tab === 'hours' && canSee ? html`<div style=${{ marginTop: 24 }}><${HoursPanel} emp=${e} att=${att} setAtt=${setAtt} leaves=${leaves} canEdit=${role === 'admin' && e.n !== user.n} editor=${user}/></div>` : html`<div className="pf2-grid">
      <section className="pf2-card"><h2>Work</h2>
        <${Row} k="Employee ID">${e.empId}<//>
        <${Row} k="Department">${e.dept || '–'}<//>
        <${Row} k="Reports to">${mgr ? html`<button className="pf2-lk" onClick=${() => open(mgr.n)}>${mgr.name}</button>` : 'No one'}<//>
        <${Row} k="Joined">${e.join ? fmt(e.join) : '–'}<//>
        <${Row} k="With Maayasthra">${e.join ? tenureText(e.join) : '–'}<//>
        <${Row} k="Status">${e.status}<//>
      </section>

      <section className="pf2-card"><h2>Personal</h2>
        <${Row} k="Birthday">${e.dob ? fmtDM(e.dob) + (bd.days <= 30 ? ' · ' + rel(bd.days).toLowerCase() : '') : '–'}<//>
        <${Row} k="Location">${e.city ? e.city + ', India' : '–'}<//>
        <${Row} k="Email"><span className="pf2-em">${e.email}</span><//>
        ${canSee && html`<${Row} k="Phone">${e.phone || '–'}<//>`}
        ${canSee && html`<${Row} k="Emergency contact">${[e.emergency, e.emergencyPhone].filter(Boolean).join(' · ') || '–'}<//>`}
      </section>

      ${canSee && html`<section className="pf2-card"><h2>Leave this year</h2>
        ${bal.map(b => html`<${Row} k=${b.t} key=${b.t}><b>${b.left}</b> of ${b.total} days left${b.pend ? html` <small className="pf2-sm">· ${b.pend} pending</small>` : ''}<//>`)}
      </section>`}

      <section className="pf2-card"><h2>Team</h2>
        ${mgr ? html`<div className="pf2-sub">Reports to</div><button className="pf2-p" onClick=${() => open(mgr.n)}><${Av} e=${mgr} s=${38}/><span className="row-t"><b>${mgr.name}</b><span>${mgr.role}</span></span></button>` : html`<p className="pf2-none">Leads the studio.</p>`}
        ${team.length > 0 && html`<div className="pf2-sub">${plural(team.length, 'direct report')}</div>${team.slice(0, 6).map(x => html`<button key=${x.n} className="pf2-p" onClick=${() => open(x.n)}><${Av} e=${x} s=${38}/><span className="row-t"><b>${x.name}</b><span>${x.role}</span></span></button>`)}${team.length > 6 && html`<p className="pf2-none">and ${team.length - 6} more</p>`}`}
      </section>

      ${J.length > 0 && html`<section className="pf2-card pf2-wide"><h2>Career milestones</h2>
        <div className="tl">${J.map((m, i) => html`<div key=${i} className=${'tl-i' + (m.hi ? ' hi' : '') + (m.up ? ' up' : '')}><time>${fmt(m.date)}${m.up ? ' · upcoming' : ''}</time><b>${m.title}</b>${m.note && html`<p>${m.note}</p>`}</div>`)}</div></section>`}
    </div>`}
  </div>`;
}
