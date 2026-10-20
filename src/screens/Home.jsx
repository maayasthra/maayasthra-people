import { useState, useEffect, useRef } from 'react';
import { html, Icon, Av, Tile, first } from '../ui.jsx';
import { downloadLeaveReport } from '../report.js';
import { DueChip } from '../task/parts.jsx';
import { isOpen } from '../tasks.js';
import { SessionList, useDay, dayNote } from '../Attendance.jsx';
import { hm, lunchInfo, checkIn, checkOut, dayInfo, useNow, clock } from '../attendance.js';
import {
  TOD, DAY, WDL, MONL, pd, fmtDM, fmtDay, rel, plural, range, addMonths, isoOf, TODISO, HOL, BY,
  balances, awayList, isAway, activeEmps, fmtTime, nextOcc, EMP
} from '../data.js';

const LS_C = { pending: '#FF9F0A', approved: '#30D158', declined: '#FF453A' };
const TYPE_ICON = { 'Annual leave': 'sun', 'Casual leave': 'cup', 'Sick leave': 'heart' };
export const typeIcon = t => TYPE_ICON[t] || 'leaves';
export const typeTone = t => t === 'Sick leave' ? 'orange' : t === 'Casual leave' ? 'amber' : 'blue';

/* A fixed-height card so panels in a row line up */
function Panel({ title, sub, right, children }) {
  return html`<section className="pn">
    <header className="pn-h"><div><h2>${title}</h2>${sub && html`<span>${sub}</span>`}</div>${right}</header>
    <div className="pn-b">${children}</div></section>`;
}

/* ---------- Leave approvals: one request at a time, slide with the arrows ---------- */
function ApprovalsCarousel({ queue, setLeaves, open }) {
  const pending = queue.filter(l => l.state === 'pending');
  const [i, setI] = useState(0); const [undo, setUndo] = useState(null);
  const track = useRef(null);
  const n = pending.length;
  useEffect(() => { if (i > n - 1) { const k = Math.max(0, n - 1); setI(k); if (track.current) track.current.scrollTo({ left: k * track.current.clientWidth }); } }, [n]);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 8000); return () => clearTimeout(t); }, [undo]);
  const go = d => { const t = track.current; if (t) t.scrollBy({ left: d * t.clientWidth, behavior: 'smooth' }); };
  const onScroll = () => { const t = track.current; if (t) setI(Math.round(t.scrollLeft / t.clientWidth)); };
  const decide = (l, state) => { setLeaves(ls => ls.map(x => x.id === l.id ? { ...x, state } : x)); setUndo({ id: l.id, state, name: BY[l.emp].name.split(' ')[0] }); };
  const arrows = html`<div className="car-n"><span>${n ? Math.min(i + 1, n) + ' of ' + n : ''}</span>
    <button className="ib" onClick=${() => go(-1)} disabled=${n < 2 || i === 0} aria-label="Previous request"><${Icon} n="chevL" s=${16}/></button>
    <button className="ib" onClick=${() => go(1)} disabled=${n < 2 || i >= n - 1} aria-label="Next request"><${Icon} n="chevR" s=${16}/></button></div>`;
  return html`<${Panel} title="Leave approvals" sub=${n ? n + ' waiting' : 'All clear'} right=${arrows}>
    ${n === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="check" s=${22}/></span><b>All clear</b></div>` :
      html`<div className="car" ref=${track} onScroll=${onScroll}>${pending.map(l => { const e = BY[l.emp]; return html`<div className="slide" key=${l.id}>
        <div className="ap-h"><button onClick=${() => open(e.n)}><${Av} e=${e} s=${44}/></button>
          <span><b>${e.name}</b><span>${e.role}</span></span></div>
        <div className="slide-t"><span className="slide-i"><${Icon} n=${typeIcon(l.type)} s=${16}/></span>${l.type}<em>${plural(l.days, 'day')}</em></div>
        <div className="slide-d">${range(l.from, l.to)}</div>
        <p className="slide-q">${l.reason || 'No note added.'}</p>
        <div className="ap-a" style=${{ margin: 0 }}><button className="btn pri sm" onClick=${() => decide(l, 'approved')}>Approve</button><button className="btn ghost sm" onClick=${() => decide(l, 'declined')}>Decline</button></div>
      </div>`; })}</div>`}
    ${undo && html`<div className="toast" role="status"><span>${undo.state === 'approved' ? 'Approved' : 'Declined'} ${undo.name}'s request.</span>
      <button className="link" onClick=${() => { setLeaves(ls => ls.map(x => x.id === undo.id ? { ...x, state: 'pending' } : x)); setUndo(null); }}>Undo</button></div>`}
  <//>`;
}

