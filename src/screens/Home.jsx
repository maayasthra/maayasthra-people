import { useState, useMemo, useEffect, useRef } from 'react';
import { html, Icon, Av, first } from '../ui.jsx';
import {
  TOD, DAY, WDL, MONL, pd, fmtDM, fmtDay, rel, plural, range, addMonths, isoOf, TODISO, HOL, BY,
  balances, awayList, isAway, activeEmps, searchPeople
} from '../data.js';

const LS_C = { pending:'#E8B93F', approved:'#46D39A', declined:'#E5736B' };

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

function TimeOff({ mine, go }) {
  const rows = balances(mine);
  const recent = [...mine].filter(l => !l.past).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 2);
  return html`<div className="card" style=${{ padding: '8px 20px 20px' }}>
    <div className="bal">${rows.map(r => html`<div key=${r.t}>${r.t}<span><b>${r.left}</b> days left${r.pend ? ' · ' + r.pend + ' pending' : ''}</span></div>`)}</div>
    ${recent.map(l => html`<div className="hx" key=${l.id} style=${{ paddingBottom: 0, borderBottom: 0 }}><span className="row-t"><b>${l.type}</b><span>${range(l.from, l.to)} · ${plural(l.days, 'day')}</span></span>
      <span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span></div>`)}
    <button className="btn pri" style=${{ marginTop: 18 }} onClick=${() => go('leaves')}>Apply for leave</button></div>`;
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

const KINDS = {
  general: { label: 'General', icon: 'megaphone', c: '#9DB4F5' },
  holiday: { label: 'Holiday', icon: 'sun', c: '#E8B93F' },
  reminder: { label: 'Reminder', icon: 'bell', c: '#FE6D00' },
  celebrate: { label: 'Celebration', icon: 'star', c: '#46D39A' }
};

function Announcements({ ann, setAnn, canPost, user }) {
  const [on, setOn] = useState(false); const [t, setT] = useState(''); const [b, setB] = useState(''); const [k, setK] = useState('general');
  const post = ev => {
    ev.preventDefault(); if (!t.trim()) return;
    setAnn(a => [{ id: Date.now(), kind: k, title: t.trim(), body: b.trim(), date: TODISO, by: user.name }, ...a]);
    setT(''); setB(''); setK('general'); setOn(false);
  };
  return html`<div>
    ${canPost && (on ? html`<form className="card fm" style=${{ marginBottom: 16 }} onSubmit=${post}>
        <div className="fld"><span className="lb">Type</span><div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${Object.entries(KINDS).map(([key, v]) => html`<button type="button" key=${key} className=${'chip' + (k === key ? ' on' : '')} onClick=${() => setK(key)}>${v.label}</button>`)}</div></div>
        <div className="fld"><label htmlFor="ann-t">Headline</label><input id="ann-t" className="inp" value=${t} onChange=${ev => setT(ev.target.value)} placeholder="What do people need to know?"/></div>
        <div className="fld"><label htmlFor="ann-b">Details (optional)</label><textarea id="ann-b" className="inp" value=${b} onChange=${ev => setB(ev.target.value)}></textarea></div>
        <div style=${{ display: 'flex', gap: 10 }}><button className="btn pri" type="submit" disabled=${!t.trim()}>Post to everyone</button><button className="btn ghost" type="button" onClick=${() => setOn(false)}>Cancel</button></div></form>`
      : html`<button className="btn sec2 sm" style=${{ marginBottom: 16 }} onClick=${() => setOn(true)}><${Icon} n="plus" s=${15}/> New announcement</button>`)}
    <div className="anl">
      ${ann.length === 0 ? html`<div className="empty" style=${{ textAlign: 'left' }}>No announcements right now.</div>` :
        ann.map(a => { const kd = KINDS[a.kind] || KINDS.general; return html`<article className="an" key=${a.id}>
          <span className="an-i" style=${{ '--c': kd.c }}><${Icon} n=${kd.icon} s=${22}/></span>
          <div className="an-b">
            <div className="an-h"><b>${a.title}</b>${canPost && html`<button className="link" onClick=${() => setAnn(x => x.filter(y => y.id !== a.id))} aria-label=${'Remove ' + a.title}>Remove</button>`}</div>
            ${a.body && html`<p>${a.body}</p>`}<small>${kd.label} · ${a.by} · ${fmtDM(a.date)}</small></div></article>`; })}
    </div></div>`;
}

