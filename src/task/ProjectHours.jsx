import { useState } from 'react';
import { html, Icon, Av, Tile, HI } from '../ui.jsx';
import { useNow, dayStart, dayKey, weekStart } from '../attendance.js';
import { activeEmps, plural } from '../data.js';
import { spentIn, isDoing, fmtDur } from '../tasks.js';

// Project hours: time logged on cards, added up for each person. Admins see everyone, employees see themselves.
const startOf = (kind, now) => { if (kind === 'all') return 0; const iso = dayKey(now); return dayStart(kind === 'week' ? weekStart(iso) : iso.slice(0, 8) + '01'); };

export function ProjectHours({ tasks, user, role }) {
  const now = useNow(1000);
  const [period, setPeriod] = useState('week'), [openN, setOpenN] = useState(null);
  const from = startOf(period, now), to = now + 1;
  const mgr = role === 'admin' || role === 'pm';
  const people = activeEmps().filter(e => mgr || e.n === user.n);
  const rows = people.map(e => {
    const items = tasks.map(t => ({ t, ms: spentIn(t, from, to, now, e.n) })).filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms);
    return { e, items, total: items.reduce((s, x) => s + x.ms, 0), live: tasks.some(t => isDoing(t, e.n)) };
  }).filter(r => r.total > 0 || r.live || r.e.n === user.n).sort((a, b) => b.total - a.total || a.e.name.localeCompare(b.e.name));
  const total = rows.reduce((s, r) => s + r.total, 0), working = rows.filter(r => r.live).length, timed = new Set(rows.flatMap(r => r.items.map(x => x.t.id))).size;
  const label = { week: 'this week', month: 'this month', all: 'all time' }[period];

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="timer" tone="green"/>Project hours</h1><p>${mgr ? 'Time logged on cards, by person' : 'Your logged time'}</p></div>
      <div className="seg" role="group" aria-label="Period">${[['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => html`<button key=${k} className=${period === k ? 'on' : ''} onClick=${() => setPeriod(k)}>${l}</button>`)}</div></div>
    <div className="tiles t3">
      <${Tile} icon="timer" tone="green" label="Hours logged" value=${fmtDur(total)} sub=${label}/>
      <${Tile} icon="people" tone="blue" label=${mgr ? 'Working now' : 'Timers running'} value=${working} sub=${mgr ? 'people with a timer on' : 'right now'}/>
      <${Tile} icon="board" tone="purple" label="Cards timed" value=${timed} sub=${label}/>
    </div>
    <div className="ph3">
      ${rows.length === 0 && html`<div className="none"><b>No time logged ${label}</b>Time is logged when a card is moved to Doing in My Tasks.</div>`}
      ${rows.map(r => html`<section className="ph3-r" key=${r.e.n}>
        <button className="ph3-h" onClick=${() => setOpenN(openN === r.e.n ? null : r.e.n)} aria-expanded=${openN === r.e.n}>
          <${Av} e=${r.e} s=${44}/>
          <span className="row-t"><b>${r.e.name}</b><span>${r.e.role}</span></span>
          ${r.live && html`<span className="ph3-live"><i></i>Working now</span>`}
          <span className="ph3-n"><b>${fmtDur(r.total)}</b><small>${plural(r.items.length, 'card')}</small></span>
          <${Icon} n=${openN === r.e.n ? 'chevL' : 'next'} s=${16}/></button>
        ${openN === r.e.n && html`<div className="ph3-d">${r.items.length === 0 ? html`<p className="ph3-none">No time logged ${label}.</p>` : r.items.map(x => html`<div className="ph3-i" key=${x.t.id}><span className="row-t"><b>${x.t.title}</b><span>${x.t.client || (x.t.done ? 'Completed' : isDoing(x.t, r.e.n) ? 'In progress' : 'Paused')}</span></span><span className="ph3-t">${fmtDur(x.ms)}</span></div>`)}</div>`}
      </section>`)}
    </div>
  </div>`;
}