function Reviews({ people, open }) {
  const rows = people.filter(e => e.status === 'Probation').map(e => { const d = addMonths(e.join, 3); return { e, d, days: Math.round((pd(d) - TOD) / DAY) }; })
    .filter(x => x.days <= 45).sort((a, b) => a.days - b.days);
  return html`<${Panel} title="Probation" sub="">
    ${rows.length === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="clock" s=${22}/></span><b>None due</b></div>` :
      rows.map(x => html`<button key=${x.e.n} className="row" onClick=${() => open(x.e.n)}><${Av} e=${x.e} s=${38}/>
        <span className="row-t"><b>${x.e.name}</b><span>${x.e.role}</span></span>
        <span className="row-d">${fmtDM(x.d)}<em>${x.days < 0 ? 'Overdue' : rel(x.days)}</em></span></button>`)}
  <//>`;
}

function Birthdays({ open }) {
  const rows = activeEmps().map(e => ({ e, ...nextOcc(e.dob) })).filter(x => x.days <= 30).sort((a, b) => a.days - b.days || a.e.n - b.e.n).slice(0, 7);
  return html`<${Panel} title="Birthdays" sub="">
    ${rows.length === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="star" s=${22}/></span><b>None soon</b></div>` :
      rows.map(x => html`<button key=${x.e.n} className="row" onClick=${() => open(x.e.n)}><${Av} e=${x.e} s=${38}/>
        <span className="row-t"><b>${x.e.name}</b><span>Turns ${x.year - Number(x.e.dob.slice(0, 4))} · ${x.e.dept}</span></span>
        <span className="row-d">${fmtDay(x.t)}<em>${x.days === 0 ? 'Today' : rel(x.days)}</em></span></button>`)}
  <//>`;
}

function Actions({ leaves, go, openForm, compose }) {
  return html`<div className="acts">
    <button className="btn pri" onClick=${() => openForm(null)}><${Icon} n="plus" s=${16}/> Add employee</button>
    <button className="btn ghost" onClick=${compose}><${Icon} n="megaphone" s=${16}/> Announce</button>
    <button className="btn ghost" onClick=${() => downloadLeaveReport(leaves)}><${Icon} n="download" s=${16}/> Report</button>
    <button className="btn ghost" onClick=${() => go('settings')}><${Icon} n="settings" s=${16}/> Policy</button></div>`;
}

const KINDS = {
  general: { label: 'General', icon: 'megaphone', c: '#0A84FF' },
  holiday: { label: 'Holiday', icon: 'sun', c: '#FF9F0A' },
  reminder: { label: 'Reminder', icon: 'bell', c: '#FF453A' },
  celebrate: { label: 'Celebration', icon: 'star', c: '#30D158' }
};

function AnnList({ ann, setAnn, canPost }) {
  return html`<div className="anl">
    ${ann.length === 0 ? html`<div className="empty" style=${{ textAlign: 'left' }}>No announcements right now.</div>` :
      ann.map(a => { const kd = KINDS[a.kind] || KINDS.general; return html`<article className="an" key=${a.id}>
        <span className="an-i" style=${{ '--c': kd.c }}><${Icon} n=${kd.icon} s=${22}/></span>
        <div className="an-b">
          <div className="an-h"><b>${a.title}</b>${canPost && html`<button className="link" onClick=${() => setAnn(x => x.filter(y => y.id !== a.id))} aria-label=${'Remove ' + a.title}>Remove</button>`}</div>
          ${a.body && html`<p>${a.body}</p>`}<small>${kd.label} · ${a.by} · ${fmtDM(a.date)}</small></div></article>`; })}
  </div>`;
}

