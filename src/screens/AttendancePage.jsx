import { useState } from 'react';
import { html, Icon, Av, Tile, HI, Sel, downloadCSV } from '../ui.jsx';
import { TODISO, TOD, MONL, HOL, DEPTS, fmtDay, fmtDM, pd, plural, awayList, activeEmps, searchPeople } from '../data.js';
import { dayInfo, useNow, hm, clock, addDays, weekStart, monthDays, GRACE } from '../attendance.js';

const hh = ms => hm(ms).replace(' ', '');
const STATUS = { in: 'Checked in', out: 'Checked out', notyet: 'Not in yet', absent: 'Absent', leave: 'On leave', off: 'Holiday or weekend' };
const LEGEND = [['ok', 'On time'], ['late', 'Late'], ['short', 'Short day'], ['leave', 'On leave'], ['none', 'Absent'], ['off', 'Holiday or weekend']];

const cellClass = c => !c ? 'fut' : c.sessions.length ? (c.lateFlag ? 'late' : c.short ? 'short' : 'ok') : c.state === 'leave' ? 'leave' : c.state === 'off' ? 'off' : c.state === 'absent' ? 'none' : 'fut';

/* One matrix for both views: a row per person, a square per day, then the totals. */
function Matrix({ rows, days, wide, open }) {
  const perDay = days.map((d, k) => rows.filter(r => r.cells[k] && r.cells[k].sessions.length).length);
  const working = d => d <= TODISO && new Date(pd(d)).getUTCDay() % 6 !== 0 && !HOL[d];
  const label = d => wide ? html`<span key=${d} className=${'ov-d' + (d === TODISO ? ' today' : '')}>${fmtDay(pd(d)).split(' ')[0]}<small>${fmtDM(d)}</small></span>`
    : html`<span key=${d} className=${'ov-d' + (d === TODISO ? ' today' : '')}>${Number(d.slice(8))}<small>${['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(pd(d)).getUTCDay()]}</small></span>`;
  return html`<div>
    <div className="ov-lg">${LEGEND.map(([k, l]) => html`<span key=${k}><i className=${'ovc ' + k}></i>${l}</span>`)}</div>
    <div className="card ov-w"><div className=${'ov' + (wide ? ' wide' : '')} style=${{ '--n': days.length }}>
      <div className="ov-r ov-h"><span>Person</span>${days.map(label)}<span className="ov-s">Days present</span><span className="ov-s">Days absent</span><span className="ov-s">Late</span><span className="ov-s">Hours</span></div>
      ${rows.map(r => html`<div key=${r.e.n} className="ov-r">
        <button className="ov-p" onClick=${() => open(r.e.n, 'hours')}><${Av} e=${r.e} s=${28}/><span className="row-t"><b>${r.e.name}</b><span>${r.e.dept}</span></span></button>
        ${r.cells.map((c, k) => html`<button key=${k} className=${'ovc ' + cellClass(c)} onClick=${() => open(r.e.n, 'hours')}
          title=${r.e.name + ' · ' + fmtDay(pd(days[k])) + (c && c.sessions.length ? ' · ' + hh(c.worked) + (c.lateFlag ? ' · late ' + c.late + ' min' : '') : c && c.state ? ' · ' + (STATUS[c.state] || '') : '')}
          aria-label=${r.e.name + ' ' + fmtDM(days[k])}>${wide && c && c.sessions.length ? hh(c.worked) : wide && c && c.state === 'leave' ? 'Leave' : wide && c && c.state === 'absent' ? 'Absent' : ''}</button>`)}
        <span className="ov-s ov-pres">${r.present}</span>
        <span className=${'ov-s ov-abs' + (r.absent ? ' has' : '')}>${r.absent}</span>
        <span className=${'ov-s' + (r.late ? ' at-late' : '')}>${r.late}</span>
        <span className="ov-s">${r.present ? Math.round(r.tot / 36e5) + 'h' : '–'}</span></div>`)}
      <div className="ov-r ov-f"><span>People present</span>${perDay.map((n, k) => html`<span key=${k} className="ov-n">${working(days[k]) ? n : ''}</span>`)}<span></span><span></span><span></span><span></span></div>
    </div></div>
  </div>`;
}

