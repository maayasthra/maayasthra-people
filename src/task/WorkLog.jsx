import { useState, useEffect } from 'react';
import { html, Icon } from '../ui.jsx';
import { dayKey, addDays, weekStart, monthDays } from '../attendance.js';
import { fmtDM, pd, TODISO, plural } from '../data.js';
import { loadEods, fmtH } from '../eodDb.js';
import { dayLabel } from './EodReports.jsx';

const rowH = x => x.subs && x.subs.length ? x.subs.reduce((t, s) => t + (Number(s.hours) || 0), 0) : Number(x.hours) || 0;
const dateBits = iso => { const d = new Date(pd(iso)); return [d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }), d.getUTCDate(), d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })]; };

function DayCard({ r }) {
  const [wd, dd, mo] = dateBits(r.day);
  return html`<section className="wl-c"><header><span className="wl-dt"><small>${wd}</small><b>${dd}</b><small>${mo}</small></span>
    <span className="wl-hd"><b>${r.day === dayKey() ? 'Today' : dayLabel(r.day)}</b><span>${plural(r.rows.length, 'project')}</span></span>
    ${r.total > 0 && html`<span className="wl-tt">${fmtH(r.total)}</span>`}</header>
    <ul>${r.rows.map((x, i) => html`<li key=${i}><div className="wl-p"><b>${x.project}</b>${r.total > 0 && html`<span>${fmtH(rowH(x))}</span>`}</div>
      ${x.desc && html`<p>${x.desc}</p>`}
      ${(x.subs || []).length > 0 && html`<ul className="wl-sub">${x.subs.map((u, j) => html`<li key=${j}><i></i><span><b>${u.title}</b>${u.desc ? html`<em> · ${u.desc}</em>` : null}</span>${r.total > 0 && html`<small>${fmtH(u.hours)}</small>`}</li>`)}</ul>`}</li>`)}</ul></section>`;
}

// My Tasks > Submitted work: my own day reports, by Day, Week or Month.
export function WorkLog({ user, tick }) {
  const [view, setView] = useState('week'), [day, setDay] = useState(dayKey()), [list, setList] = useState(null), [err, setErr] = useState('');
  const [from, to] = view === 'day' ? [day, day] : view === 'week' ? [weekStart(day), addDays(weekStart(day), 6)] : (() => { const d = new Date(pd(day)), md = monthDays(d.getUTCFullYear(), d.getUTCMonth()); return [md[0], md[md.length - 1]]; })();
  useEffect(() => {
    let live = true; setErr('');
    loadEods(from, to).then(l => { if (live) setList(l.filter(r => r.emp === user.n).sort((a, b) => b.day.localeCompare(a.day))); }).catch(e => { if (live) { setErr(e.message); setList([]); } });
    return () => { live = false; };
  }, [from, to, tick, user.n]);
  const step = n => setDay(d => view === 'day' ? addDays(d, n) : view === 'week' ? addDays(d, 7 * n) : (() => { const t = new Date(pd(d)); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + n, 1)).toISOString().slice(0, 10); })());
  const title = view === 'day' ? (day === dayKey() ? 'Today' : dayLabel(day)) : view === 'week' ? fmtDM(from) + ' – ' + fmtDM(to) : new Date(pd(from)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const hrs = (list || []).reduce((t, r) => t + r.total, 0);
  return html`<div className="wl">
    <div className="er-nav">
      <div className="seg" role="group" aria-label="Period">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => html`<button key=${k} className=${view === k ? 'on' : ''} onClick=${() => setView(k)}>${l}</button>`)}</div>
      <button className="ib" onClick=${() => step(-1)} aria-label="Earlier"><${Icon} n="chevL" s=${16}/></button><b>${title}</b>
      <button className="ib" onClick=${() => step(1)} aria-label="Later" disabled=${to >= TODISO}><${Icon} n="next" s=${16}/></button>
      ${to < TODISO || from > TODISO ? html`<button className="btn ghost sm" onClick=${() => setDay(dayKey())}>Today</button>` : null}
      <span style=${{ flex: 1 }}></span>
      ${list && list.length > 0 && html`<span className="wl-s">${plural(list.length, 'day')} reported${hrs > 0 ? ' · ' + fmtH(hrs) : ''}</span>`}</div>
    ${err && html`<div className="eod-e" role="alert">${err}</div>`}
    ${list === null && html`<div className="none">Loading…</div>`}
    ${list !== null && list.length === 0 && !err && html`<div className="none"><b>Nothing submitted ${view === 'day' ? 'on this day' : 'in this period'}</b>Your day reports appear here after you send them.</div>`}
    ${(list || []).map(r => html`<${DayCard} key=${r.day + '-' + r.at} r=${r}/>`)}
  </div>`;
}
