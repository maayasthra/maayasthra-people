import { useState } from 'react';
import { html, Icon, Tile } from '../ui.jsx';
import { typeIcon, typeTone } from './Home.jsx';
import { TOD, DAY, TODISO, BY, POLICY, isoOf, pd, fmtDay, plural, range, workDays, balances, noticeDays, TEAM_LEAVES } from '../data.js';

const LS_C = { pending:'#E8B93F', approved:'#46D39A', declined:'#E5736B' };

export function MyLeaves({ leaves, setLeaves, user }) {
  const me = user, mgr = BY[me.mgr] || { name: 'People & Ops' };
  const mine = leaves.filter(l => l.emp === me.n);
  const start = isoOf(TOD + (POLICY.notice + 5) * DAY);
  const [f, setF] = useState({ type: 'Annual leave', from: start, to: start, reason: '', half: false });
  const [sent, setSent] = useState(false);
  const up = p => { setF(o => { const n = { ...o, ...p }; if (n.from && n.to && n.to < n.from && p.from) n.to = n.from; if (n.from !== n.to) n.half = false; return n; }); setSent(false); };
  const bal = balances(mine);
  const cur = bal.find(b => b.t === f.type) || bal[0], avail = cur.left - cur.pend;
  const ok = f.from && f.to;
  const wd = ok && f.to >= f.from ? workDays(f.from, f.to) : null;
  const days = wd ? (f.half && f.from === f.to && wd.days === 1 ? 0.5 : wd.days) : 0;
  let err = '';
  if (ok && f.to < f.from) err = 'The end date is before the start date.';
  else if (ok && f.from < TODISO) err = 'Choose a start date from today onwards.';
  else if (wd && wd.days === 0) err = 'Those dates fall on weekends or holidays only.';
  else if (wd && f.type !== 'Sick leave' && noticeDays(f.from) < POLICY.notice) err = 'Planned leave needs ' + plural(POLICY.notice, 'working day') + ' notice. Sick leave is exempt.';
  else if (wd && days > avail) err = 'You have ' + plural(Math.max(avail, 0), 'day') + ' of ' + f.type.toLowerCase() + ' available.';
  else if (POLICY.note && !f.reason.trim()) err = 'Add a short note for ' + mgr.name.split(' ')[0] + '.';
  const valid = ok && wd && !err;
  const clash = wd ? [...TEAM_LEAVES, ...leaves.filter(l => l.state === 'approved')].filter(t => t.emp !== me.n && BY[t.emp] && BY[t.emp].dept === me.dept && f.from <= t.to && f.to >= t.from) : [];
  const submit = ev => {
    ev.preventDefault(); if (!valid) return;
    setLeaves(ls => [{ id: Date.now(), emp: me.n, type: f.type, from: f.from, to: f.to, days, half: days === 0.5, reason: f.reason.trim(), state: 'pending', sent: 'Just now' }, ...ls]);
    setSent(true); setF(o => ({ ...o, reason: '', half: false }));
  };
  const hist = [...mine].sort((a, b) => b.from.localeCompare(a.from));
  return html`<div>
    <div className="pg-h"><div><h1>My Leaves</h1><p>Your balances for ${new Date(TOD).getUTCFullYear()} and every request you have sent.</p></div></div>
    <div className="tiles">${bal.map(b => html`<${Tile} key=${b.t} icon=${typeIcon(b.t)} tone=${typeTone(b.t)} label=${b.t} value=${b.left} sub=${'of ' + b.total + ' days left' + (b.pend > 0 ? ' · ' + b.pend + ' pending' : '')}/>`)}</div>
    <div className="grid2b" style=${{ marginTop: 48 }}>
      <form className="card fm" onSubmit=${submit}>
        <h2>Apply for leave</h2>
        <div className="fld"><span className="lb">Type</span>
          <div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${bal.map(b => html`<button type="button" key=${b.t} className=${'chip' + (f.type === b.t ? ' on' : '')} onClick=${() => up({ type: b.t })}>${b.t}<small>${b.left - b.pend} left</small></button>`)}</div></div>
        <div className="two">
          <div className="fld"><label htmlFor="lv-from">From</label><input id="lv-from" className="inp" type="date" min=${TODISO} value=${f.from} onChange=${ev => up({ from: ev.target.value })}/></div>
          <div className="fld"><label htmlFor="lv-to">To</label><input id="lv-to" className="inp" type="date" min=${f.from || TODISO} value=${f.to} onChange=${ev => up({ to: ev.target.value })}/></div>
        </div>
        ${POLICY.half && html`<label className="ck" htmlFor="lv-half"><input id="lv-half" type="checkbox" checked=${f.half} disabled=${f.from !== f.to} onChange=${ev => up({ half: ev.target.checked })}/> Half day <span>${f.from !== f.to ? '(single-day requests only)' : ''}</span></label>`}
        <div className="fld"><label htmlFor="lv-why">Note for ${mgr.name.split(' ')[0]} ${POLICY.note ? '' : '(optional)'}</label><textarea id="lv-why" className="inp" value=${f.reason} onChange=${ev => up({ reason: ev.target.value })} placeholder="Add a short reason or handover note"></textarea></div>
        ${sent ? html`<div className="sum"><div className="sent"><${Icon} n="check" s=${18}/><div><strong>Request sent to ${mgr.name}</strong><span className="ok">You will see the decision in this list.</span></div></div></div>`
        : html`<div className="sum">${err ? html`<strong className="err">${err}</strong>`
          : wd ? html`<strong>${f.half && days === 0.5 ? 'Half a working day' : plural(wd.days, 'working day')}</strong>${fmtDay(pd(f.from))}${f.to !== f.from ? ' to ' + fmtDay(pd(f.to)) : ''}`
          : html`<strong>Choose your dates</strong>Working days are counted for you.`}
          ${wd && !err && (wd.wk > 0 || wd.hol.length > 0) && html`<p>Not counted: ${[wd.wk ? plural(wd.wk, 'weekend day') : '', ...wd.hol].filter(Boolean).join(', ')}.</p>`}
          ${wd && !err && clash.length > 0 && html`<p className="warn">${[...new Set(clash.map(t => BY[t.emp].name))].join(' and ')} in your team ${clash.length === 1 ? 'is' : 'are'} also out during this time.</p>`}</div>`}
        <button className="btn pri" type="submit" disabled=${!valid}>Send for approval</button>
      </form>
      <section><div className="sec-h"><h2>History</h2><span>${plural(hist.length, 'request')}</span></div>
        <div>${hist.length === 0 ? html`<div className="empty" style=${{ textAlign: 'left', padding: '12px 0' }}>You have not sent any requests yet.</div>` : hist.map(l => html`<div className="hx" key=${l.id}>
          <span className="row-t"><b>${l.type}${l.half ? ' · half day' : ''}</b><span>${range(l.from, l.to)} · ${plural(l.days, 'day')}${l.reason ? ' · ' + l.reason : ''}</span></span>
          <span className="pill" style=${{ '--c': LS_C[l.state] }}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span>
          ${(l.state === 'pending' || (l.state === 'approved' && l.from > TODISO)) && html`<button className="link" onClick=${() => setLeaves(ls => ls.filter(x => x.id !== l.id))}>${l.state === 'pending' ? 'Withdraw' : 'Cancel'}</button>`}</div>`)}</div></section>
    </div>
  </div>`;
}
