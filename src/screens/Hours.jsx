import { useState } from 'react';
import { html, Icon, Tile } from '../ui.jsx';
import { HOL, MONL, TODISO, TOD, fmtDay, pd, fmtTime, plural, awayList } from '../data.js';
import { dayInfo, saveDay, toHM, toTs, monthDays, useNow, hm, clock, dayKey } from '../attendance.js';

const STATE_L = { off: '', leave: 'On leave', absent: 'No check-in', notyet: 'Not in yet', na: '', future: '' };

/* ---------- admin editor for one day ---------- */
function DayEditor({ iso, rec, onSave, onCancel }) {
  const [rows, setRows] = useState(() => rec.sessions.map(s => ({ in: toHM(s.in), out: s.out ? toHM(s.out) : '', loc: s.loc || 'office' })));
  const [err, setErr] = useState('');
  const set = (i, p) => { setRows(r => r.map((x, k) => k === i ? { ...x, ...p } : x)); setErr(''); };
  const save = () => {
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.in) { setErr('Every session needs a check-in time.'); return; }
      if (!r.out && !(iso === dayKey() && i === rows.length - 1)) { setErr('Add a check-out time, or remove the session.'); return; }
      if (r.out && r.out <= r.in) { setErr('Check-out must be later than check-in.'); return; }
      if (i > 0 && rows[i - 1].out && r.in < rows[i - 1].out) { setErr('Sessions overlap. Put them in time order.'); return; }
      out.push({ in: toTs(iso, r.in), out: r.out ? toTs(iso, r.out) : null, loc: r.loc });
    }
    onSave(out);
  };
  return html`<div className="hed">
    ${rows.length === 0 && html`<p className="hed-e">No check-ins on this day. Add a session to record hours.</p>`}
    ${rows.map((r, i) => html`<div className="hed-r" key=${i}>
      <label>In<input className="inp" type="time" value=${r.in} onChange=${ev => set(i, { in: ev.target.value })} aria-label=${'Check-in ' + (i + 1)}/></label>
      <label>Out<input className="inp" type="time" value=${r.out} onChange=${ev => set(i, { out: ev.target.value })} aria-label=${'Check-out ' + (i + 1)}/></label>
      <label>Where<select className="inp" value=${r.loc} onChange=${ev => set(i, { loc: ev.target.value })} aria-label=${'Location ' + (i + 1)}><option value="office">Office</option><option value="home">Home</option></select></label>
      <button className="link" onClick=${() => setRows(x => x.filter((_, k) => k !== i))}>Remove</button></div>`)}
    ${err && html`<div className="lg-err" role="alert" style=${{ marginTop: 8 }}>${err}</div>`}
    <div className="hed-a"><button className="btn ghost sm" onClick=${() => setRows(r => [...r, { in: '', out: '', loc: 'office' }])}><${Icon} n="plus" s=${14}/> Add session</button>
      <span style=${{ flex: 1 }}></span><button className="btn ghost sm" onClick=${onCancel}>Cancel</button><button className="btn pri sm" onClick=${save}>Save hours</button></div></div>`;
}

const Badge = ({ c, children }) => html`<span className="hb" style=${{ '--c': c }}>${children}</span>`;