function Composer({ user, setAnn, close }) {
  const [t, setT] = useState(''); const [b, setB] = useState(''); const [k, setK] = useState('general');
  const post = ev => {
    ev.preventDefault(); if (!t.trim()) return;
    setAnn(a => [{ id: Date.now(), kind: k, title: t.trim(), body: b.trim(), date: TODISO, by: user.name }, ...a]); close();
  };
  return html`<form onSubmit=${post}>
    <div className="fld"><span className="lb">Type</span><div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${Object.entries(KINDS).map(([key, v]) => html`<button type="button" key=${key} className=${'chip' + (k === key ? ' on' : '')} onClick=${() => setK(key)}>${v.label}</button>`)}</div></div>
    <div className="fld"><label htmlFor="ann-t">Headline</label><input id="ann-t" className="inp" value=${t} onChange=${ev => setT(ev.target.value)} placeholder="What do people need to know?"/></div>
    <div className="fld"><label htmlFor="ann-b">Details (optional)</label><textarea id="ann-b" className="inp" value=${b} onChange=${ev => setB(ev.target.value)}></textarea></div>
    <div style=${{ display: 'flex', gap: 10, marginTop: 18 }}><button className="btn pri sm" type="submit" disabled=${!t.trim()}>Post to everyone</button><button className="btn ghost sm" type="button" onClick=${close}>Cancel</button></div></form>`;
}

function NotYet({ att, leaves, open }) {
  const now = useNow(30000), away = awayList(leaves);
  const rows = activeEmps().map(e => ({ e, i: dayInfo(att, e, TODISO, now, away) })).filter(x => x.i.state === 'absent' || x.i.state === 'notyet')
    .sort((a, b) => (b.i.behind - a.i.behind) || a.e.name.localeCompare(b.e.name)).slice(0, 8);
  const closed = HOL[TODISO] || [0, 6].includes(new Date(TOD).getUTCDay());
  return html`<${Panel} title="Not in yet" sub=${rows.length ? rows.length + (rows.length === 1 ? ' person' : ' people') : 'Today'}>
    ${rows.length === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="check" s=${22}/></span><b>${closed ? 'Closed today' : 'Everyone is in'}</b></div>` :
      rows.map(x => html`<button key=${x.e.n} className="row" onClick=${() => open(x.e.n, 'hours')}><${Av} e=${x.e} s=${38}/>
        <span className="row-t"><b>${x.e.name}</b><span>${x.e.dept}</span></span>
        <span className="row-d">${x.i.state === 'absent' ? html`<span className="at-late">${x.i.behind * 60000 < x.i.target ? 'Late ' + x.i.behind + ' min' : 'Absent'}</span>` : 'Starts ' + fmtTime(x.e.shiftStart)}<em>${x.i.state === 'absent' ? 'Shift ' + fmtTime(x.e.shiftStart) : 'Not yet'}</em></span></button>`)}
  <//>`;
}

function AwayWeek({ leaves, open }) {
  const end = isoOf(TOD + 6 * DAY);
  const rows = awayList(leaves).filter(l => BY[l.emp] && BY[l.emp].status !== 'Exited' && l.from <= end && l.to >= TODISO).sort((a, b) => a.from.localeCompare(b.from));
  return html`<${Panel} title="Away">
    ${rows.length === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="calendar" s=${22}/></span><b>Everyone is in</b></div>` :
      rows.map((l, i) => html`<button key=${i} className="row" onClick=${() => open(l.emp)}><${Av} e=${BY[l.emp]} s=${38}/>
        <span className="row-t"><b>${BY[l.emp].name}</b><span>${l.type} · ${range(l.from, l.to)}</span></span>
        <span className="row-d"><em>${BY[l.emp].dept}</em></span></button>`)}
  <//>`;
}

function TeamPanel({ user, open }) {
  const mgr = BY[user.mgr];
  const reports = activeEmps().filter(e => e.mgr === user.n);
  const peers = activeEmps().filter(e => user.mgr && e.mgr === user.mgr && e.n !== user.n);
  const rows = [...(mgr ? [[mgr, 'Reports to']] : []), ...reports.slice(0, 5).map(e => [e, 'Reports to you']), ...peers.slice(0, 6).map(e => [e, 'Teammate'])];
  return html`<${Panel} title="Your team" sub=${rows.length ? rows.length + (rows.length === 1 ? ' person' : ' people') : ''}>
    ${rows.length ? rows.map(([e, l]) => html`<button key=${e.n + l} className="row" onClick=${() => open(e.n)}><${Av} e=${e} s=${38}/><span className="row-t"><b>${e.name}</b><span>${e.role}</span></span><span className="row-d"><em>${l}</em></span></button>`)
      : html`<div className="pn-e"><span className="pn-ei"><${Icon} n="people" s=${22}/></span><b>No team listed yet</b></div>`}
  <//>`;
}