export function AttendancePage({ att, leaves, open }) {
  const now = useNow(60000);
  const [tab, setTab] = useState('overall');
  const [q, setQ] = useState(''), [dept, setDept] = useState('All'), [anchor, setAnchor] = useState(TODISO);
  const T0 = new Date(TOD);
  const [mo, setMo] = useState({ y: T0.getUTCFullYear(), m: T0.getUTCMonth() });
  const away = awayList(leaves);
  const people = activeEmps();
  const filt = searchPeople(q).filter(e => dept === 'All' || e.dept === dept);

  const wk = weekStart(anchor), weekDays = Array.from({ length: 5 }, (_, i) => addDays(wk, i));
  const days = tab === 'week' ? weekDays : monthDays(mo.y, mo.m);

  const rows = filt.map(e => {
    const cells = days.map(d => d <= TODISO ? dayInfo(att, e, d, now, away) : null), p = cells.filter(c => c && c.sessions.length);
    return { e, cells, present: p.length, absent: cells.filter(c => c && c.state === 'absent').length, late: p.filter(c => c.lateFlag).length, tot: p.reduce((t, c) => t + c.worked, 0) };
  }).sort((a, b) => a.e.name.localeCompare(b.e.name));

  const sum = k => rows.reduce((t, r) => t + r[k], 0);
  const present = sum('present'), absent = sum('absent'), late = sum('late'), tot = sum('tot');
  const rate = present + absent ? Math.round(present / (present + absent) * 100) : 0;

  const exportCSV = () => {
    const head = ['Employee', 'Employee ID', 'Department', 'Date', 'Status', 'First check-in', 'Last check-out', 'Worked (hours)', 'Minutes late', 'Sessions', 'Edited by admin'];
    const out = [];
    rows.forEach(r => days.forEach((d, k) => {
      const i = r.cells[k]; if (!i) return;
      out.push([r.e.name, r.e.empId, r.e.dept, d, i.sessions.length ? (i.lateFlag ? 'Present (late)' : 'Present') : STATUS[i.state] || '', i.first ? clock(i.first) : '', i.last ? clock(i.last) : '', i.sessions.length ? (i.worked / 36e5).toFixed(2) : '', i.sessions.length ? i.late : '', i.sessions.length, i.edited ? i.edited.by : '']);
    }));
    downloadCSV('maayasthra-attendance-' + days[0] + '-to-' + days[days.length - 1] + '.csv', [head, ...out]);
  };

  const step = n => tab === 'week' ? setAnchor(addDays(wk, 7 * n)) : (() => { const t = new Date(Date.UTC(mo.y, mo.m + n, 1)); setMo({ y: t.getUTCFullYear(), m: t.getUTCMonth() }); })();
  const atEnd = tab === 'week' ? addDays(wk, 7) > TODISO : (mo.y === T0.getUTCFullYear() && mo.m === T0.getUTCMonth());
  const title = tab === 'week' ? fmtDM(weekDays[0]) + ' – ' + fmtDM(weekDays[4]) + ' ' + wk.slice(0, 4) : MONL[mo.m] + ' ' + mo.y;

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="attendance" tone="green"/>Attendance</h1><p>Sample data</p></div>
      <div style=${{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="seg" style=${{ width: 220, margin: 0 }} role="group" aria-label="Period">${[['overall', 'Month', 'calendar'], ['week', 'Week', 'attendance']].map(([k, l, ic]) => html`<button key=${k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}><${Icon} n=${ic} s=${15}/>${l}</button>`)}</div>
        <button className="btn sec2 sq" title="Download CSV" aria-label="Download CSV" onClick=${exportCSV}><${Icon} n="download" s=${16}/></button></div></div>
    <div className="tiles">
      <${Tile} icon="check" tone="green" label="Attendance rate" value=${rate + '%'} sub=${present + ' of ' + (present + absent)}/>
      <${Tile} icon="people" tone="blue" label="Days present" value=${present} sub=${'avg ' + (present ? hh(tot / present) : '–')}/>
      <${Tile} icon="x" tone="red" label="Days absent" value=${absent} sub="no check-in"/>
      <${Tile} icon="bell" tone="orange" label="Late arrivals" value=${late} sub=${GRACE + ' min grace'}/>
    </div>
    <div className="at-bar">
      <div className="search"><${Icon} n="search"/><input id="att-search" value=${q} placeholder="Search" onChange=${ev => setQ(ev.target.value)} aria-label="Search people"/></div>
      <${Sel} icon="building" id="att-dept" value=${dept} label="Department" onChange=${ev => setDept(ev.target.value)}><option value="All">All</option>${DEPTS.map(d => html`<option key=${d} value=${d}>${d}</option>`)}<//>
      <span style=${{ flex: 1 }}></span>
      <div className="car-n"><span style=${{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginRight: 8 }}>${title}</span>
        <button className="ib" onClick=${() => step(-1)} aria-label=${tab === 'week' ? 'Previous week' : 'Previous month'}><${Icon} n="chevL" s=${16}/></button>
        <button className="ib" onClick=${() => step(1)} disabled=${atEnd} aria-label=${tab === 'week' ? 'Next week' : 'Next month'}><${Icon} n="chevR" s=${16}/></button></div>
    </div>
    <${Matrix} rows=${rows} days=${days} wide=${tab === 'week'} open=${open}/>
    
  </div>`;
}
