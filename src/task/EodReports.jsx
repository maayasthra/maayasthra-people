import { useState, useEffect } from 'react';
import { html, Icon, Av, Tile, HI } from '../ui.jsx';
import { dayKey, addDays, weekStart, monthDays, getDay } from '../attendance.js';
import { activeEmps, plural, HOL, fmtDM, pd, TODISO, ROLEMAP } from '../data.js';
import { CopyEod } from './CopyEod.jsx';
import { loadEods, fmtH, hoursOf } from '../eodDb.js';
import { trackedRange, rangeDays } from '../eodTrack.js';
import { HoursByPerson, HoursByDay, HoursByProject } from './EodHours.jsx';
import { subscribeTables } from '../tasksDb.js';
import { IS_DEMO } from '../env.js';

const isWorking = iso => { const w = new Date(pd(iso)).getUTCDay(); return w !== 0 && w !== 6 && !HOL[iso]; };
export const dayLabel = iso => new Date(pd(iso)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function Report({ r }) {
  const hrs = r.total > 0;
  return html`<div className=${'er-t' + (hrs ? '' : ' nh')} role="table">
    <div className="er-hd" role="row"><span>Project</span><span>Description</span>${hrs && html`<span>Time</span>`}</div>
    ${r.rows.map((x, i) => html`<div key=${i}>
      <div className="er-r" role="row"><b>${x.project}</b><span>${x.desc || (x.subs && x.subs.length ? '' : '—')}</span>${hrs && html`<span className="er-h">${fmtH(x.subs && x.subs.length ? x.subs.reduce((t, s) => t + s.hours, 0) : x.hours)}</span>`}</div>
      ${(x.subs || []).map((s, j) => html`<div className="er-r er-s" role="row" key=${j}><span>${s.title}</span><span>${s.desc || '—'}</span>${hrs && html`<span className="er-h">${fmtH(s.hours)}</span>`}</div>`)}
    </div>`)}
  </div>`;
}

// EOD reports. Everyone reads their own; admins and project managers read everyone's. Reports are sent when checking out.
export function EodReports({ user, role, tick, onEditToday, checkedIn, att, tasks }) {
  const mgr = role === 'admin' || role === 'pm';
  const [view, setView] = useState('day'), [day, setDay] = useState(dayKey());
  const [list, setList] = useState(null), [err, setErr] = useState(''), [openK, setOpenK] = useState(mgr ? null : user.n), [rev, setRev] = useState(0);
  const range = view === 'day' ? [day, day] : view === 'week' ? [weekStart(day), addDays(weekStart(day), 6)] : (() => { const d = pd(day), md = monthDays(new Date(d).getUTCFullYear(), new Date(d).getUTCMonth()); return [md[0], md[md.length - 1]]; })();
  const [from, to] = range;

  useEffect(() => {
    let live = true; setErr('');
    loadEods(from, to).then(l => { if (live) setList(l); }).catch(e => { if (live) { setErr(e.message); setList([]); } });
    return () => { live = false; };
  }, [from, to, tick, rev]);
  useEffect(() => { if (IS_DEMO) return; return subscribeTables('mp-eod', ['eod_reports'], () => setRev(v => v + 1)); }, []);

  const people = activeEmps().filter(e => mgr || e.n === user.n);
  const by = {}; (list || []).forEach(r => { (by[r.emp] = by[r.emp] || []).push(r); });
  const rows = people.filter(e => by[e.n]).map(e => ({ e, reps: by[e.n].sort((a, b) => b.day.localeCompare(a.day)), total: by[e.n].reduce((t, r) => t + r.total, 0) }))
    .sort((a, b) => b.total - a.total || a.e.name.localeCompare(b.e.name));
  // Only people who checked in that day are expected to send one
  const missing = view === 'day' && mgr && day <= TODISO ? people.filter(e => (ROLEMAP[e.n] || 'Employee') === 'Employee' && !by[e.n] && getDay(att, e.n, day).sessions.length > 0) : [];
  const total = rows.reduce((t, r) => t + r.total, 0);
  // Hours charts: reported (from the reports) beside tracked (from the Start / Pause timers on task cards)
  const hmM = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + m; };
  const shiftH = e => Math.max(0, (hmM(e.shiftEnd) - hmM(e.shiftStart)) / 60);
  const trk = trackedRange(tasks || [], from, to), trkOf = n => Object.values(trk[n] || {}).reduce((t, x) => t + x, 0) / 3600000;
  const spanDays = rangeDays(from, to < TODISO ? to : TODISO).filter(isWorking), allDays = rangeDays(from, to);
  const personData = people.map(e => ({ e, rep: (by[e.n] || []).reduce((t, r) => t + r.total, 0), trk: trkOf(e.n), target: shiftH(e) * spanDays.length })).filter(d => d.rep > 0 || d.trk > 0).sort((a, b) => b.rep - a.rep || b.trk - a.trk);
  const trkTotal = personData.reduce((t, d) => t + d.trk, 0);
  const repByDay = {}, trkByDay = {};
  (list || []).forEach(r => { if (people.some(e => e.n === r.emp)) repByDay[r.day] = (repByDay[r.day] || 0) + r.total; });
  people.forEach(e => Object.entries(trk[e.n] || {}).forEach(([d, ms]) => { trkByDay[d] = (trkByDay[d] || 0) + ms; }));
  const projects = (() => {
    const m = new Map();
    (list || []).forEach(r => { if (!people.some(e => e.n === r.emp)) return; r.rows.forEach(x => { const k = String(x.project || '').trim().toLowerCase().replace(/\s+/g, ' '); if (!k) return; const h = hoursOf(x); const c = m.get(k) || { name: String(x.project).trim(), h: 0 }; c.h += h; m.set(k, c); }); });
    const all = [...m.values()].filter(x => x.h > 0).sort((a, b) => b.h - a.h), top = all.slice(0, 8), rest = all.slice(8).reduce((t, x) => t + x.h, 0);
    return rest > 0 ? [...top, { name: 'Other projects', h: rest, other: true }] : top;
  })();
  const projTotal = projects.reduce((t, x) => t + x.h, 0);
  const anyHours = total > 0 || trkTotal > 0;
  const step = n => setDay(d => view === 'day' ? addDays(d, n) : view === 'week' ? addDays(d, 7 * n) : (() => { const t = new Date(pd(d)); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + n, 1)).toISOString().slice(0, 10); })());
  const title = view === 'day' ? (day === dayKey() ? 'Today' : dayLabel(day)) : view === 'week' ? fmtDM(from) + ' – ' + fmtDM(to) : new Date(pd(from)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const mine = by[user.n] && by[user.n].find(r => r.day === dayKey());

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="timer" tone="green"/>EOD reports</h1><p>${mgr ? 'What everyone worked on, and for how long' : 'What you reported, and the time you tracked'}</p></div>
      ${html`<div className="seg" role="group" aria-label="Period">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => html`<button key=${k} className=${view === k ? 'on' : ''} onClick=${() => setView(k)}>${l}</button>`)}</div>`}</div>
    ${html`<div className="er-nav"><button className="ib" onClick=${() => step(-1)} aria-label="Earlier"><${Icon} n="chevL" s=${16}/></button><b>${title}</b>
      <button className="ib" onClick=${() => step(1)} aria-label="Later" disabled=${range[1] >= TODISO}><${Icon} n="next" s=${16}/></button>
      ${day !== dayKey() && html`<button className="btn ghost sm" onClick=${() => setDay(dayKey())}>Today</button>`}
      <span style=${{ flex: 1 }}></span>
      ${!mgr && view === 'day' && day === dayKey() && (checkedIn || mine) && html`<button className="btn sec2 sm" onClick=${onEditToday}>${mine ? 'Update today’s report' : 'Write today’s report'}</button>`}</div>`}
    <div className="tiles">
      <${Tile} icon="timer" tone="green" label="Hours reported" value=${fmtH(total)} sub=${title.toLowerCase()}/>
      <${Tile} icon="clock" tone="blue" label="Hours tracked" value=${fmtH(trkTotal)} sub="on task cards"/>
      <${Tile} icon="people" tone="purple" label=${mgr ? 'Reports sent' : 'Days reported'} value=${view === 'day' ? rows.length : rows.reduce((t, r) => t + r.reps.length, 0)} sub=${title.toLowerCase()}/>
      ${mgr ? html`<${Tile} icon="requests" tone="orange" label="Not sent" value=${missing.length} sub=${view === 'day' ? 'checked in, no report yet' : 'pick a day to see who'}/>`
        : html`<${Tile} icon="board" tone="orange" label="Average a day" value=${rows.length && rows[0].reps.length ? fmtH(total / rows[0].reps.length) : '0h'} sub=${title.toLowerCase()}/>`}
    </div>
    ${list !== null && anyHours && html`<div className="eh">
      ${mgr && personData.length > 0 && html`<${HoursByPerson} data=${personData} days=${spanDays.length} onOpen=${n => { setOpenK(n); setTimeout(() => { const el = document.getElementById('er-p-' + n); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }}/>`}
      <div className="eh-g">
        ${view !== 'day' && html`<${HoursByDay} days=${allDays} rep=${repByDay} trk=${trkByDay} target=${mgr ? 0 : shiftH(user)} who=${mgr ? 'The whole team, day by day' : 'Your reported and tracked time, day by day'}/>`}
        ${projects.length > 0 && html`<${HoursByProject} items=${projects} total=${projTotal}/>`}
      </div>
    </div>`}
    ${!mgr && checkedIn && !mine && html`<div className="er-nav"><span style=${{ flex: 1 }}></span><button className="btn sec2 sm" onClick=${onEditToday}>Write today’s report</button></div>`}
    ${err && html`<div className="eod-e" role="alert">${err}</div>`}
    <div className="ph3">
      ${list === null && html`<div className="none">Loading…</div>`}
      ${list !== null && rows.length === 0 && html`<div className="none"><b>No reports ${view === 'day' ? 'for this day' : 'in this period'}</b>${mgr ? 'Reports appear here when people check out.' : 'You send one each day when you check out.'}</div>`}
      ${rows.map(r => html`<section className="ph3-r" key=${r.e.n} id=${'er-p-' + r.e.n}>
        <button className="ph3-h" onClick=${() => setOpenK(openK === r.e.n ? null : r.e.n)} aria-expanded=${openK === r.e.n}>
          <${Av} e=${r.e} s=${44}/>
          <span className="row-t"><b>${r.e.name}</b><span>${r.e.role}</span></span>
          <span className="ph3-n"><b>${r.total > 0 ? fmtH(r.total) : plural(r.reps.length, 'report')}</b><small>${(r.total > 0 ? (view === 'day' ? 'reported' : plural(r.reps.length, 'day')) : 'no hours') + (trkOf(r.e.n) > 0 ? ' · ' + fmtH(trkOf(r.e.n)) + ' tracked' : '')}</small></span>
          <${Icon} n=${openK === r.e.n ? 'chevL' : 'next'} s=${16}/></button>
        ${openK === r.e.n && html`<div className="er-d">${r.reps.map(rep => html`<div key=${rep.day}>${view !== 'day' && html`<h3 className="er-day">${dayLabel(rep.day)}${rep.total > 0 ? ' · ' + fmtH(rep.total) : ''}</h3>`}<${Report} r=${rep}/>${!mgr && html`<div className="er-cp"><${CopyEod} days=${[rep]} text="Copy report"/>${rep.day === dayKey() && html`<button className="btn sec2 sm" onClick=${onEditToday}><${Icon} n="edit" s=${15}/>Update today’s report</button>`}</div>`}</div>`)}</div>`}
      </section>`)}
      ${missing.length > 0 && html`<section className="er-miss"><h3>Checked in, report not sent yet</h3><div>${missing.map(e => html`<span key=${e.n} className="er-chip"><${Av} e=${e} s=${22}/>${e.name}</span>`)}</div></section>`}
    </div>
  </div>`;
}
