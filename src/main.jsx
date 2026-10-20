import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import {
  TOD, DAY, MON, WD, WDL, pd, fmt, fmtDM, fmtDay, nextOcc, rel, ago, tenure, plural, tenureText, range,
  EMP, BY, DEPTS, STATUSES, STAT_C, journey, EVENTS, LEAVES0, MONL, TODISO, isoOf, HOL, TEAM_LEAVES,
  LEAVE_TYPES, HIST0, ADMINS, DEMO_PW, workDays, searchPeople
} from './data.js';
import './styles.css';

const html = htm.bind(React.createElement);

/* ---------- Icons ---------- */
const IC = {
  home:['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  people:['M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20','M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z','M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35','M15.5 5.2a3.5 3.5 0 0 1 0 6.6'],
  calendar:['M4 6.5h16V20H4z','M4 10.5h16','M8 3.5v4','M16 3.5v4'],
  leaves:['M5 19c0-8 5-14 14-14 0 9-6 14-14 14z','M5 19 13 11'],
  requests:['M4 13l2.5-7h11L20 13v6H4z','M4 13h4.5l1 2h5l1-2H20'],
  settings:['M4 7h9','M17 7h3','M4 17h3','M11 17h9','M15 4.5v5','M9 14.5v5'],
  search:['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z','M20 20l-4-4'],
  back:['M15 5l-7 7 7 7'],
  next:['M9 5l7 7-7 7'],
  check:['M5 12.5l4.5 4.5L19 7.5'],
  x:['M6 6l12 12','M18 6L6 18'],
  copy:['M9 9h10v11H9z','M5 15V4h10'],
  pin:['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z','M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  arrow:['M5 12h14','M13 6l6 6-6 6']
};
const Icon = ({ n, s = 18 }) => html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">${IC[n].map((d,i) => html`<path key=${i} d=${d}/>`)}</svg>`;

/* ---------- Portraits (illustrated placeholders until real photos are uploaded) ---------- */
const SKIN = ['#F2CDAA','#E4B38C','#C98E62','#A9703F','#8B5A36','#6C422A'];
const HAIR = ['#17110D','#2A1C13','#3D2A1A','#5A3F28','#1C1C20','#7B7B82'];
const BGS = [['#2E3858','#141A2E'],['#4D2C1B','#1F120B'],['#2D3E3E','#121B1C'],['#3D2E49','#1A1222'],['#43392B','#1C1810'],['#303E2D','#131A12'],['#402C35','#1B1115'],['#2C3242','#12151C']];
const TOPS = ['#0E3594','#2B3140','#E8E4DC','#FE6D00','#1E5E52','#3C2F4D','#47506A','#7A2E3A'];
function Portrait({ e }) {
  const n = e.n, skin = SKIN[(n*5)%6], hc = HAIR[(n*7 + (n>20?1:0))%6], b = (n*3)%8, top = TOPS[(n*5+2)%8];
  const style = (e.g === 'f' ? ['long','bun','bob','long','curly'] : ['short','curly','crop','short','short'])[(n*3)%5];
  const beard = e.g === 'm' && n % 3 === 0, glasses = n % 4 === 1;
  const back = style === 'long' ? html`<path d="M30 56C28 28 72 28 70 56L73 102C60 106 40 106 27 102Z" fill=${hc}/>`
    : style === 'bob' ? html`<path d="M30 56C28 30 72 30 70 56L71 82C60 86 40 86 29 82Z" fill=${hc}/>`
    : style === 'bun' ? html`<circle cx="50" cy="29" r="8" fill=${hc}/>`
    : style === 'curly' ? html`<g fill=${hc}><circle cx="36" cy="42" r="10"/><circle cx="50" cy="35" r="11"/><circle cx="64" cy="42" r="10"/><circle cx="32" cy="54" r="8"/><circle cx="68" cy="54" r="8"/></g>` : null;
  const front = style === 'short' ? html`<path d="M32 55C30 30 70 30 68 55C63 46 56 43 50 43C44 43 37 46 32 55Z" fill=${hc}/>`
    : style === 'crop' ? html`<path d="M33 52C34 36 66 36 67 52C62 44 38 44 33 52Z" fill=${hc} opacity=".92"/>`
    : style === 'curly' ? html`<g fill=${hc}><circle cx="40" cy="41" r="8"/><circle cx="52" cy="37" r="9"/><circle cx="62" cy="42" r="8"/></g>`
    : html`<path d="M32 56C31 33 69 33 68 56C62 44 54 41 50 41C46 41 38 44 32 56Z" fill=${hc}/>`;
  return html`<svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" role="img" aria-label=${'Portrait of ' + e.name}>
    <defs><linearGradient id=${'bg' + b} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color=${BGS[b][0]}/><stop offset="1" stop-color=${BGS[b][1]}/></linearGradient></defs>
    <rect width="100" height="125" fill=${'url(#bg' + b + ')'}/>
    <circle cx="50" cy="48" r="52" fill="#fff" opacity=".04"/>
    ${back}
    <path d="M8 125C8 100 26 90 50 90C74 90 92 100 92 125Z" fill=${top}/>
    <path d="M43 72H57V93Q50 99 43 93Z" fill=${skin}/>
    <path d="M43 72H57V93Q50 99 43 93Z" fill="#000" opacity=".12"/>
    <ellipse cx="33.5" cy="60" rx="2.6" ry="4" fill=${skin}/><ellipse cx="66.5" cy="60" rx="2.6" ry="4" fill=${skin}/>
    <ellipse cx="50" cy="58" rx="17" ry="21" fill=${skin}/>
    ${beard && html`<path d="M33 62C34 84 66 84 67 62C62 72 38 72 33 62Z" fill=${hc} opacity=".92"/>`}
    <circle cx="43" cy="59" r="1.7" fill="#1A1517"/><circle cx="57" cy="59" r="1.7" fill="#1A1517"/>
    <path d="M45 69Q50 72.5 55 69" stroke="#1A1517" strokeWidth="1.3" fill="none" opacity=".55" strokeLinecap="round"/>
    ${front}
    ${glasses && html`<g fill="none" stroke="#0b0b0b" strokeWidth="1.2" opacity=".85"><circle cx="43" cy="59" r="6"/><circle cx="57" cy="59" r="6"/><path d="M49 59h2"/></g>`}
  </svg>`;
}
const Photo = ({ e }) => html`<div className="ph"><${Portrait} e=${e}/></div>`;
const Av = ({ e, s = 40 }) => html`<span className="av" style=${{ width: s, height: s }}><${Portrait} e=${e}/></span>`;
const Status = ({ s, ov }) => html`<span className=${'pill' + (ov ? ' ov' : '')} style=${{ '--c': STAT_C[s] }}><i></i>${s}</span>`;

/* ---------- Quick search ---------- */
function QuickSearch({ open }) {
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

/* ---------- Home ---------- */
function Birthdays({ open }) {
  const list = useMemo(() => EMP.map(e => ({ e, ...nextOcc(e.dob) })).filter(x => x.days <= 30).sort((a,b) => a.days - b.days || a.e.n - b.e.n), []);
  const [wished, setWished] = useState({});
  const f = list[0]; const rest = list.slice(1, 7);
  if (!f) return null;
  const age = f.year - Number(f.e.dob.slice(0,4));
  return html`<div className="card">
    <div className="bfeat">
      <button onClick=${() => open(f.e.n)} aria-label=${'Open ' + f.e.name}><${Photo} e=${f.e}/></button>
      <div>
        <div className=${'eyebrow' + (f.days === 0 ? ' or' : '')}>${f.days === 0 ? 'Birthday today' : 'Next birthday · ' + rel(f.days)}</div>
        <h3>${f.e.name}</h3>
        <p>${f.days === 0 ? 'Turns ' + age + ' today' : 'Turns ' + age + ' on ' + fmtDay(f.t)}</p>
        <p>${f.e.role}</p>
        <button className=${'btn ' + (wished[f.e.n] ? 'ghost' : 'pri')} onClick=${() => setWished(w => ({ ...w, [f.e.n]: !w[f.e.n] }))}>
          ${wished[f.e.n] ? html`<${Icon} n="check" s=${16}/> Wishes sent` : 'Send wishes'}</button>
      </div>
    </div>
    <div className="rows">
      ${rest.map(x => html`<button key=${x.e.n} className="row" onClick=${() => open(x.e.n)}>
        <${Av} e=${x.e} s=${40}/>
        <span className="row-t"><b>${x.e.name}</b><span>${x.e.role}</span></span>
        <span className="row-d">${fmtDay(x.t)}<em>${rel(x.days)}</em></span></button>`)}
    </div>
  </div>`;
}
function Anniversaries({ open }) {
  const list = useMemo(() => EMP.map(e => { const o = nextOcc(e.join); return { e, ...o, yrs: o.year - Number(e.join.slice(0,4)) }; })
    .filter(x => x.yrs >= 1 && x.days <= 30).sort((a,b) => a.days - b.days), []);
  return html`<div className="card"><div className="rows">
    ${list.map(x => html`<button key=${x.e.n} className="row" onClick=${() => open(x.e.n)} style=${{ padding: '14px 12px' }}>
      <span className=${'yrs' + (x.yrs >= 5 ? ' big' : '')}>${x.yrs}<small>${x.yrs === 1 ? 'year' : 'years'}</small></span>
      <span className="row-t"><b>${x.e.name}</b><span>${x.e.role}</span></span>
      <span className="row-d">${fmtDay(x.t)}<em>${rel(x.days)}</em></span></button>`)}
  </div></div>`;
}
function Joiners({ open }) {
  const list = useMemo(() => EMP.filter(e => { const d = (TOD - pd(e.join)) / DAY; return d >= 0 && d <= 100; }).sort((a,b) => pd(b.join) - pd(a.join)), []);
  return html`<div className="rj">${list.map(e => html`<button key=${e.n} onClick=${() => open(e.n)}>
    <${Photo} e=${e}/><b>${e.name}</b><span>${e.role}</span><small>Joined ${fmtDM(e.join)} · ${ago(e.join)}</small></button>`)}</div>`;
}
function Events() {
  const [openId, setOpenId] = useState('e1'); const [going, setGoing] = useState({ e3: true });
  return html`<div className="card" style=${{ padding: '4px 20px' }}>
    ${EVENTS.map(ev => {
      const days = Math.round((pd(ev.date) - TOD) / DAY), d = ev.date.split('-').map(Number), isOpen = openId === ev.id;
      return html`<div className="ev" key=${ev.id}>
        <button className="ev-h" onClick=${() => setOpenId(isOpen ? null : ev.id)} aria-expanded=${isOpen}>
          <span className=${'ev-d' + (days <= 7 ? ' near' : '')}><b>${d[2]}</b><span>${MON[d[1]-1]}</span></span>
          <span className="ev-t"><b>${ev.title}</b><span>${ev.end ? range(ev.date, ev.end) + ' · ' : ''}${ev.time} · ${ev.kind}</span></span>
          <span className="ev-r">${rel(days)}</span>
        </button>
        ${isOpen && html`<div className="ev-b">${ev.desc}
          <div><span className="tag">${ev.where}</span>
            <button className=${'btn sm ' + (going[ev.id] ? 'ghost' : 'sec2')} onClick=${() => setGoing(g => ({ ...g, [ev.id]: !g[ev.id] }))}>
              ${going[ev.id] ? html`<${Icon} n="check" s=${15}/> You're going` : "I'm going"}</button></div></div>`}
      </div>`;
    })}
  </div>`;
}
function Approvals({ leaves, setLeaves, open }) {
  const set = (id, state) => setLeaves(ls => ls.map(l => l.id === id ? { ...l, state } : l));
  const left = leaves.filter(l => l.state === 'pending').length;
  return html`<div className="card" style=${{ padding: '4px 20px' }}>
    ${leaves.map(l => { const e = BY[l.emp]; return html`<div className="ap" key=${l.id}>
      <div className="ap-h"><button onClick=${() => open(e.n)}><${Av} e=${e} s=${36}/></button>
        <span><b>${e.name}</b><span>${l.type} · sent ${l.sent.toLowerCase()}</span></span></div>
      <div className="ap-m"><span className="tag">${range(l.from, l.to)}</span><span className="tag">${plural(l.days, 'day')}</span></div>
      <div className="ap-q">${l.reason}</div>
      <div className="ap-a">
        ${l.state === 'pending' ? html`<button className="btn pri sm" onClick=${() => set(l.id, 'approved')}>Approve</button>
          <button className="btn ghost sm" onClick=${() => set(l.id, 'declined')}>Decline</button>`
        : html`<span className="ap-done"><${Icon} n=${l.state === 'approved' ? 'check' : 'x'} s=${15}/> <b>${l.state === 'approved' ? 'Approved' : 'Declined'}</b>
          <button className="link" onClick=${() => set(l.id, 'pending')}>Undo</button></span>`}
      </div></div>`; })}
    ${left === 0 && html`<div className="empty">You are all caught up.</div>`}
  </div>`;
}
function Balances({ mine }) {
  const rows = LEAVE_TYPES.slice(0, 3).map(([t, total]) => [t, total - mine.filter(l => l.type === t && l.state === 'approved').reduce((n, l) => n + l.days, 0), total]);
  return html`<div className="card" style=${{ padding: '8px 20px' }}><div className="bal">${rows.map(r => html`<div key=${r[0]}>${r[0]}<span>${r[1]} of ${r[2]} days left</span><i><u style=${{ width: (r[1]/r[2]*100) + '%' }}></u></i></div>`)}</div></div>`;
}

function Home({ role, user, mine, leaves, setLeaves, open }) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const t = new Date(TOD);
  const today = EMP.filter(e => e.dob.slice(5) === '10-19');
  const pending = leaves.filter(l => l.state === 'pending').length;
  const bits = [];
  if (today.length) bits.push(today[0].n === user.n ? html`It is <b>your birthday</b> today` : html`<b>${first(today[0])}</b> has a birthday today`);
  if (role === 'admin' && pending) bits.push(html`<b>${plural(pending, 'leave request')}</b> ${pending === 1 ? 'is' : 'are'} waiting for you`);
  const evSoon = EVENTS[0];
  return html`<div>
    <div className="date-l">${WDL[t.getUTCDay()]}, ${t.getUTCDate()} ${['January','February','March','April','May','June','July','August','September','October','November','December'][t.getUTCMonth()]} ${t.getUTCFullYear()}</div>
    <h1 className="h-greet">${greet}, ${first(user)}.</h1>
    <p className="lede">${bits.length ? bits.map((b,i) => html`<span key=${i}>${i > 0 ? ', and ' : ''}${b}</span>`) : 'Nothing needs you right now.'}. ${evSoon.title} is on ${fmtDM(evSoon.date)}.</p>
    <${QuickSearch} open=${open}/>

    <section className="sec"><div className="sec-h"><h2>Celebrations</h2><span>Next 30 days</span></div>
      <div className="grid2b">
        <div><div className="eyebrow" style=${{ marginBottom: 12 }}>Birthdays</div><${Birthdays} open=${open}/></div>
        <div><div className="eyebrow" style=${{ marginBottom: 12 }}>Work anniversaries</div><${Anniversaries} open=${open}/></div>
      </div>
    </section>

    <section className="sec"><div className="sec-h"><h2>Recently joined</h2><span>Last 100 days</span></div><${Joiners} open=${open}/></section>

    <section className="sec"><div className="grid2b">
      <div><div className="sec-h"><h2>Coming up</h2><span>Company events</span></div><${Events}/></div>
      <div>${role === 'admin'
        ? html`<div className="sec-h"><h2>Leave approvals</h2><span>${pending ? pending + ' pending' : 'All clear'}</span></div><${Approvals} leaves=${leaves} setLeaves=${setLeaves} open=${open}/>`
        : html`<div className="sec-h"><h2>Your time off</h2><span>2026</span></div><${Balances} mine=${mine}/>`}</div>
    </div></section>
  </div>`;
}

/* ---------- People ---------- */
function People({ pf, setPf, open }) {
  const list = useMemo(() => {
    let l = searchPeople(pf.q);
    if (pf.dept !== 'All') l = l.filter(e => e.dept === pf.dept);
    if (pf.status !== 'All') l = l.filter(e => e.status === pf.status);
    const s = [...l];
    if (pf.sort === 'name') s.sort((a,b) => a.name.localeCompare(b.name));
    else if (pf.sort === 'new') s.sort((a,b) => pd(b.join) - pd(a.join));
    else s.sort((a,b) => pd(a.join) - pd(b.join));
    return s;
  }, [pf]);
  const cnt = d => searchPeople(pf.q).filter(e => (pf.status === 'All' || e.status === pf.status) && (d === 'All' || e.dept === d)).length;
  const clear = () => setPf({ q: '', dept: 'All', status: 'All', sort: pf.sort });
  return html`<div>
    <div className="pg-h"><div><h1>People</h1><p>${EMP.length} people across ${DEPTS.length} departments, working from ${new Set(EMP.map(e => e.city)).size} cities.</p></div></div>
    <div className="tools">
      <div className="search"><${Icon} n="search"/><input id="people-search" value=${pf.q} placeholder="Search by name, role, city or ID" onChange=${ev => setPf({ ...pf, q: ev.target.value })} aria-label="Search people"/></div>
      <select id="status-filter" className="sel" value=${pf.status} onChange=${ev => setPf({ ...pf, status: ev.target.value })} aria-label="Employment status">
        <option value="All">All statuses</option>${STATUSES.map(s => html`<option key=${s} value=${s}>${s}</option>`)}</select>
      <select id="sort-by" className="sel" value=${pf.sort} onChange=${ev => setPf({ ...pf, sort: ev.target.value })} aria-label="Sort people">
        <option value="name">Name A–Z</option><option value="new">Newest first</option><option value="old">Longest serving</option></select>
    </div>
    <div className="chips" role="tablist" aria-label="Departments">
      ${['All', ...DEPTS].map(d => html`<button key=${d} className=${'chip' + (pf.dept === d ? ' on' : '')} onClick=${() => setPf({ ...pf, dept: d })}>${d}<small>${cnt(d)}</small></button>`)}
    </div>
    <div className="count">${list.length === EMP.length ? 'Showing everyone' : 'Showing ' + list.length + ' of ' + EMP.length}</div>
    ${list.length === 0 ? html`<div className="none"><b>No one matches those filters</b>Try a different name or department.<br/><button className="btn ghost" onClick=${clear}>Clear filters</button></div>` :
    html`<div className="pgrid">${list.map(e => html`<button key=${e.n} className="pc" onClick=${() => open(e.n)}>
      <div className="ph"><${Portrait} e=${e}/><${Status} s=${e.status} ov=${true}/></div>
      <div className="pc-b"><b>${e.name}</b><span>${e.role}</span>
        <div className="pc-f"><span>${e.dept}</span><em>Joined ${fmtDM(e.join)} ${e.join.slice(2,4) === '26' ? '' : "'" + e.join.slice(2,4)}</em></div></div></button>`)}</div>`}
  </div>`;
}

/* ---------- Profile ---------- */
function Profile({ id, from, back, open }) {
  const e = BY[id]; const [copied, setCopied] = useState(false);
  const mgr = BY[e.mgr], team = EMP.filter(x => x.mgr === e.n);
  const ten = tenure(e.join), nx = nextOcc(e.join), nxYrs = nx.year - Number(e.join.slice(0,4));
  const pct = Math.max(4, Math.min(100, Math.round((1 - nx.days / 365) * 100)));
  const bd = nextOcc(e.dob);
  const J = useMemo(() => journey(e), [id]);
  const copy = () => { try { navigator.clipboard.writeText(e.email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {}); } catch (x) {} };
  const Fact = ({ l, children }) => html`<div className="fact"><label>${l}</label><div>${children}</div></div>`;
  return html`<div>
    <button className="back" onClick=${back}><${Icon} n="back" s=${16}/> ${from === 'home' ? 'Home' : 'People'}</button>
    <div className="prof">
      <${Photo} e=${e}/>
      <div>
        <h1>${e.name}</h1>
        <div className="prof-r">${e.role}</div>
        <div className="prof-t"><${Status} s=${e.status}/><span className="tag">${e.dept}</span><span className="tag">${e.empId}</span></div>
        <div className="facts">
          <${Fact} l="Employee ID">${e.empId}<//>
          <${Fact} l="Department">${e.dept}<//>
          <${Fact} l="Date of joining">${fmt(e.join)}<//>
          <${Fact} l="Work tenure">${tenureText(e.join)}<//>
          <${Fact} l="Birthday">${fmtDM(e.dob)}${bd.days <= 30 ? ' · ' + rel(bd.days).toLowerCase() : ''}<//>
          <${Fact} l="Reporting manager">${mgr ? html`<button onClick=${() => open(mgr.n)}>${mgr.name}</button>` : 'Founder'}<//>
          <${Fact} l="Employment status">${e.status}<//>
          <${Fact} l="Location">${e.city}, India<//>
        </div>
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

/* ---------- Calendar ---------- */
const KIND = { holiday:['Holiday','#FE6D00'], event:['Event','#9DB4F5'], birthday:['Birthday','#E8B93F'], anniv:['Anniversary','#46D39A'], leave:['Time off','#B79BF2'] };
const KORDER = ['holiday','event','birthday','anniv','leave'];
const first = e => e.name.split(' ')[0];
function itemsFor(k, away) {
  const y = Number(k.slice(0,4)), md = k.slice(5), out = [], wkd = new Date(pd(k)).getUTCDay();
  if (HOL[k]) out.push({ kind:'holiday', label:HOL[k], short:HOL[k], sub:WDL[wkd] });
  EVENTS.forEach(ev => { if (k >= ev.date && k <= (ev.end || ev.date)) out.push({ kind:'event', label:ev.title, short:ev.title, sub:ev.time + ' · ' + ev.where }); });
  EMP.forEach(e => {
    if (e.dob.slice(5) === md) out.push({ kind:'birthday', label:e.name, short:first(e) + ' · bday', sub:'Turns ' + (y - Number(e.dob.slice(0,4))), emp:e.n });
    const jy = Number(e.join.slice(0,4));
    if (e.join.slice(5) === md && y > jy) out.push({ kind:'anniv', label:e.name, short:first(e) + ' · ' + (y - jy) + ' yr', sub:plural(y - jy, 'year') + ' at Maayasthra', emp:e.n });
  });
  if (wkd !== 0 && wkd !== 6 && !HOL[k]) away.forEach(l => { if (k >= l.from && k <= l.to) out.push({ kind:'leave', label:BY[l.emp].name, short:first(BY[l.emp]) + ' away', sub:l.type + ' until ' + fmtDM(l.to), emp:l.emp }); });
  return out.sort((a, b) => KORDER.indexOf(a.kind) - KORDER.indexOf(b.kind));
}
const Item = ({ it, open }) => {
  const inner = html`<i style=${{ '--c': KIND[it.kind][1] }}></i><span className="it-t"><b>${it.label}</b><small>${KIND[it.kind][0]}${it.sub ? ' · ' + it.sub : ''}</small></span>`;
  return it.emp ? html`<button className="it" onClick=${() => open(it.emp)}>${inner}</button>` : html`<div className="it">${inner}</div>`;
};
function CalendarView({ leaves, open }) {
  const [cur, setCur] = useState({ y: 2026, m: 9 });
  const [sel, setSel] = useState(TODISO);
  const [on, setOn] = useState({ holiday:true, event:true, birthday:true, anniv:true, leave:true });
  const away = useMemo(() => [...TEAM_LEAVES,
    ...leaves.filter(l => l.state === 'approved').map(l => ({ emp:l.emp, type:l.type, from:l.from, to:l.to }))], [leaves]);
  const dim = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(cur.y, cur.m, 1)).getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(isoOf(Date.UTC(cur.y, cur.m, d)));
  while (cells.length % 7) cells.push(null);
  const go = n => {
    const t = new Date(Date.UTC(cur.y, cur.m + n, 1)); const y = t.getUTCFullYear(), m = t.getUTCMonth();
    setCur({ y, m }); setSel(y === 2026 && m === 9 ? TODISO : isoOf(Date.UTC(y, m, 1)));
  };
  const back = () => { setCur({ y: 2026, m: 9 }); setSel(TODISO); };
  const dayItems = itemsFor(sel, away).filter(i => on[i.kind]);
  const selT = pd(sel), sd = rel(Math.round((selT - TOD) / DAY));
  const nextHol = Object.keys(HOL).sort().filter(k => k >= TODISO).slice(0, 4);
  return html`<div>
    <div className="cal-top"><h1>${MONL[cur.m]} <span>${cur.y}</span></h1>
      <div className="cal-nav"><button className="btn ghost" onClick=${back}>Today</button>
        <button className="ib" onClick=${() => go(-1)} aria-label="Previous month"><${Icon} n="back" s=${16}/></button>
        <button className="ib" onClick=${() => go(1)} aria-label="Next month"><${Icon} n="next" s=${16}/></button></div></div>
    <div className="legend">${KORDER.map(k => html`<button key=${k} className=${'lg' + (on[k] ? ' on' : '')} aria-pressed=${on[k]} onClick=${() => setOn({ ...on, [k]: !on[k] })}><i style=${{ '--c': KIND[k][1] }}></i>${({ holiday:'Holidays', event:'Events', birthday:'Birthdays', anniv:'Anniversaries', leave:'Team time off' })[k]}</button>`)}</div>
    <div className="cal">
      <div className="mg">
        <div className="dows">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => html`<span key=${d}>${d}</span>`)}</div>
        <div className="days">${cells.map((k, i) => {
          if (!k) return html`<div key=${'b' + i} className="cell blank"></div>`;
          const its = itemsFor(k, away).filter(x => on[x.kind]), w = new Date(pd(k)).getUTCDay();
          const lv = its.filter(x => x.kind === 'leave'), lab = lv.length ? [...its.filter(x => x.kind !== 'leave'), { kind:'leave', short: lv.length + ' away' }] : its;
          return html`<button key=${k} className=${'cell' + (k === sel ? ' sel' : '') + (k === TODISO ? ' today' : '') + (w === 0 || w === 6 ? ' we' : '')} onClick=${() => setSel(k)} aria-label=${fmtDay(pd(k)) + ', ' + its.length + ' items'}>
            <span className="num">${Number(k.slice(8))}</span>
            ${lab.slice(0, 2).map((x, j) => html`<span key=${j} className=${'cl' + (x.kind === 'holiday' ? ' hol' : '')}><i style=${{ '--c': KIND[x.kind][1] }}></i>${x.short}</span>`)}
            ${lab.length > 2 && html`<span className="cl more">+${lab.length - 2} more</span>`}
            ${its.length > 0 && html`<span className="dots">${its.slice(0, 4).map((x, j) => html`<i key=${j} style=${{ '--c': KIND[x.kind][1] }}></i>`)}</span>`}
          </button>`; })}</div>
      </div>
      <aside className="dp">
        <h2>${WDL[new Date(selT).getUTCDay()]}, ${fmtDM(sel)}</h2>
        <div className="dp-s">${sd}${sel === TODISO ? '' : ' · ' + fmt(sel)}</div>
        <div className="dp-l">${dayItems.length ? dayItems.map((it, i) => html`<${Item} key=${i} it=${it} open=${open}/>`) : html`<div className="empty" style=${{ textAlign: 'left', padding: '22px 0' }}>Nothing on this day.</div>`}</div>
        <div className="dp-n"><h3>Next holidays</h3>${nextHol.map(k => html`<div className="hl" key=${k}>${HOL[k]}<span>${fmtDay(pd(k))}</span></div>`)}</div>
      </aside>
    </div>
  </div>`;
}

/* ---------- My Leaves ---------- */
const LS_C = { pending:'#E8B93F', approved:'#46D39A', declined:'#E5736B' };
function MyLeaves({ leaves, setLeaves, user }) {
  const me = user, mgr = BY[me.mgr] || { name: 'People & Ops' };
  const mine = leaves.filter(l => l.emp === me.n);
  const [f, setF] = useState({ type:'Annual leave', from:'2026-11-23', to:'2026-11-25', reason:'Long weekend with family.' });
  const [sent, setSent] = useState(false);
  const up = p => { setF(o => { const n = { ...o, ...p }; if (n.from && n.to && n.to < n.from && p.from) n.to = n.from; return n; }); setSent(false); };
  const bal = LEAVE_TYPES.map(([t, total]) => {
    const used = mine.filter(l => l.type === t && l.state === 'approved').reduce((s, l) => s + l.days, 0);
    const pend = mine.filter(l => l.type === t && l.state === 'pending').reduce((s, l) => s + l.days, 0);
    return { t, total, used, pend, left: total - used };
  });
  const cur = bal.find(b => b.t === f.type), avail = cur.left - cur.pend;
  const ok = f.from && f.to;
  const wd = ok && f.to >= f.from ? workDays(f.from, f.to) : null;
  let err = '';
  if (ok && f.to < f.from) err = 'The end date is before the start date.';
  else if (ok && f.from < TODISO) err = 'Choose a start date from today onwards.';
  else if (wd && wd.days === 0) err = 'Those dates fall on weekends or holidays only.';
  else if (wd && wd.days > avail) err = 'You have ' + plural(Math.max(avail, 0), 'day') + ' of ' + f.type.toLowerCase() + ' available.';
  const valid = ok && wd && !err;
  const clash = wd ? TEAM_LEAVES.filter(t => t.emp !== me.n && BY[t.emp].dept === me.dept && f.from <= t.to && f.to >= t.from) : [];
  const submit = ev => {
    ev.preventDefault(); if (!valid) return;
    setLeaves(ls => [{ id: Date.now(), emp: me.n, type: f.type, from: f.from, to: f.to, days: wd.days, reason: f.reason.trim(), state: 'pending', sent: 'Just now' }, ...ls]);
    setSent(true);
  };
  const hist = [...mine].sort((a, b) => b.from.localeCompare(a.from));
  return html`<div>
    <div className="pg-h"><div><h1>My Leaves</h1><p>Your balances for 2026 and every request you have sent.</p></div></div>
    <div className="bals">${bal.map(b => html`<div className="bl" key=${b.t}>
      <span className="eyebrow">${b.t}</span><b>${b.left}</b><small>of ${b.total} days left${b.pend > 0 ? html` · <em>${b.pend} pending</em>` : ''}</small>
      <div className="bar"><u style=${{ width: (b.left / b.total * 100) + '%' }}></u></div></div>`)}</div>
    <div className="grid2b" style=${{ marginTop: 48 }}>
      <form className="card fm" onSubmit=${submit}>
        <h2>Apply for leave</h2>
        <div className="fld"><span className="lb">Type</span>
          <div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${bal.map(b => html`<button type="button" key=${b.t} className=${'chip' + (f.type === b.t ? ' on' : '')} onClick=${() => up({ type: b.t })}>${b.t}<small>${b.left - b.pend} left</small></button>`)}</div></div>
        <div className="two">
          <div className="fld"><label htmlFor="lv-from">From</label><input id="lv-from" className="inp" type="date" min=${TODISO} value=${f.from} onChange=${ev => up({ from: ev.target.value })}/></div>
          <div className="fld"><label htmlFor="lv-to">To</label><input id="lv-to" className="inp" type="date" min=${f.from || TODISO} value=${f.to} onChange=${ev => up({ to: ev.target.value })}/></div>
        </div>
        <div className="fld"><label htmlFor="lv-why">Note for ${mgr.name.split(' ')[0]} (optional)</label><textarea id="lv-why" className="inp" value=${f.reason} onChange=${ev => up({ reason: ev.target.value })} placeholder="Add a short reason or handover note"></textarea></div>
        ${sent ? html`<div className="sum"><div className="sent"><${Icon} n="check" s=${18}/><div><strong>Request sent to ${mgr.name}</strong><span className="ok">You will see the decision in this list.</span></div></div></div>`
        : html`<div className="sum">${err ? html`<strong className="err" style=${{ color: '#F08A8A' }}>${err}</strong>`
          : wd ? html`<strong>${plural(wd.days, 'working day')}</strong>${fmtDay(pd(f.from))}${f.to !== f.from ? ' to ' + fmtDay(pd(f.to)) : ''}`
          : html`<strong>Choose your dates</strong>Working days are counted for you.`}
          ${wd && !err && (wd.wk > 0 || wd.hol.length > 0) && html`<p>Not counted: ${[wd.wk ? plural(wd.wk, 'weekend day') : '', ...wd.hol].filter(Boolean).join(', ')}.</p>`}
          ${wd && !err && clash.length > 0 && html`<p className="warn">${clash.map(t => BY[t.emp].name).join(' and ')} in your team ${clash.length === 1 ? 'is' : 'are'} also out during this time.</p>`}</div>`}
        <button className="btn pri" type="submit" disabled=${!valid}>Send for approval</button>
      </form>
      <section><div className="sec-h"><h2>History</h2><span>${plural(hist.length, 'request')}</span></div>
        <div>${hist.map(l => html`<div className="hx" key=${l.id}>
          <span className="row-t"><b>${l.type}</b><span>${range(l.from, l.to)} · ${plural(l.days, 'day')}${l.reason ? ' · ' + l.reason : ''}</span></span>
          <span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span>
          ${l.state === 'pending' && html`<button className="link" onClick=${() => setLeaves(ls => ls.filter(x => x.id !== l.id))}>Withdraw</button>`}</div>`)}</div></section>
    </div>
  </div>`;
}

/* ---------- Requests ---------- */
function Requests({ role, user, leaves: all, setLeaves, open }) {
  const [show, setShow] = useState('pending'); const [selKey, setSelKey] = useState(null);
  const mine = all.filter(l => l.emp === user.n), leaves = all.filter(l => !l.past && l.emp !== user.n);
  if (role !== 'admin') {
    const hist = [...mine].sort((a, b) => b.from.localeCompare(a.from));
    return html`<div><div className="pg-h"><div><h1>Requests</h1><p>Your leave requests and where each one stands.</p></div></div>
      <div style=${{ marginTop: 32, maxWidth: 640 }}>${hist.map(l => html`<div className="hx" key=${l.id}>
        <span className="row-t"><b>${l.type}</b><span>${range(l.from, l.to)} · ${plural(l.days, 'day')}</span></span>
        <span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span></div>`)}
        <p className="bar-l" style=${{ marginTop: 20 }}>Apply for time off from My Leaves. Approvals are visible to admins only.</p></div></div>`;
  }
  const pendingN = leaves.filter(l => l.state === 'pending').length;
  const visible = leaves.filter(l => show === 'pending' ? l.state === 'pending' : l.state !== 'pending');
  const s = leaves.find(l => l.id === selKey) || visible[0];
  const decide = (l, state) => setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state } : x));
  const away = [...TEAM_LEAVES, ...leaves.filter(l => l.state === 'approved')];
  let detail = null;
  if (s) {
    const e = BY[s.emp], wd = workDays(s.from, s.to);
    const peers = away.filter(a => a.emp !== e.n && BY[a.emp].dept === e.dept && s.from <= a.to && s.to >= a.from);
    detail = html`<aside className="card qd">
      <div className="qd-p"><button onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}><${Av} e=${e} s=${44}/></button><span><b>${e.name}</b><span>${e.role}</span></span></div>
      <h2>${s.type}, ${plural(s.days, 'day')}</h2>
      <div className="facts">
        <div className="fact"><label>Dates</label><div>${fmtDay(pd(s.from))}${s.to !== s.from ? ' to ' + fmtDay(pd(s.to)) : ''}</div></div>
        <div className="fact"><label>Working days</label><div>${wd.days}${wd.hol.length ? ' · skips ' + wd.hol.join(', ') : ''}</div></div>
        <div className="fact"><label>Reason</label><div>${s.reason}</div></div>
        <div className="fact"><label>In ${e.dept}</label><div>${peers.length ? peers.map(p => BY[p.emp].name).join(' and ') + ' also out' : 'No one else is out'}</div></div>
      </div>
      <div className="qd-a">${s.state === 'pending'
        ? html`<button className="btn pri" onClick=${() => decide(s, 'approved')}>Approve</button><button className="btn ghost" onClick=${() => decide(s, 'declined')}>Decline</button>`
        : html`<span className="ap-done"><${Icon} n=${s.state === 'approved' ? 'check' : 'x'} s=${15}/> <b>${s.state === 'approved' ? 'Approved' : 'Declined'}</b>
            <button className="link" onClick=${() => decide(s, 'pending')}>Undo</button></span>`}</div>
    </aside>`;
  }
  return html`<div>
    <div className="pg-h"><div><h1>Requests</h1><p>${pendingN ? plural(pendingN, 'leave request') + ' waiting for a decision.' : 'You are all caught up.'}</p></div>
      <div className="seg" style=${{ width: 220, margin: 0 }} role="group" aria-label="Show"><button className=${show === 'pending' ? 'on' : ''} onClick=${() => setShow('pending')}>Pending</button><button className=${show === 'decided' ? 'on' : ''} onClick=${() => setShow('decided')}>Decided</button></div></div>
    <div className="rq">
      <div>${visible.length === 0 ? html`<div className="none" style=${{ padding: '48px 0', textAlign: 'left' }}><b>${show === 'pending' ? 'Nothing is waiting' : 'No decisions yet'}</b>${show === 'pending' ? 'New leave requests will appear here.' : 'Approved and declined requests will be listed here.'}</div>` :
        visible.map(l => html`<button key=${l.id} className=${'qi' + (s && s.id === l.id ? ' sel' : '')} onClick=${() => setSelKey(l.id)}>
          <${Av} e=${BY[l.emp]} s=${40}/>
          <span className="row-t"><b>${BY[l.emp].name}</b><span>${l.type} · ${range(l.from, l.to)} · ${plural(l.days, 'day')}</span></span>
          <span className="row-d" style=${{ color: 'var(--faint)', fontSize: 12 }}>${l.sent}</span></button>`)}</div>
      ${detail}
    </div>
  </div>`;
}

/* ---------- Settings ---------- */
const Switch = ({ on, set, label }) => html`<button type="button" className=${'sw' + (on ? ' on' : '')} role="switch" aria-checked=${on} aria-label=${label} onClick=${() => set(!on)}><i></i></button>`;
const ROLES = ['Employee','Manager','HR','Admin'];
const PERMS = [
  ['See the people directory',[1,1,1,1]],['Apply for leave and see own balances',[1,1,1,1]],['Approve leave for own team',[0,1,1,1]],
  ['Approve leave for everyone',[0,0,1,1]],['See everyone\'s leave balances',[0,0,1,1]],['Edit employee records',[0,0,1,1]],
  ['Manage leave policy and holidays',[0,0,0,1]],['Manage roles',[0,0,0,1]]
];
function Access() {
  const [roles, setRoles] = useState(() => { const m = {}; EMP.forEach(e => { m[e.n] = e.n <= 2 ? 'Admin' : e.n === 26 ? 'HR' : EMP.some(x => x.mgr === e.n) ? 'Manager' : 'Employee'; }); return m; });
  const [q, setQ] = useState('');
  const counts = r => EMP.filter(e => roles[e.n] === r).length;
  const list = searchPeople(q).sort((a, b) => ROLES.indexOf(roles[b.n]) - ROLES.indexOf(roles[a.n]) || a.name.localeCompare(b.name)).slice(0, q.trim() ? 20 : 8);
  return html`<div className="st-w" style=${{ maxWidth: 900 }}>
    <h2 className="st-h">What each role can do</h2><p className="st-p">Everyone starts as an Employee. Managers approve for their own team, HR and Admins approve for the whole studio.</p>
    <div className="mx"><table><thead><tr><th></th>${ROLES.map(r => html`<th key=${r}>${r}<small>${plural(counts(r), 'person').replace('persons', 'people')}</small></th>`)}</tr></thead>
      <tbody>${PERMS.map(([l, v]) => html`<tr key=${l}><td>${l}</td>${v.map((x, i) => html`<td key=${i}>${x ? html`<${Icon} n="check" s=${17}/>` : '–'}</td>`)}</tr>`)}</tbody></table></div>
    <div className="st-s"><h2 className="st-h">Who has which role</h2><p className="st-p">Search for anyone to change their role.</p>
      <div className="search" style=${{ maxWidth: 'none', marginBottom: 8 }}><${Icon} n="search"/><input id="role-search" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Search by name or department" aria-label="Search people to change role"/></div>
      ${list.map(e => html`<div className="pr" key=${e.n}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role} · ${e.dept}</span></span>
        <select className="sel" value=${roles[e.n]} aria-label=${'Role for ' + e.name} onChange=${ev => setRoles({ ...roles, [e.n]: ev.target.value })}>${ROLES.map(r => html`<option key=${r} value=${r}>${r}</option>`)}</select></div>`)}
      ${list.length === 0 && html`<div className="empty" style=${{ textAlign: 'left' }}>No one matches "${q}".</div>`}
      <div className="bar-l">${q.trim() ? 'Showing ' + list.length + ' result' + (list.length === 1 ? '' : 's') : 'Showing 8 of ' + EMP.length + ' people. Search to find anyone.'}</div></div>
  </div>`;
}
function Policy() {
  const [al, setAl] = useState({ 'Annual leave':18, 'Casual leave':8, 'Sick leave':8, 'Comp-off':2 });
  const [t, setT] = useState({ carry:true, half:true, note:false, hrs:false });
  const [notice, setNotice] = useState(3); const [saved, setSaved] = useState(false);
  const touch = () => setSaved(false);
  const T = (k, l, d) => html`<div className="sr"><span><b>${l}</b><span className="d">${d}</span></span><span className="sr-c"><${Switch} on=${t[k]} set=${v => { setT({ ...t, [k]: v }); touch(); }} label=${l}/></span></div>`;
  return html`<div className="st-w">
    <h2 className="st-h">Yearly allowances</h2><p className="st-p">Days each person receives per leave year, from 1 January.</p>
    ${Object.keys(al).map(k => html`<div className="sr" key=${k}><span><b>${k}</b></span><span className="sr-c"><input id=${'al-' + k.split(' ')[0]} className="inp" type="number" min="0" max="60" value=${al[k]} aria-label=${k + ' days per year'} onChange=${ev => { setAl({ ...al, [k]: Math.max(0, Number(ev.target.value) || 0) }); touch(); }}/><span style=${{ color: 'var(--muted)', fontSize: 13 }}>days</span></span></div>`)}
    <div className="st-s"><h2 className="st-h">Rules</h2><p className="st-p" style=${{ marginBottom: 6 }}>Applied to every new leave request.</p>
      <div className="sr"><span><b>Minimum notice</b><span className="d">Requests for planned leave need to be sent this many working days ahead. Sick leave is exempt.</span></span><span className="sr-c"><input id="notice" className="inp" type="number" min="0" max="30" value=${notice} aria-label="Minimum notice in days" onChange=${ev => { setNotice(Math.max(0, Number(ev.target.value) || 0)); touch(); }}/><span style=${{ color: 'var(--muted)', fontSize: 13 }}>days</span></span></div>
      ${T('carry', 'Carry forward unused annual leave', 'Up to 5 days move into the next leave year.')}
      ${T('half', 'Allow half-day leave', 'People can request a morning or afternoon off.')}
      ${T('note', 'Require a note on every request', 'The reason field becomes mandatory when applying.')}
      ${T('hrs', 'Send sick leave over 2 days to HR', 'HR sees it alongside the manager.')}</div>
    <div style=${{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16 }}><button className="btn pri" onClick=${() => setSaved(true)}>Save policy</button>${saved && html`<span className="saved"><${Icon} n="check" s=${16}/> Saved</span>`}</div>
  </div>`;
}
function Holidays({ onHol }) {
  const [d, setD] = useState(''); const [n, setN] = useState('');
  const keys = Object.keys(HOL).sort();
  const add = ev => { ev.preventDefault(); if (!d || !n.trim()) return; HOL[d] = n.trim(); setD(''); setN(''); onHol(); };
  const del = k => { delete HOL[k]; onHol(); };
  return html`<div className="st-w">
    <h2 className="st-h">Holiday calendar</h2><p className="st-p">${keys.length} days off. These show on the Calendar and are skipped when leave days are counted.</p>
    <form className="hol-add" onSubmit=${add}>
      <div className="fld"><label htmlFor="hol-d">Date</label><input id="hol-d" className="inp" type="date" value=${d} onChange=${ev => setD(ev.target.value)}/></div>
      <div className="fld"><label htmlFor="hol-n">Name</label><input id="hol-n" className="inp" value=${n} onChange=${ev => setN(ev.target.value)} placeholder="For example, Pongal"/></div>
      <button className="btn pri" type="submit" disabled=${!d || !n.trim()}>Add holiday</button></form>
    ${keys.map(k => html`<div className=${'hol-r' + (k < TODISO ? ' past' : '')} key=${k}><time>${fmt(k)}</time><span className="nm">${HOL[k]}</span><span className="wk">${WD[new Date(pd(k)).getUTCDay()]}</span>
      <button className="link" onClick=${() => del(k)} aria-label=${'Remove ' + HOL[k]}>Remove</button></div>`)}
  </div>`;
}
function Reminders() {
  const [o, setO] = useState({ bday:true, anniv:true, event:true, leave:true }); const [who, setWho] = useState('Whole studio');
  const R = (k, l, d) => html`<div className="sr" key=${k}><span><b>${l}</b><span className="d">${d}</span></span><span className="sr-c"><${Switch} on=${o[k]} set=${v => setO({ ...o, [k]: v })} label=${l}/></span></div>`;
  return html`<div className="st-w"><h2 className="st-h">Reminders</h2><p className="st-p">Choose what you hear about on Home and by email.</p>
    ${R('bday', 'Birthdays', 'A reminder on the morning of each birthday.')}
    ${R('anniv', 'Work anniversaries', 'A reminder on the day, with the number of years.')}
    ${R('event', 'Company events', 'A reminder the day before each event.')}
    ${R('leave', 'Leave decisions', 'A message when one of your requests is approved or declined.')}
    <div className="sr"><span><b>Show birthdays and anniversaries for</b></span><span className="sr-c"><select id="who" className="sel" style=${{ height: 38, minWidth: 150, fontSize: 13.5 }} value=${who} onChange=${ev => setWho(ev.target.value)} aria-label="Whose celebrations to show">${['Whole studio','My department','Only my team'].map(x => html`<option key=${x} value=${x}>${x}</option>`)}</select></span></div></div>`;
}
function Settings({ role, onHol }) {
  const tabs = role === 'admin' ? [['access','Access'],['policy','Leave policy'],['holidays','Holidays'],['reminders','Reminders']] : [['reminders','Reminders']];
  const [tab, setTab] = useState('access');
  const cur = tabs.some(x => x[0] === tab) ? tab : tabs[0][0];
  return html`<div><div className="pg-h"><div><h1>Settings</h1><p>${role === 'admin' ? 'Roles, leave rules and the holiday calendar for the studio.' : 'Your personal preferences.'}</p></div></div>
    <div className="chips" style=${{ marginTop: 28 }}>${tabs.map(([k, l]) => html`<button key=${k} className=${'chip' + (cur === k ? ' on' : '')} onClick=${() => setTab(k)}>${l}</button>`)}</div>
    ${cur === 'access' ? html`<${Access}/>` : cur === 'policy' ? html`<${Policy}/>` : cur === 'holidays' ? html`<${Holidays} onHol=${onHol}/>` : html`<${Reminders}/>`}</div>`;
}

/* ---------- Login ---------- */
function Login({ onLogin }) {
  const [mode, setMode] = useState('employee'); const [view, setView] = useState('signin');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const check = (em, p, md) => {
    const e = EMP.find(x => x.email === em.trim().toLowerCase());
    if (!em.trim()) return 'Enter your work email.';
    if (!e) return 'We could not find that email in the studio directory.';
    if (!p) return 'Enter your password.';
    if (p !== DEMO_PW) return 'That password does not match. Try again.';
    if (md === 'admin' && !ADMINS.includes(e.n)) return 'This account does not have HR or admin access.';
    return e;
  };
  const run = (em, p, md) => {
    const r = check(em, p, md);
    if (typeof r === 'string') { setErr(r); return; }
    setErr(''); setBusy(true); setTimeout(() => onLogin(r, md === 'admin' ? 'admin' : 'employee'), 650);
  };
  const demo = (n, md) => { const e = BY[n]; setMode(md); setEmail(e.email); setPw(DEMO_PW); run(e.email, DEMO_PW, md); };
  const submit = ev => { ev.preventDefault(); if (!busy) run(email, pw, mode); };
  const forgot = ev => { ev.preventDefault(); if (!email.trim()) { setErr('Enter your work email.'); return; } setErr(''); setSent(true); };
  const art = [3, 10, 6, 17, 14];
  return html`<div className="lg-wrap">
    <section className="lg-art">
      <div className="brand" style=${{ padding: 0 }}><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>
      <div className="lg-copy"><h1>Everyone at Maayasthra, in one place.</h1><p>Find a colleague, see who is away, and manage your time off from one quiet workspace.</p></div>
      <div><div className="lg-mos" aria-hidden="true">${art.map(n => html`<div key=${n}><${Photo} e=${BY[n]}/></div>`)}</div><div className="lg-url" style=${{ marginTop: 28 }}>people.maayasthra.com</div></div>
    </section>
    <section className="lg-form"><div className="lg-box">
      ${view === 'signin' ? html`<${React.Fragment}>
        <h2>Sign in</h2><p>Use your Maayasthra work email.</p>
        <div className="seg" role="group" aria-label="Sign in as"><button type="button" className=${mode === 'employee' ? 'on' : ''} onClick=${() => { setMode('employee'); setErr(''); }}>Employee</button><button type="button" className=${mode === 'admin' ? 'on' : ''} onClick=${() => { setMode('admin'); setErr(''); }}>HR and Admin</button></div>
        <form onSubmit=${submit} noValidate>
          <div className="fld"><label htmlFor="login-email">Work email</label><input id="login-email" className="inp" type="email" autoComplete="username" placeholder="name@maayasthra.com" value=${email} onChange=${ev => setEmail(ev.target.value)}/></div>
          <div className="fld"><label htmlFor="login-pw">Password</label><div className="pw"><input id="login-pw" className="inp" type=${show ? 'text' : 'password'} autoComplete="current-password" value=${pw} onChange=${ev => setPw(ev.target.value)}/><button type="button" className="pw-b" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button></div></div>
          <div className="lg-row"><button type="button" className="link" onClick=${() => { setView('forgot'); setErr(''); setSent(false); }}>Forgot password?</button></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit" disabled=${busy}>${busy ? 'Signing in' : mode === 'admin' ? 'Sign in as HR or Admin' : 'Sign in'}</button>
        </form>
        <div className="lg-demo"><h3>Try a demo account</h3>
          <button className="dm" onClick=${() => demo(2, 'admin')} disabled=${busy}><${Av} e=${BY[2]} s=${38}/><span className="row-t"><b>Meera Iyer</b><span>HR and Admin · approves leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <button className="dm" onClick=${() => demo(9, 'employee')} disabled=${busy}><${Av} e=${BY[9]} s=${38}/><span className="row-t"><b>Dev Malhotra</b><span>Employee · applies for leave</span></span><span className="go"><${Icon} n="arrow" s=${16}/></span></button>
          <div className="lg-note">Prototype only. The demo password is ${DEMO_PW}.</div></div>
      <//>` : html`<${React.Fragment}>
        <button className="back" onClick=${() => { setView('signin'); setErr(''); }}><${Icon} n="back" s=${16}/> Back to sign in</button>
        <h2>Reset your password</h2><p>Enter your work email and we will send a reset link.</p>
        <form onSubmit=${forgot} noValidate>
          <div className="fld"><label htmlFor="reset-email">Work email</label><input id="reset-email" className="inp" type="email" placeholder="name@maayasthra.com" value=${email} onChange=${ev => { setEmail(ev.target.value); setSent(false); }}/></div>
          ${err && html`<div className="lg-err" role="alert">${err}</div>`}
          <button className="btn pri" type="submit">Send reset link</button>
          ${sent && html`<div className="lg-ok" role="status"><${Icon} n="check" s=${16}/> If that email is in the directory, a reset link is on its way. This prototype does not send email.</div>`}
        </form><//>`}
    </div></section>
  </div>`;
}

/* ---------- Placeholder screens ---------- */
const SOON = {
  settings: ['Settings', 'Roles and permissions, leave policies, holiday lists and notification preferences.']
};
const Soon = ({ k }) => html`<div className="soon"><div className="ic"><${Icon} n=${k} s=${22}/></div><h1>${SOON[k][0]}</h1><p>${SOON[k][1]}</p><span className="tag">Next in the build</span></div>`;

/* ---------- Shell ---------- */
const NAV = [['home','Home'],['people','People'],['calendar','Calendar'],['leaves','My Leaves'],['requests','Requests'],['settings','Settings']];
function App() {
  const [nav, setNav] = useState({ view: 'home' });
  const [auth, setAuth] = useState(null);
  const [leaves, setLeaves] = useState(() => [...LEAVES0.map(l => ({ ...l, state: 'pending' })), ...HIST0]);
  const [pf, setPf] = useState({ q: '', dept: 'All', status: 'All', sort: 'name' });
  const [, setHv] = useState(0);
  if (!auth) return html`<${Login} onLogin=${(user, role) => { setNav({ view: 'home' }); setAuth({ user, role }); window.scrollTo({ top: 0 }); }}/>`;
  const user = auth.user, role = auth.role;
  const mine = leaves.filter(l => l.emp === user.n);
  const queue = leaves.filter(l => !l.past && l.emp !== user.n);
  const top = () => window.scrollTo({ top: 0 });
  const go = v => { setNav({ view: v }); top(); };
  const open = id => { setNav(p => ({ view: 'profile', id, from: p.view === 'profile' ? p.from : p.view })); top(); };
  const back = () => { setNav({ view: nav.from || 'people' }); top(); };
  const signOut = () => { setAuth(null); setNav({ view: 'home' }); top(); };
  const active = nav.view === 'profile' ? (nav.from || 'people') : nav.view;
  const pending = role === 'admin' ? queue.filter(l => l.state === 'pending').length : 0;
  const screen = nav.view === 'home' ? html`<${Home} role=${role} user=${user} mine=${mine} leaves=${queue} setLeaves=${setLeaves} open=${open}/>`
    : nav.view === 'people' ? html`<${People} pf=${pf} setPf=${setPf} open=${open}/>`
    : nav.view === 'profile' ? html`<${Profile} key=${nav.id} id=${nav.id} from=${nav.from} back=${back} open=${open}/>`
    : nav.view === 'calendar' ? html`<${CalendarView} leaves=${leaves} open=${open}/>`
    : nav.view === 'leaves' ? html`<${MyLeaves} leaves=${leaves} setLeaves=${setLeaves} user=${user}/>`
    : nav.view === 'requests' ? html`<${Requests} role=${role} user=${user} leaves=${leaves} setLeaves=${setLeaves} open=${open}/>`
    : nav.view === 'settings' ? html`<${Settings} role=${role} onHol=${() => setHv(v => v + 1)}/>`
    : html`<${Soon} k=${nav.view}/>`;
  const brand = html`<div className="brand"><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>`;
  return html`<div className="app">
    <aside className="side">${brand}
      <nav className="nav" aria-label="Main">${NAV.map(([k, l]) => html`<button key=${k} className=${'nav-b' + (active === k ? ' on' : '')} onClick=${() => go(k)} aria-current=${active === k ? 'page' : undefined}>
        <${Icon} n=${k}/>${l}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
      <div className="side-foot">
        <button className="me" onClick=${() => open(user.n)} aria-label="Open your profile"><${Av} e=${user} s=${36}/><span><b>${user.name}</b><span>${role === 'admin' ? 'HR and Admin' : 'Employee'}</span></span></button>
        <button className="btn ghost sm" style=${{ margin: '0 12px' }} onClick=${signOut}>Sign out</button></div>
    </aside>
    <div className="col">
      <div className="topbar">${brand}<button className="btn ghost sm" onClick=${signOut}>Sign out</button></div>
      <main className="main" key=${nav.view + (nav.id || '')}>${screen}</main>
    </div>
    <nav className="bnav" aria-label="Main">${NAV.map(([k, l]) => html`<button key=${k} className=${active === k ? 'on' : ''} onClick=${() => go(k)}>
      <${Icon} n=${k} s=${21}/>${l.replace('My ', '')}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
  </div>`;
}
createRoot(document.getElementById('root')).render(html`<${App}/>`);
