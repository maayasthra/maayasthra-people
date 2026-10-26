import { useState, useEffect } from 'react';
import { html, Icon, Av, Tile, HI } from '../ui.jsx';
import { dayKey, addDays, weekStart, monthDays, getDay } from '../attendance.js';
import { activeEmps, plural, HOL, fmtDM, pd, TODISO } from '../data.js';
import { loadEods, fmtH } from '../eodDb.js';
import { subscribeTables } from '../tasksDb.js';
import { IS_DEMO } from '../env.js';

const isWorking = iso => { const w = new Date(pd(iso)).getUTCDay(); return w !== 0 && w !== 6 && !HOL[iso]; };
const dayLabel = iso => new Date(pd(iso)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function Report({ r }) {
  return html`<div className="er-t" role="table">
    <div className="er-hd" role="row"><span>Project</span><span>Description</span><span>Hours</span></div>
    ${r.rows.map((x, i) => html`<div key=${i}>
      <div className="er-r" role="row"><b>${x.project}</b><span>${x.desc || (x.subs && x.subs.length ? '' : '—')}</span><span className="er-h">${fmtH(x.subs && x.subs.length ? x.subs.reduce((t, s) => t + s.hours, 0) : x.hours)}</span></div>
      ${(x.subs || []).map((s, j) => html`<div className="er-r er-s" role="row" key=${j}><span>${s.title}</span><span>${s.desc || '—'}</span><span className="er-h">${fmtH(s.hours)}</span></div>`)}
    </div>`)}
  </div>`;
}

// EOD reports. Everyone reads their own; admins and project managers read everyone's. Reports are sent when checking out.
export function EodReports({ user, role, tick, onEditToday, checkedIn, att }) {
  const mgr = role === 'admin' || role === 'pm';
  const [view, setView] = useState('day'), [day, setDay] = useState(dayKey());
  const [list, setList] = useState(null), [err, setErr] = useState(''), [openK, setOpenK] = useState(null), [rev, setRev] = useState(0);
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
  const missing = view === 'day' && mgr && day <= TODISO ? people.filter(e => !by[e.n] && getDay(att, e.n, day).sessions.length > 0) : [];
  const total = rows.reduce((t, r) => t + r.total, 0);
  const step = n => setDay(d => view === 'day' ? addDays(d, n) : view === 'week' ? addDays(d, 7 * n) : (() => { const t = new Date(pd(d)); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + n, 1)).toISOString().slice(0, 10); })());
  const title = view === 'day' ? (day === dayKey() ? 'Today' : dayLabel(day)) : view === 'week' ? fmtDM(from) + ' – ' + fmtDM(to) : new Date(pd(from)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const mine = by[user.n] && by[user.n].find(r => r.day === dayKey());

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="timer" tone="green"/>EOD reports</h1><p>${mgr ? 'What everyone worked on, and for how long' : 'What you worked on each day'}</p></div>
      <div className="seg" role="group" aria-label="Period">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => html`<button key=${k} className=${view === k ? 'on' : ''} onClick=${() => setView(k)}>${l}</button>`)}</div></div>
    <div className="er-nav"><button className="ib" onClick=${() => step(-1)} aria-label="Earlier"><${Icon} n="chevL" s=${16}/></button><b>${title}</b>
      <button className="ib" onClick=${() => step(1)} aria-label="Later" disabled=${range[1] >= TODISO}><${Icon} n="next" s=${16}/></button>
      ${day !== dayKey() && html`<button className="btn ghost sm" onClick=${() => setDay(dayKey())}>Today</button>`}
      <span style=${{ flex: 1 }}></span>
      ${view === 'day' && day === dayKey() && (checkedIn || mine) && html`<button className="btn sec2 sm" onClick=${onEditToday}>${mine ? 'Update today’s report' : 'Write today’s report'}</button>`}</div>
    <div className="tiles t3">
      <${Tile} icon="timer" tone="green" label="Hours reported" value=${fmtH(total)} sub=${title.toLowerCase()}/>
      <${Tile} icon="people" tone="blue" label=${mgr ? 'Reports sent' : 'Days reported'} value=${view === 'day' ? rows.length : rows.reduce((t, r) => t + r.reps.length, 0)} sub=${title.toLowerCase()}/>
      ${mgr ? html`<${Tile} icon="clock" tone="orange" label="Not sent" value=${missing.length} sub=${view === 'day' ? 'checked in, no report yet' : 'pick a day to see who'}/>`
        : html`<${Tile} icon="board" tone="purple" label="Average a day" value=${rows.length && rows[0].reps.length ? fmtH(total / rows[0].reps.length) : '0h'} sub=${title.toLowerCase()}/>`}
    </div>
    ${err && html`<div className="eod-e" role="alert">${err}</div>`}
    <div className="ph3">
      ${list === null && html`<div className="none">Loading…</div>`}
      ${list !== null && rows.length === 0 && html`<div className="none"><b>No reports ${view === 'day' ? 'for this day' : 'in this period'}</b>${mgr ? 'Reports appear here when people check out.' : 'You send one each day when you check out.'}</div>`}
      ${rows.map(r => html`<section className="ph3-r" key=${r.e.n}>
        <button className="ph3-h" onClick=${() => setOpenK(openK === r.e.n ? null : r.e.n)} aria-expanded=${openK === r.e.n}>
          <${Av} e=${r.e} s=${44}/>
          <span className="row-t"><b>${r.e.name}</b><span>${r.e.role}</span></span>
          <span className="ph3-n"><b>${fmtH(r.total)}</b><small>${view === 'day' ? 'reported' : plural(r.reps.length, 'day')}</small></span>
          <${Icon} n=${openK === r.e.n ? 'chevL' : 'next'} s=${16}/></button>
        ${openK === r.e.n && html`<div className="er-d">${r.reps.map(rep => html`<div key=${rep.day}>${view !== 'day' && html`<h3 className="er-day">${dayLabel(rep.day)} · ${fmtH(rep.total)}</h3>`}<${Report} r=${rep}/></div>`)}</div>`}
      </section>`)}
      ${missing.length > 0 && html`<section className="er-miss"><h3>Checked in, report not sent yet</h3><div>${missing.map(e => html`<span key=${e.n} className="er-chip"><${Av} e=${e} s=${22}/>${e.name}</span>`)}</div></section>`}
    </div>
  </div>`;
}