function TeamCard({ user, open }) {
  const mgr = BY[user.mgr];
  const reports = activeEmps().filter(e => e.mgr === user.n);
  const peers = activeEmps().filter(e => user.mgr && e.mgr === user.mgr && e.n !== user.n);
  const rows = [...(mgr ? [[mgr, 'Reports to']] : []), ...reports.slice(0, 4).map(e => [e, 'Reports to you']), ...peers.slice(0, 4).map(e => [e, 'Teammate'])];
  return html`<div className="card" style=${{ padding: '8px 12px' }}>${rows.length ? rows.map(([e, l]) => html`<button key=${e.n + l} className="row" onClick=${() => open(e.n)}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role}</span></span><span className="row-d"><em>${l}</em></span></button>`) : html`<div className="empty">No team listed yet.</div>`}</div>`;
}

/* ---------- Home ---------- */
export function Home({ role, user, leaves, setLeaves, ann, setAnn, go, openForm, open }) {
  const h = new Date().getHours(), t = new Date(TOD);
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const mine = leaves.filter(l => l.emp === user.n);
  const queue = leaves.filter(l => !l.past && l.emp !== user.n);
  const pending = queue.filter(l => l.state === 'pending').length;
  const people = activeEmps();
  const away = awayList(leaves);
  const annual = balances(mine)[0];
  const dateL = WDL[t.getUTCDay()] + ', ' + t.getUTCDate() + ' ' + MONL[t.getUTCMonth()] + ' ' + t.getUTCFullYear();
  const nextHol = Object.keys(HOL).sort().find(k => k >= TODISO);

  const head = (lede) => html`<div>
    <div className="date-l">${dateL}</div>
    <h1 className="h-greet">${greet}, ${first(user)}.</h1>
    <p className="lede">${lede}</p>
    <${QuickSearch} open=${open}/>
  </div>`;

  if (role === 'admin') {
    const onLeave = people.filter(e => isAway(e.n, TODISO, away)).length;
    const onProb = people.filter(e => e.status === 'Probation').length;
    const stats = [['Headcount', people.length, plural(new Set(people.map(e => e.dept)).size, 'department')], ['On leave today', onLeave, HOL[TODISO] ? HOL[TODISO] + ' holiday' : 'of ' + people.length], ['Waiting for you', pending, pending === 1 ? 'leave request' : 'leave requests'], ['On probation', onProb, 'reviews below']];
    return html`<div>${head(pending ? html`<span><b>${plural(pending, 'leave request')}</b> ${pending === 1 ? 'is' : 'are'} waiting for you.</span>` : 'Nothing needs your attention right now.')}
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
        <div><div className="sec-h"><h2>Away this week</h2><span>Next 7 days</span></div><${AwayWeek} leaves=${leaves} open=${open}/></div>
      </section>
    </div>`;
  }

  const lede = html`<span>You have <b>${annual.left} days</b> of annual leave left${nextHol ? '. Next holiday is ' + HOL[nextHol] + ' on ' + fmtDay(pd(nextHol)) : ''}.</span>`;
  return html`<div>${head(lede)}
    <section className="sec grid2b">
      <div><div className="sec-h"><h2>Announcements</h2></div><${Announcements} ann=${ann} setAnn=${setAnn} canPost=${false} user=${user}/></div>
      <div>
        <div className="sec-h"><h2>Your time off</h2><span>${t.getUTCFullYear()}</span></div><${TimeOff} mine=${mine} go=${go}/>
        <div className="sec-h" style=${{ marginTop: 40 }}><h2>Your team</h2></div><${TeamCard} user=${user} open=${open}/>
      </div>
    </section>
  </div>`;
}