/* ---------- a person's days for a month, with totals ---------- */
export function HoursPanel({ emp, att, setAtt, leaves, canEdit, editor }) {
  const now = useNow(30000);
  const T0 = new Date(TOD);
  const [mo, setMo] = useState({ y: T0.getUTCFullYear(), m: T0.getUTCMonth() });
  const [edit, setEdit] = useState(null);
  const away = awayList(leaves);
  const days = monthDays(mo.y, mo.m).filter(d => d <= TODISO && new Date(pd(d)).getUTCDay() % 6 !== 0).reverse();
  const rows = days.map(d => ({ d, i: dayInfo(att, emp, d, now, away) }));
  const present = rows.filter(r => r.i.sessions.length);
  const total = present.reduce((t, r) => t + r.i.worked, 0);
  const late = present.filter(r => r.i.lateFlag).length, home = present.filter(r => r.i.sessions.some(s => s.loc === 'home')).length;
  const step = n => { const t = new Date(Date.UTC(mo.y, mo.m + n, 1)); setMo({ y: t.getUTCFullYear(), m: t.getUTCMonth() }); setEdit(null); };
  const atNow = mo.y === T0.getUTCFullYear() && mo.m === T0.getUTCMonth();
  return html`<div>
    <div className="tiles">
      <${Tile} icon="check" tone="blue" label="Days present" value=${present.length} sub=${'of ' + rows.filter(r => !['off', 'leave', 'na'].includes(r.i.state)).length + ' working days'}/>
      <${Tile} icon="clock" tone="green" label="Total hours" value=${hm(total).replace(' ', '')} sub=${'daily target ' + fmtTime(emp.shiftStart) + ' – ' + fmtTime(emp.shiftEnd)}/>
      <${Tile} icon="timer" tone="purple" label="Average per day" value=${present.length ? hm(total / present.length).replace(' ', '') : '–'} sub="lunch hour included"/>
      <${Tile} icon="bell" tone="orange" label="Late arrivals" value=${late} sub=${'after 20 min grace · ' + plural(home, 'home day')}/>
    </div>
    <div className="sec-h" style=${{ marginTop: 36 }}><h2>${MONL[mo.m]} ${mo.y}</h2>
      <div className="car-n"><button className="ib" onClick=${() => step(-1)} aria-label="Previous month"><${Icon} n="chevL" s=${16}/></button>
        <button className="ib" onClick=${() => step(1)} disabled=${atNow} aria-label="Next month"><${Icon} n="chevR" s=${16}/></button></div></div>
    <div className="card" style=${{ padding: '4px 20px' }}>
      ${rows.length === 0 ? html`<div className="empty">Nothing to show yet this month.</div>` : rows.map(({ d, i }) => {
        const has = i.sessions.length > 0;
        return html`<div key=${d} className=${'hd' + (has ? '' : ' mute')}>
          <div className="hd-r">
            <span className="hd-d"><b>${fmtDay(pd(d))}</b></span>
            <span className="hd-s">${has ? i.sessions.map(s => clock(s.in) + ' – ' + (s.out ? clock(s.out) : 'now')).join('  ·  ') : HOL[d] ? 'Holiday: ' + HOL[d] : STATE_L[i.state] || '—'}</span>
            <span className="hd-h">${has ? hm(i.worked) : ''}</span>
            <span className="hd-b">${has && i.lateFlag ? html`<${Badge} c="#FF9F0A">Late ${i.late} min<//>` : null}${has && i.short ? html`<${Badge} c="#FF453A">Short<//>` : null}${has && i.over ? html`<${Badge} c="#30D158">Overtime<//>` : null}${has && i.sessions.some(s => s.loc === 'home') ? html`<${Badge} c="#BF5AF2">${i.sessions.every(s => s.loc === 'home') ? 'Home' : 'Home + Office'}<//>` : null}${i.edited ? html`<${Badge} c="#0A84FF">Edited by ${i.edited.by.split(' ')[0]}<//>` : null}</span>
            ${canEdit && !['off', 'na', 'future'].includes(i.state) ? html`<button className="link" onClick=${() => setEdit(edit === d ? null : d)}>${edit === d ? 'Close' : 'Edit'}</button>` : html`<span></span>`}
          </div>
          ${edit === d && html`<${DayEditor} iso=${d} rec=${{ sessions: i.sessions }} onCancel=${() => setEdit(null)} onSave=${ss => { setAtt(a => saveDay(a, emp.n, d, ss, editor.name)); setEdit(null); }}/>`}
        </div>`; })}
    </div>
    <p className="bar-l">Sample hours until the database is connected.</p>
  </div>`;
}

/* ---------- My Hours page ---------- */
export function MyHours({ user, att, setAtt, leaves }) {
  return html`<div>
    <div className="pg-h"><div><h1>My Hours</h1><p>Your check-ins by day. Shift ${fmtTime(user.shiftStart)} – ${fmtTime(user.shiftEnd)}, lunch 1:00 – 2:00 PM.</p></div></div>
    <div style=${{ marginTop: 28 }}><${HoursPanel} emp=${user} att=${att} setAtt=${setAtt} leaves=${leaves} canEdit=${false} editor=${user}/></div>
  </div>`;
}
