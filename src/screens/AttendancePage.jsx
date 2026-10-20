import { useState } from 'react';
import { html, Icon, Av, Tile, downloadCSV } from '../ui.jsx';
import { TODISO, TOD, MONL, HOL, DEPTS, fmtDay, fmtDM, pd, fmtTime, plural, awayList, activeEmps, searchPeople } from '../data.js';
import { dayInfo, useNow, hm, clock, LOCS, addDays, weekStart, monthDays, GRACE } from '../attendance.js';

const STATE = {
  in: ['Checked in', '#30D158'], out: ['Checked out', '#8E8E93'], notyet: ['Not in yet', '#FF9F0A'], absent: ['No check-in', '#FF453A'],
  leave: ['On leave', '#BF5AF2'], off: ['Off', '#8E8E93'], na: ['Not joined', '#8E8E93'], future: ['', '#8E8E93']
};
const ORDER = { absent: 0, notyet: 1, in: 2, out: 3, leave: 4, off: 5, na: 6, future: 7 };
const hh = ms => hm(ms).replace(' ', '');

export function AttendancePage({ att, leaves, open, user }) {
  const now = useNow(1000);
  const [tab, setTab] = useState('today');
  const [q, setQ] = useState(''), [dept, setDept] = useState('All'), [loc, setLoc] = useState('All'), [lateOnly, setLateOnly] = useState(false);
  const [anchor, setAnchor] = useState(TODISO);
  const away = awayList(leaves);
  const people = activeEmps();
  const T0 = new Date(TOD);
  const [mo, setMo] = useState({ y: T0.getUTCFullYear(), m: T0.getUTCMonth() });

  const filt = searchPeople(q).filter(e => dept === 'All' || e.dept === dept);
  const info = (e, d) => dayInfo(att, e, d, now, away);

  /* today summary, always across everyone */
  const todays = people.map(e => ({ e, i: info(e, TODISO) }));
  const inNow = todays.filter(x => x.i.state === 'in'), seen = todays.filter(x => x.i.sessions.length);
  const homeN = seen.filter(x => x.i.loc === 'home' && x.i.state === 'in').length;
  const lateN = seen.filter(x => x.i.lateFlag).length;
  const missing = todays.filter(x => x.i.state === 'absent' || x.i.state === 'notyet').length;
  const avg = seen.length ? seen.reduce((t, x) => t + x.i.worked, 0) / seen.length : 0;
  const closed = HOL[TODISO] || [0, 6].includes(new Date(TOD).getUTCDay());

  /* period for week and month views */
  const wk = weekStart(anchor), weekDays = Array.from({ length: 7 }, (_, i) => addDays(wk, i)).filter((_, i) => i < 5);
  const mDays = monthDays(mo.y, mo.m).filter(d => d <= TODISO && new Date(pd(d)).getUTCDay() % 6 !== 0);
  const period = tab === 'week' ? weekDays.filter(d => d <= TODISO) : tab === 'overall' ? mDays : [TODISO];

  const exportCSV = () => {
    const head = ['Employee', 'Employee ID', 'Department', 'Date', 'Status', 'First check-in', 'Last check-out', 'Worked (hours)', 'Minutes late', 'Location', 'Sessions', 'Edited by admin'];
    const rows = [];
    filt.forEach(e => period.forEach(d => {
      const i = info(e, d);
      rows.push([e.name, e.empId, e.dept, d, (STATE[i.state] || [''])[0], i.first ? clock(i.first) : '', i.last ? clock(i.last) : '', i.sessions.length ? (i.worked / 36e5).toFixed(2) : '', i.sessions.length ? i.late : '', i.loc ? LOCS[i.loc] : '', i.sessions.length, i.edited ? i.edited.by : '']);
    }));
    downloadCSV('maayasthra-attendance-' + period[0] + (period.length > 1 ? '-to-' + period[period.length - 1] : '') + '.csv', [head, ...rows]);
  };

  const tools = html`<div className="tools" style=${{ marginTop: 22 }}>
    <div className="search"><${Icon} n="search"/><input id="att-search" value=${q} placeholder="Search people" onChange=${ev => setQ(ev.target.value)} aria-label="Search people"/></div>
    <select id="att-dept" className="sel" value=${dept} onChange=${ev => setDept(ev.target.value)} aria-label="Department"><option value="All">All departments</option>${DEPTS.map(d => html`<option key=${d} value=${d}>${d}</option>`)}</select>
    ${tab === 'today' && html`<select id="att-loc" className="sel" value=${loc} onChange=${ev => setLoc(ev.target.value)} aria-label="Location"><option value="All">Office and Home</option><option value="office">Office</option><option value="home">Home</option></select>
      <label className="cbx" htmlFor="att-late" style=${{ marginTop: 0 }}><input id="att-late" type="checkbox" checked=${lateOnly} onChange=${ev => setLateOnly(ev.target.checked)}/> Late only</label>`}
  </div>`;

  /* ---- Today ---- */
  let body;
  if (tab === 'today') {
    let rows = filt.map(e => ({ e, i: info(e, TODISO) }));
    if (loc !== 'All') rows = rows.filter(x => x.i.loc === loc);
    if (lateOnly) rows = rows.filter(x => x.i.lateFlag || x.i.state === 'absent');
    rows.sort((a, b) => ORDER[a.i.state] - ORDER[b.i.state] || a.e.name.localeCompare(b.e.name));
    body = html`<div className="card at-t" style=${{ padding: '6px 14px' }}>
      <div className="at-r at-h"><span>Person</span><span>Status</span><span>First in</span><span>Hours today</span><span>Where</span><span>Timing</span></div>
      ${rows.length === 0 ? html`<div className="empty">No one matches those filters.</div>` : rows.map(({ e, i }) => html`<button key=${e.n} className="at-r row" onClick=${() => open(e.n, 'hours')}>
        <span className="at-p"><${Av} e=${e} s=${36}/><span className="row-t"><b>${e.name}</b><span>${e.dept} · ${fmtTime(e.shiftStart)}</span></span></span>
        <span><span className="pill" style=${{ '--c': STATE[i.state][1] }}><i></i>${STATE[i.state][0] || '–'}</span></span>
        <span>${i.first ? clock(i.first) : '–'}</span>
        <span className="at-n">${i.sessions.length ? hh(i.worked) : '–'}</span>
        <span>${i.loc ? LOCS[i.loc] : '–'}</span>
        <span className=${i.lateFlag || i.state === 'absent' ? 'at-late' : 'at-ok'}>${i.state === 'absent' ? (i.behind ? 'Late ' + i.behind + ' min' : 'Absent') : i.sessions.length ? (i.lateFlag ? 'Late ' + i.late + ' min' : 'On time') : ''}${i.edited ? ' · edited' : ''}</span></button>`)}
    </div>`;
  }

  /* ---- Week: person by weekday ---- */
  if (tab === 'week') {
    const rows = filt.map(e => { const cells = weekDays.map(d => d <= TODISO ? info(e, d) : null); return { e, cells, tot: cells.reduce((t, c) => t + (c ? c.worked : 0), 0), n: cells.filter(c => c && c.sessions.length).length }; });
    rows.sort((a, b) => a.e.name.localeCompare(b.e.name));
    body = html`<div className="card at-w" style=${{ padding: '6px 14px', overflowX: 'auto' }}>
      <div className="at-wr at-h"><span>Person</span>${weekDays.map(d => html`<span key=${d}>${fmtDay(pd(d)).split(' ')[0]} <small>${fmtDM(d)}</small></span>`)}<span>Total</span></div>
      ${rows.map(({ e, cells, tot, n }) => html`<button key=${e.n} className="at-wr row" onClick=${() => open(e.n, 'hours')}>
        <span className="at-p"><${Av} e=${e} s=${32}/><span className="row-t"><b>${e.name}</b><span>${e.dept}</span></span></span>
        ${cells.map((c, k) => html`<span key=${k} className=${'at-c' + (c && c.sessions.length ? (c.lateFlag ? ' late' : c.short ? ' short' : '') : ' mute')}>${!c ? '' : c.sessions.length ? hh(c.worked) : c.state === 'leave' ? 'Leave' : c.state === 'off' ? (HOL[weekDays[k]] ? 'Holiday' : '') : c.state === 'absent' ? 'None' : ''}</span>`)}
        <span className="at-n">${n ? hh(tot) : '–'}</span></button>`)}
    </div>`;
  }

  /* ---- Overall: the whole month, every person, every day ---- */
  if (tab === 'overall') {
    const cols = monthDays(mo.y, mo.m);
    const rows = filt.map(e => {
      const cells = cols.map(d => d <= TODISO ? info(e, d) : null), p = cells.filter(c => c && c.sessions.length), tot = p.reduce((t, c) => t + c.worked, 0);
      return { e, cells, days: p.length, tot, late: p.filter(c => c.lateFlag).length, short: p.filter(c => c.short).length, home: p.filter(c => c.sessions.some(s => s.loc === 'home')).length };
    }).sort((a, b) => a.e.name.localeCompare(b.e.name));
    const perDay = cols.map((d, k) => rows.filter(r => r.cells[k] && r.cells[k].sessions.length).length);
    const cls = c => !c ? 'fut' : c.sessions.length ? (c.lateFlag ? 'late' : c.short ? 'short' : 'ok') : c.state === 'leave' ? 'leave' : c.state === 'off' ? 'off' : c.state === 'absent' ? 'none' : 'fut';
    const style = { '--n': cols.length };
    body = html`<div>
      <div className="ov-lg">${[['ok', 'On time'], ['late', 'Late'], ['short', 'Short day'], ['leave', 'On leave'], ['none', 'No record'], ['off', 'Holiday or weekend']].map(([k, l]) => html`<span key=${k}><i className=${'ovc ' + k}></i>${l}</span>`)}<span><i className="ovc ok home"></i>Worked from home</span></div>
      <div className="card ov-w" style=${{ padding: '6px 14px 10px' }}><div className="ov" style=${style}>
        <div className="ov-r ov-h"><span>Person</span>${cols.map(d => html`<span key=${d} className=${'ov-d' + (d === TODISO ? ' today' : '')}>${Number(d.slice(8))}<small>${['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(pd(d)).getUTCDay()]}</small></span>`)}<span className="ov-s">Days</span><span className="ov-s">Hours</span><span className="ov-s">Late</span><span className="ov-s">Home</span></div>
        ${rows.map(r => html`<div key=${r.e.n} className="ov-r">
          <button className="ov-p" onClick=${() => open(r.e.n, 'hours')}><${Av} e=${r.e} s=${26}/><b>${r.e.name}</b></button>
          ${r.cells.map((c, k) => html`<button key=${k} className=${'ovc ' + cls(c) + (c && c.sessions.some(s => s.loc === 'home') ? ' home' : '')} title=${r.e.name + ' · ' + fmtDay(pd(cols[k])) + (c && c.sessions.length ? ' · ' + hh(c.worked) + (c.lateFlag ? ' · late ' + c.late + ' min' : '') : c && c.state === 'leave' ? ' · on leave' : c && c.state === 'absent' ? ' · no record' : '')} onClick=${() => open(r.e.n, 'hours')} aria-label=${r.e.name + ' ' + fmtDM(cols[k])}></button>`)}
          <span className="ov-s">${r.days}</span><span className="ov-s">${r.days ? Math.round(r.tot / 36e5) + 'h' : '–'}</span><span className=${'ov-s' + (r.late ? ' at-late' : '')}>${r.late}</span><span className="ov-s">${r.home}</span></div>`)}
        <div className="ov-r ov-f"><span>In each day</span>${perDay.map((n, k) => html`<span key=${k} className="ov-n">${cols[k] <= TODISO && new Date(pd(cols[k])).getUTCDay() % 6 !== 0 && !HOL[cols[k]] ? n : ''}</span>`)}<span></span><span></span><span></span><span></span></div>
      </div></div></div>`;
  }

  const nav = tab === 'week'
    ? html`<div className="sec-h" style=${{ marginTop: 28 }}><h2>${fmtDM(weekDays[0])} – ${fmtDM(weekDays[4])}</h2><div className="car-n"><button className="ib" onClick=${() => setAnchor(addDays(wk, -7))} aria-label="Previous week"><${Icon} n="chevL" s=${16}/></button><button className="ib" onClick=${() => setAnchor(addDays(wk, 7))} disabled=${addDays(wk, 7) > TODISO} aria-label="Next week"><${Icon} n="chevR" s=${16}/></button></div></div>`
    : tab === 'overall'
    ? html`<div className="sec-h" style=${{ marginTop: 28 }}><h2>${MONL[mo.m]} ${mo.y}</h2><div className="car-n"><button className="ib" onClick=${() => { const t = new Date(Date.UTC(mo.y, mo.m - 1, 1)); setMo({ y: t.getUTCFullYear(), m: t.getUTCMonth() }); }} aria-label="Previous month"><${Icon} n="chevL" s=${16}/></button><button className="ib" onClick=${() => { const t = new Date(Date.UTC(mo.y, mo.m + 1, 1)); setMo({ y: t.getUTCFullYear(), m: t.getUTCMonth() }); }} disabled=${mo.y === T0.getUTCFullYear() && mo.m === T0.getUTCMonth()} aria-label="Next month"><${Icon} n="chevR" s=${16}/></button></div></div>`
    : html`<div style=${{ height: 6 }}></div>`;

  return html`<div>
    <div className="pg-h"><div><h1>Attendance</h1><p>${closed ? 'The studio is closed today' + (HOL[TODISO] ? ' for ' + HOL[TODISO] : '') + '. Showing the latest records.' : 'Who is in, when they arrived and how long they have worked.'}</p></div>
      <div style=${{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="seg s3" style=${{ width: 300, margin: 0 }} role="group" aria-label="Period">${[['today', 'Today'], ['week', 'Week'], ['overall', 'Overall']].map(([k, l]) => html`<button key=${k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</div>
        <button className="btn sec2" onClick=${exportCSV}><${Icon} n="download" s=${16}/> Download</button></div></div>
    <div className="tiles">
      <${Tile} icon="check" tone="green" label="Checked in now" value=${inNow.length} sub=${'of ' + (people.length - todays.filter(x => ['leave', 'off'].includes(x.i.state)).length) + ' expected · ' + homeN + ' at home'}/>
      <${Tile} icon="bell" tone="orange" hot=${lateN > 0} label="Late arrivals" value=${lateN} sub=${'beyond the ' + GRACE + ' minute grace'}/>
      <${Tile} icon="clock" tone="amber" label="Not checked in" value=${missing} sub=${missing ? 'yet to arrive or absent' : 'everyone is in'}/>
      <${Tile} icon="timer" tone="blue" label="Average today" value=${seen.length ? hh(avg) : '–'} sub=${'across ' + plural(seen.length, 'person')}/>
    </div>
    ${tools}${nav}
    <div style=${{ marginTop: tab === 'today' ? 20 : 0 }}>${body}</div>
    <p className="bar-l">Hours shown are sample data until the database is connected. Click a person to see and edit their days.</p>
  </div>`;
}