function YourDay({ user, att, setAtt }) {
  const { now, sessions, live, worked } = useDay(user, att);
  const lunch = lunchInfo(now);
  return html`<${Panel} title="Your day" sub=${'Shift ' + fmtTime(user.shiftStart) + ' – ' + fmtTime(user.shiftEnd)}>
    <div className=${'dy-l' + (lunch.state === 'on' ? ' on' : '')}><${Icon} n="cup" s=${16}/> ${lunch.state === 'over' ? 'Lunch was 1:00 – 2:00 PM' : lunch.text}</div>
    <${SessionList} sessions=${sessions} now=${now}/>
    <div className="dy-f"><span>${dayNote(sessions, user)}</span>
      <button className=${'btn sm ' + (live ? 'ghost' : 'pri')} onClick=${() => setAtt(a => live ? checkOut(a, user.n) : checkIn(a, user.n))}>${live ? 'Check out' : sessions.length ? 'Check in again' : 'Check in'}</button></div>
  <//>`;
}

/* ---------- Home ---------- */
export function Home({ role, user, leaves, setLeaves, ann, setAnn, att, setAtt, tasks, goTask, go, openForm, open }) {
  const h = new Date().getHours(), t = new Date(TOD);
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const mine = leaves.filter(l => l.emp === user.n);
  const queue = leaves.filter(l => !l.past && l.emp !== user.n);
  const pending = queue.filter(l => l.state === 'pending').length;
  const people = activeEmps();
  const away = awayList(leaves);
  const dateL = WDL[t.getUTCDay()] + ', ' + t.getUTCDate() + ' ' + MONL[t.getUTCMonth()] + ' ' + t.getUTCFullYear();
  const [composing, setComposing] = useState(false);
  const annRef = useRef(null);
  const compose = () => { setComposing(true); setTimeout(() => annRef.current && annRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };

  if (role === 'admin') {
    const onLeave = people.filter(e => isAway(e.n, TODISO, away)).length;
    const probation = people.filter(e => e.status === 'Probation');
    const due = probation.filter(e => Math.round((pd(addMonths(e.join, 3)) - TOD) / DAY) <= 45).length;
    const depts = new Set(people.map(e => e.dept)).size;
    const nowT = Date.now();
    const infos = people.map(e => dayInfo(att, e, TODISO, nowT, away));
    const inNow = infos.filter(i => i.state === 'in').length;
    const expected = infos.filter(i => !['leave', 'off'].includes(i.state)).length;
    return html`<div>
      <div className="home-h"><div>
      <div className="date-l">${dateL}</div>
      <h1 className="h-greet">${greet}, ${first(user)}.</h1></div>
      <${Actions} leaves=${leaves} go=${go} openForm=${openForm} compose=${compose}/></div>
      <p className="lede">${pending ? html`<span><b>${pending}</b> to review</span>` : 'All clear'}</p>
      <div className="tiles">
        <${Tile} icon="people" tone="blue" label="Headcount" value=${people.length} sub=${depts + ' departments'} onClick=${() => go('people')}/>
        <${Tile} icon="leaves" tone="purple" label="On leave today" value=${onLeave} sub=${HOL[TODISO] ? 'Holiday: ' + HOL[TODISO] : onLeave ? 'away' : 'all in'} onClick=${() => go('calendar')}/>
        <${Tile} icon="requests" tone="orange" hot=${pending > 0} label="Waiting for you" value=${pending} sub="to review" onClick=${() => go('requests')}/>
        <${Tile} icon="check" tone="green" label="Checked in now" value=${inNow} sub=${expected ? 'of ' + expected : 'studio closed today'} onClick=${() => go('attendance')}/>
      </div>
      <section className="eq3 sec">
        <${ApprovalsCarousel} queue=${queue} setLeaves=${setLeaves} open=${open}/>
        <${Reviews} people=${people} open=${open}/>
        <${Birthdays} open=${open}/>
      </section>
      <section className="eq3 sec" ref=${annRef}>
        <${Panel} title="Announcements" sub="" right=${!composing && html`<button className="btn sec2 sm" onClick=${() => setComposing(true)}><${Icon} n="plus" s=${15}/> New</button>`}>
          ${composing ? html`<${Composer} user=${user} setAnn=${setAnn} close=${() => setComposing(false)}/>` : html`<${AnnList} ann=${ann} setAnn=${setAnn} canPost=${true}/>`}
        <//>
        <${AwayWeek} leaves=${leaves} open=${open}/>
        <${NotYet} att=${att} leaves=${leaves} open=${open}/>
      </section>
    </div>`;
  }

  const bal = balances(mine);
  const { sessions, worked, live } = useDay(user, att);
  const hols = Object.keys(HOL).sort().filter(k => k >= TODISO);
  const myOpen = (tasks || []).filter(t => t.cols.includes(user.n) && isOpen(t)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const recent = [...mine].filter(l => !l.past).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 4);
  return html`<div>
    <div className="date-l">${dateL}</div>
    <h1 className="h-greet">${greet}, ${first(user)}.</h1>
    <p className="lede"><span><b>${bal[0].left} days</b> annual leave left${hols[0] ? ' · Next: ' + HOL[hols[0]] + ', ' + fmtDay(pd(hols[0])) : ''}</span></p>
    <div className="tiles">
      ${bal.map(b => html`<${Tile} key=${b.t} icon=${typeIcon(b.t)} tone=${typeTone(b.t)} label=${b.t} value=${b.left} sub=${b.pend ? 'days left · ' + b.pend + ' pending' : 'of ' + b.total + ' days left'} onClick=${() => go('leaves')}/>`)}
      <${Tile} icon="clock" tone="green" label="Worked today" value=${hm(worked)} sub=${live ? 'timer is running' : sessions.length ? 'checked out' : 'not checked in yet'}/>
    </div>
    <section className="eq3 sec">
      <${YourDay} user=${user} att=${att} setAtt=${setAtt}/>
      <${Panel} title="Announcements" sub="From People and Ops"><${AnnList} ann=${ann} setAnn=${setAnn} canPost=${false}/><//>
      <${TeamPanel} user=${user} open=${open}/>
    </section>
    <section className="eq3 sec">
      <${Panel} title="Your tasks" sub=${myOpen.length ? myOpen.length + ' open' : 'All clear'} right=${html`<button className="btn sec2 sm" onClick=${() => goTask(null)}>Open Task</button>`}>
        ${myOpen.length === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="check" s=${22}/></span><b>All clear</b></div>` :
          myOpen.slice(0, 6).map(t => html`<button key=${t.id} className="row" onClick=${() => goTask(t.id)}><span className="row-t"><b>${t.title}</b><span>Card</span></span><span className="row-d"><${DueChip} due=${t.due} done=${t.done}/></span></button>`)}
      <//>
      <${Panel} title="Leave requests" sub=${t.getUTCFullYear()} right=${html`<button className="btn sec2 sm" onClick=${() => go('leaves')}><${Icon} n="plus" s=${15}/> Apply</button>`}>
        ${recent.length === 0 ? html`<div className="pn-e"><span className="pn-ei"><${Icon} n="leaves" s=${22}/></span><b>No requests yet</b><span>Apply for leave and track it here.</span></div>` :
          recent.map(l => html`<div className="hx" key=${l.id}><span className="row-t"><b>${l.type}${l.half ? ' · half day' : ''}</b><span>${range(l.from, l.to)} · ${plural(l.days, 'day')}</span></span>
            <span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span></div>`)}
      <//>
      <${Panel} title="Holidays">
        ${hols.slice(0, 5).map(k => html`<div className="hl" key=${k}>${HOL[k]}<span>${fmtDay(pd(k))} · ${rel(Math.round((pd(k) - TOD) / DAY)).toLowerCase()}</span></div>`)}
      <//>
    </section>
  </div>`;
}
