import { useState, useMemo, useEffect, useRef } from 'react';
import { html, Icon, Av, first } from '../ui.jsx';
import {
  TOD, DAY, WDL, MONL, pd, fmtDM, fmtDay, rel, plural, range, addMonths, isoOf, TODISO, HOL, BY,
  balances, awayList, isAway, activeEmps, searchPeople
} from '../data.js';

const LS_C = { pending:'#E8B93F', approved:'#46D39A', declined:'#E5736B' };
const statusOf = (e, presence, away) => closedToday() ? 'closed' : isAway(e.n, TODISO, away) ? 'away' : (presence[e.n] || 'office');
const closedToday = () => { const w = new Date(TOD).getUTCDay(); return w === 0 || w === 6 ? 'weekend' : HOL[TODISO] || ''; };

/* ---------- Quick search ---------- */
export function QuickSearch({ open }) {
  const [q, setQ] = useState(''); const [hi, setHi] = useState(0); const [on, setOn] = useState(false);
  const ref = useRef(null);
  const res = useMemo(() => q.trim() ? searchPeople(q).slice(0, 6) : [], [q]);
  useEffect(() => {
    const f = ev => { if (ev.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { ev.preventDefault(); ref.current && ref.current.focus(); } };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, []);
  const pick = e => { setQ(''); setOn(false); open(e.n); };
  const key = ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setHi(h => Math.min(h + 1, res.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (ev.key === 'Enter' && res[hi]) pick(res[hi]);
    else if (ev.key === 'Escape') { setOn(false); ev.target.blur(); }
  };
  return html`<div className="qs">
    <${Icon} n="search"/>
    <input ref=${ref} id="quick-search" className="qs-in" value=${q} placeholder="Find anyone by name or role"
      onChange=${ev => { setQ(ev.target.value); setHi(0); }} onFocus=${() => setOn(true)} onBlur=${() => setOn(false)} onKeyDown=${key} autoComplete="off" aria-label="Quick employee search"/>
    <kbd>/</kbd>
    ${on && q.trim() && html`<div className="qs-dd">
      ${res.length === 0 ? html`<div className="qs-e">No one matches "${q}".</div>` :
        res.map((e, i) => html`<button key=${e.n} className=${'qs-r' + (i === hi ? ' hi' : '')} onMouseDown=${ev => { ev.preventDefault(); pick(e); }} onMouseEnter=${() => setHi(i)}>
          <${Av} e=${e} s=${36}/><span><b>${e.name}</b><span>${e.role} · ${e.dept}</span></span></button>`)}
    </div>`}
  </div>`;
}

/* ---------- Shared cards ---------- */
function Stack({ list, open, max = 6 }) {
  return html`<div className="stack">${list.slice(0, max).map(e => html`<button key=${e.n} onClick=${() => open(e.n)} title=${e.name} aria-label=${e.name}><${Av} e=${e} s=${32}/></button>`)}
    ${list.length > max && html`<span className="more">+${list.length - max}</span>`}</div>`;
}

function TodayCard({ user, leaves, presence, setPresence, open }) {
  const away = awayList(leaves), closed = closedToday();
  const g = { office: [], wfh: [], away: [] };
  activeEmps().forEach(e => { const k = statusOf(e, presence, away); if (g[k]) g[k].push(e); });
  const mine = statusOf(user, presence, away);
  const cols = [['office', 'In the studio'], ['wfh', 'At home'], ['away', 'On leave']];
  return html`<div className="card" style=${{ padding: 22 }}>
    ${closed ? html`<div className="note-row"><${Icon} n="calendar" s=${16}/> ${closed === 'weekend' ? 'The studio is closed for the weekend.' : 'The studio is closed today for ' + closed + '.'}</div>` : null}
    <div className="tcounts">${cols.map(([k, l]) => html`<div key=${k}><b>${g[k].length}</b><span>${l}</span></div>`)}</div>
    ${g.wfh.length > 0 && html`<div className="tg"><span>Working from home</span><${Stack} list=${g.wfh} open=${open}/></div>`}
    ${g.away.length > 0 && html`<div className="tg"><span>On leave</span><${Stack} list=${g.away} open=${open}/></div>`}
    <div className="tme"><span>Where are you today?</span>
      ${closed ? html`<span className="tag">No need to check in today</span>` : mine === 'away' ? html`<span className="tag">You are on approved leave</span>` :
      html`<div className="seg" style=${{ width: 250, margin: 0 }} role="group" aria-label="Your status today">
        <button className=${mine === 'office' ? 'on' : ''} onClick=${() => setPresence(p => ({ ...p, [user.n]: 'office' }))}>In the studio</button>
        <button className=${mine === 'wfh' ? 'on' : ''} onClick=${() => setPresence(p => ({ ...p, [user.n]: 'wfh' }))}>Home</button></div>`}
    </div>
  </div>`;
}

function AwayWeek({ leaves, open }) {
  const end = isoOf(TOD + 6 * DAY);
  const rows = awayList(leaves).filter(l => BY[l.emp] && BY[l.emp].status !== 'Exited' && l.from <= end && l.to >= TODISO).sort((a, b) => a.from.localeCompare(b.from));
  return html`<div className="card" style=${{ padding: '8px 12px' }}>
    ${rows.length === 0 ? html`<div className="empty">No one is away in the next 7 days.</div>` :
      rows.map((l, i) => html`<button key=${i} className="row" onClick=${() => open(l.emp)}><${Av} e=${BY[l.emp]} s=${38}/>
        <span className="row-t"><b>${BY[l.emp].name}</b><span>${l.type} · ${range(l.from, l.to)}</span></span>
        <span className="row-d"><em>${BY[l.emp].dept}</em></span></button>`)}
  </div>`;
}

function Holidays3() {
  const list = Object.keys(HOL).sort().filter(k => k >= TODISO).slice(0, 3);
  return html`<div className="card" style=${{ padding: '4px 20px' }}>${list.map(k => html`<div className="hl" key=${k}>${HOL[k]}<span>${fmtDay(pd(k))} · ${rel(Math.round((pd(k) - TOD) / DAY)).toLowerCase()}</span></div>`)}</div>`;
}

function Balances({ mine, go }) {
  const rows = balances(mine);
  return html`<div className="card" style=${{ padding: '8px 20px 20px' }}><div className="bal">${rows.map(r => html`<div key=${r.t}>${r.t}<span>${r.left} of ${r.total} days left${r.pend ? ' · ' + r.pend + ' pending' : ''}</span><i><u style=${{ width: Math.max(0, r.left / r.total * 100) + '%' }}></u></i></div>`)}</div>
    <button className="btn pri" style=${{ marginTop: 8 }} onClick=${() => go('leaves')}>Apply for leave</button></div>`;
}

function Recent({ mine, go }) {
  const list = [...mine].filter(l => !l.past).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 3);
  if (!list.length) return null;
  return html`<div style=${{ marginTop: 20 }}><div className="eyebrow" style=${{ marginBottom: 6 }}>Your recent requests</div>
    ${list.map(l => html`<div className="hx" key=${l.id}><span className="row-t"><b>${l.type}</b><span>${range(l.from, l.to)} · ${plural(l.days, 'day')}</span></span>
      <span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span></div>`)}
    <button className="link" onClick=${() => go('leaves')}>See all in My Leaves</button></div>`;
}

export function Approvals({ queue, setLeaves, open }) {
  const set = (id, state) => setLeaves(ls => ls.map(l => l.id === id ? { ...l, state } : l));
  const left = queue.filter(l => l.state === 'pending').length;
  return html`<div className="card" style=${{ padding: '4px 20px' }}>
    ${queue.map(l => { const e = BY[l.emp]; return html`<div className="ap" key=${l.id}>
      <div className="ap-h"><button onClick=${() => open(e.n)}><${Av} e=${e} s=${36}/></button>
        <span><b>${e.name}</b><span>${l.type} · sent ${l.sent.toLowerCase()}</span></span></div>
      <div className="ap-m"><span className="tag">${range(l.from, l.to)}</span><span className="tag">${plural(l.days, 'day')}</span></div>
      ${l.reason && html`<div className="ap-q">${l.reason}</div>`}
      <div className="ap-a">
        ${l.state === 'pending' ? html`<button className="btn pri sm" onClick=${() => set(l.id, 'approved')}>Approve</button>
          <button className="btn ghost sm" onClick=${() => set(l.id, 'declined')}>Decline</button>`
        : html`<span className="ap-done"><${Icon} n=${l.state === 'approved' ? 'check' : 'x'} s=${15}/> <b>${l.state === 'approved' ? 'Approved' : 'Declined'}</b>
          <button className="link" onClick=${() => set(l.id, 'pending')}>Undo</button></span>`}
      </div></div>`; })}
    ${left === 0 && html`<div className="empty">You are all caught up.</div>`}
  </div>`;
}

function Reviews({ people, open }) {
  const rows = people.filter(e => e.status === 'Probation').map(e => { const d = addMonths(e.join, 3); return { e, d, days: Math.round((pd(d) - TOD) / DAY) }; })
    .filter(x => x.days <= 45).sort((a, b) => a.days - b.days);
  return html`<div className="card" style=${{ padding: '8px 12px' }}>
    ${rows.length === 0 ? html`<div className="empty">No probation reviews are coming up.</div>` :
      rows.map(x => html`<button key=${x.e.n} className="row" onClick=${() => open(x.e.n)}><${Av} e=${x.e} s=${38}/>
        <span className="row-t"><b>${x.e.name}</b><span>${x.e.role}</span></span>
        <span className="row-d">${fmtDM(x.d)}<em>${x.days < 0 ? 'Overdue by ' + plural(-x.days, 'day') : rel(x.days)}</em></span></button>`)}
  </div>`;
}

function Announcements({ ann, setAnn, canPost, user }) {
  const [on, setOn] = useState(false); const [t, setT] = useState(''); const [b, setB] = useState('');
  const post = ev => {
    ev.preventDefault(); if (!t.trim()) return;
    setAnn(a => [{ id: Date.now(), title: t.trim(), body: b.trim(), date: TODISO, by: user.name }, ...a]);
    setT(''); setB(''); setOn(false);
  };
  return html`<div>
    ${canPost && (on ? html`<form className="card fm" style=${{ marginBottom: 16 }} onSubmit=${post}>
        <div className="fld"><label htmlFor="ann-t">Headline</label><input id="ann-t" className="inp" value=${t} onChange=${ev => setT(ev.target.value)} placeholder="What do people need to know?"/></div>
        <div className="fld"><label htmlFor="ann-b">Details (optional)</label><textarea id="ann-b" className="inp" value=${b} onChange=${ev => setB(ev.target.value)}></textarea></div>
        <div style=${{ display: 'flex', gap: 10 }}><button className="btn pri" type="submit" disabled=${!t.trim()}>Post to everyone</button><button className="btn ghost" type="button" onClick=${() => setOn(false)}>Cancel</button></div></form>`
      : html`<button className="btn sec2 sm" style=${{ marginBottom: 16 }} onClick=${() => setOn(true)}><${Icon} n="plus" s=${15}/> New announcement</button>`)}
    <div className="card" style=${{ padding: '4px 20px' }}>
      ${ann.length === 0 ? html`<div className="empty">No announcements right now.</div>` :
        ann.map(a => html`<div className="an" key=${a.id}>
          <div className="an-h"><b>${a.title}</b>${canPost && html`<button className="link" onClick=${() => setAnn(x => x.filter(y => y.id !== a.id))} aria-label=${'Remove ' + a.title}>Remove</button>`}</div>
          ${a.body && html`<p>${a.body}</p>`}<small>${a.by} · ${fmtDM(a.date)}</small></div>`)}
    </div></div>`;
}

function TeamCard({ user, open }) {
  const mgr = BY[user.mgr];
  const reports = activeEmps().filter(e => e.mgr === user.n);
  const peers = activeEmps().filter(e => e.mgr === user.mgr && e.n !== user.n && user.mgr);
  const Row = ({ e, label }) => html`<button className="row" onClick=${() => open(e.n)}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role}</span></span><span className="row-d"><em>${label}</em></span></button>`;
  const rows = [...(mgr ? [[mgr, 'Reports to']] : []), ...reports.slice(0, 4).map(e => [e, 'Your team']), ...peers.slice(0, 3).map(e => [e, 'Teammate'])];
  return html`<div className="card" style=${{ padding: '8px 12px' }}>${rows.length ? rows.map(([e, l]) => html`<${Row} key=${e.n + l} e=${e} label=${l}/>`) : html`<div className="empty">No team listed yet.</div>`}</div>`;
}

/* ---------- Home ---------- */
export function Home({ role, user, isMgr, leaves, setLeaves, ann, setAnn, presence, setPresence, go, openForm, open }) {
  const h = new Date().getHours(), t = new Date(TOD);
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const mine = leaves.filter(l => l.emp === user.n);
  const all = leaves.filter(l => !l.past && l.emp !== user.n);
  const queue = role === 'admin' ? all : isMgr ? all.filter(l => BY[l.emp] && BY[l.emp].mgr === user.n) : [];
  const pending = queue.filter(l => l.state === 'pending').length;
  const people = activeEmps();
  const scope = role === 'admin' ? people : people.filter(e => e.mgr === user.n);
  const away = awayList(leaves);
  const annual = balances(mine)[0];
  const dateL = WDL[t.getUTCDay()] + ', ' + t.getUTCDate() + ' ' + MONL[t.getUTCMonth()] + ' ' + t.getUTCFullYear();

  const bits = [];
  if (pending) bits.push(html`<b>${plural(pending, 'leave request')}</b> ${pending === 1 ? 'is' : 'are'} waiting for you`);
  if (role !== 'admin' && !isMgr) bits.push(html`You have <b>${annual.left} days</b> of annual leave left`);
  const lede = bits.length ? bits.map((b, i) => html`<span key=${i}>${i > 0 ? '. ' : ''}${b}</span>`) : 'Nothing needs your attention right now';

  const head = html`<div>
    <div className="date-l">${dateL}</div>
    <h1 className="h-greet">${greet}, ${first(user)}.</h1>
    <p className="lede">${lede}.</p>
    <${QuickSearch} open=${open}/>
  </div>`;

  if (role === 'admin') {
    const g = { office: 0, wfh: 0, away: 0 };
    people.forEach(e => { const k = statusOf(e, presence, away); if (k in g) g[k]++; });
    const shut = closedToday();
    const stats = [['Headcount', people.length, plural(new Set(people.map(e => e.dept)).size, 'department')], ['In the studio', g.office, shut ? 'studio closed today' : 'today'], ['At home', g.wfh, 'today'], ['On leave', g.away, 'today']];
    return html`<div>${head}
      <div className="bals">${stats.map(([l, n, s]) => html`<div className="bl" key=${l}><span className="eyebrow">${l}</span><b>${n}</b><small>${s}</small></div>`)}</div>
      <section className="sec grid2b">
        <div><div className="sec-h"><h2>Leave approvals</h2><span>${pending ? pending + ' pending' : 'All clear'}</span></div><${Approvals} queue=${queue} setLeaves=${setLeaves} open=${open}/></div>
        <div>
          <div className="sec-h"><h2>Probation reviews</h2><span>Next 45 days</span></div><${Reviews} people=${people} open=${open}/>
          <div className="sec-h" style=${{ marginTop: 40 }}><h2>Quick actions</h2></div>
          <div className="qa"><button className="btn sec2" onClick=${() => openForm(null)}><${Icon} n="plus" s=${16}/> Add employee</button>
            <button className="btn ghost" onClick=${() => go('requests')}><${Icon} n="download" s=${16}/> Leave report</button>
            <button className="btn ghost" onClick=${() => go('settings')}>Leave policy</button></div>
        </div>
      </section>
      <section className="sec grid2b">
        <div><div className="sec-h"><h2>Announcements</h2><span>Visible to everyone</span></div><${Announcements} ann=${ann} setAnn=${setAnn} canPost=${true} user=${user}/></div>
        <div>
          <div className="sec-h"><h2>Today</h2><span>Studio presence</span></div><${TodayCard} user=${user} leaves=${leaves} presence=${presence} setPresence=${setPresence} open=${open}/>
          <div className="sec-h" style=${{ marginTop: 40 }}><h2>Away this week</h2></div><${AwayWeek} leaves=${leaves} open=${open}/>
        </div>
      </section>
    </div>`;
  }

  return html`<div>${head}
    ${isMgr && html`<section className="sec grid2b">
      <div><div className="sec-h"><h2>Team approvals</h2><span>${pending ? pending + ' pending' : 'All clear'}</span></div><${Approvals} queue=${queue} setLeaves=${setLeaves} open=${open}/></div>
      <div><div className="sec-h"><h2>Probation reviews</h2><span>Your team</span></div><${Reviews} people=${scope} open=${open}/></div>
    </section>`}
    <section className="sec grid2b">
      <div><div className="sec-h"><h2>Today</h2><span>Studio presence</span></div><${TodayCard} user=${user} leaves=${leaves} presence=${presence} setPresence=${setPresence} open=${open}/></div>
      <div><div className="sec-h"><h2>Your time off</h2><span>${t.getUTCFullYear()}</span></div><${Balances} mine=${mine} go=${go}/><${Recent} mine=${mine} go=${go}/></div>
    </section>
    <section className="sec"><div className="sec-h"><h2>Announcements</h2><span>From People and Ops</span></div><${Announcements} ann=${ann} setAnn=${setAnn} canPost=${false} user=${user}/></section>
    <section className="sec grid2b">
      <div><div className="sec-h"><h2>Away this week</h2><span>Next 7 days</span></div><${AwayWeek} leaves=${leaves} open=${open}/></div>
      <div><div className="sec-h"><h2>Upcoming holidays</h2></div><${Holidays3}/>
        <div className="sec-h" style=${{ marginTop: 40 }}><h2>Your team</h2></div><${TeamCard} user=${user} open=${open}/></div>
    </section>
  </div>`;
}
