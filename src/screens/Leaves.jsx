import { useState } from 'react';
import { useConfirm } from '../Confirm.jsx';
import { html, Icon, Tile, HI, Switch } from '../ui.jsx';
import { DateField } from '../DateField.jsx';
import { FilterBar, matches } from '../Filters.jsx';
import { typeIcon, typeTone } from './Home.jsx';
import { TOD, DAY, TODISO, BY, POLICY, isoOf, pd, fmtDay, plural, range, workDays, balances, noticeDays, TEAM_LEAVES, HOL } from '../data.js';

// These can be taken without the usual notice
const NO_NOTICE = ['Sick leave', 'Emergency leave'];
const LS_C = { pending:'#FF9F0A', approved:'#30D158', declined:'#FF453A' };

export function MyLeaves({ leaves, setLeaves, user }) {
  const [cfEl, ask] = useConfirm();
  const me = user, mgr = { name: 'People & Ops' };
  const mine = leaves.filter(l => l.emp === me.n);
  // Open on a day that can actually be booked: far enough ahead, and not a weekend or holiday.
  const start = (() => { let t = TOD + (POLICY.notice + 5) * DAY; while ([0, 6].includes(new Date(t).getUTCDay()) || HOL[isoOf(t)]) t += DAY; return isoOf(t); })();
  const [f, setF] = useState({ type: 'Casual leave', from: start, to: start, reason: '', half: false });
  const [sent, setSent] = useState(false), [fq, setFq] = useState(''), [fs, setFs] = useState('all'), [ft, setFt] = useState('all');
  const up = p => { setF(o => { const n = { ...o, ...p }; if (n.from && n.to && n.to < n.from && p.from) n.to = n.from; if (n.from !== n.to) n.half = false; return n; }); setSent(false); };
  const bal = balances(mine);
  const cur = bal.find(b => b.t === f.type) || bal[0], avail = cur.left - cur.pend;
  const ok = f.from && f.to;
  const wd = ok && f.to >= f.from ? workDays(f.from, f.to) : null;
  const days = wd ? (f.half && f.from === f.to && wd.days === 1 ? 0.5 : wd.days) : 0;
  let err = '';
  if (ok && f.to < f.from) err = 'The end date is before the start date.';
  else if (ok && f.from < TODISO) err = 'Choose a start date from today onwards.';
  else if (ok && mine.some(l => (l.state === 'pending' || l.state === 'approved') && f.from <= l.to && f.to >= l.from)) err = 'You already have leave on those dates.';
  else if (wd && wd.days === 0) err = 'Those dates fall on weekends or holidays only.';
  else if (wd && !NO_NOTICE.includes(f.type) && noticeDays(f.from) < POLICY.notice) err = 'Planned leave needs ' + plural(POLICY.notice, 'working day') + ' notice. Sick and emergency leave are exempt.';
  else if (wd && days > avail) err = 'You have ' + plural(Math.max(avail, 0), 'day') + ' of ' + f.type.toLowerCase() + ' available.';
  else if (POLICY.note && !f.reason.trim()) err = 'Add a short note for the approver.';
  const valid = ok && wd && !err;
  const clash = wd ? [...TEAM_LEAVES, ...leaves.filter(l => l.state === 'approved')].filter(t => t.emp !== me.n && BY[t.emp] && BY[t.emp].dept === me.dept && f.from <= t.to && f.to >= t.from) : [];
  const submit = ev => {
    ev.preventDefault(); if (!valid) return;
    setLeaves(ls => [{ id: Date.now(), emp: me.n, type: f.type, from: f.from, to: f.to, days, half: days === 0.5, reason: f.reason.trim(), state: 'pending', sent: 'Just now' }, ...ls]);
    setSent(true); setF(o => ({ ...o, reason: '', half: false }));
  };
  const hist = [...mine].sort((a, b) => b.from.localeCompare(a.from)), histShown = hist.filter(l => matches(fq, l.type, l.reason) && (fs === 'all' || l.state === fs) && (ft === 'all' || l.type === ft));
  return html`<div>
    ${cfEl}
    <div className="pg-h"><div><h1><${HI} n="leaves" tone="green"/>My Leaves</h1><p>${new Date(TOD).getUTCFullYear()}</p></div></div>
    <div className="tiles t3">${bal.map(b => html`<${Tile} key=${b.t} icon=${typeIcon(b.t)} tone=${typeTone(b.t)} label=${b.t} value=${b.left} sub=${'of ' + b.total + ' days left' + (b.pend > 0 ? ' · ' + b.pend + ' pending' : '')}/>`)}</div>
    <div className="grid2b" style=${{ marginTop: 48 }}>
      <form className="card fm lf" onSubmit=${submit}>
        <h2>Apply for leave</h2>
        <div className="lf-types" role="radiogroup" aria-label="Leave type">${bal.map(b => html`<button type="button" role="radio" aria-checked=${f.type === b.t} key=${b.t} className=${'lf-t' + (f.type === b.t ? ' on' : '')} onClick=${() => up({ type: b.t })}>
          <span className="lf-ti"><${Icon} n=${typeIcon(b.t)} s=${17}/></span><b>${b.t.replace(' leave', '')}</b><small>${Math.max(b.left - b.pend, 0)} days left</small></button>`)}</div>
        <div className="two">
          <div className="fld"><label htmlFor="lv-from">From</label><${DateField} id="lv-from" min=${TODISO} value=${f.from} onChange=${v => up({ from: v })}/></div>
          <div className="fld"><label htmlFor="lv-to">To</label><${DateField} id="lv-to" min=${f.from || TODISO} value=${f.to} onChange=${v => up({ to: v })}/></div>
        </div>
        ${POLICY.half && html`<div className=${'lf-row' + (f.from !== f.to ? ' dis' : '')}><span><b>Half day</b><small>${f.from !== f.to ? 'Only for a single day' : 'Take half of the day off'}</small></span><${Switch} on=${f.half} set=${v => f.from === f.to && up({ half: v })} label="Half day"/></div>`}
        <div className="fld"><label htmlFor="lv-why">Note for the approver ${POLICY.note ? '' : '(optional)'}</label><textarea id="lv-why" className="inp" value=${f.reason} onChange=${ev => up({ reason: ev.target.value })} placeholder="Why are you taking leave?"></textarea></div>
        ${sent ? html`<div className="lf-s ok" role="status"><span><${Icon} n="check" s=${18}/></span><div><b>Request sent</b><em>Waiting for approval.</em></div></div>`
          : err ? html`<div className="lf-s bad" role="alert"><span><${Icon} n="bell" s=${18}/></span><div><b>${err}</b></div></div>`
          : wd ? html`<div className="lf-s"><span><${Icon} n="calendar" s=${18}/></span><div><b>${f.half && days === 0.5 ? 'Half a working day' : plural(wd.days, 'working day')}</b><em>${fmtDay(pd(f.from))}${f.to !== f.from ? ' to ' + fmtDay(pd(f.to)) : ''}</em>
            ${(wd.wk > 0 || wd.hol.length > 0) && html`<p>Not counted: ${[wd.wk ? plural(wd.wk, 'weekend day') : '', ...wd.hol].filter(Boolean).join(', ')}.</p>`}
            ${clash.length > 0 && html`<p className="warn">${[...new Set(clash.map(t => BY[t.emp].name))].join(' and ')} in your team ${clash.length === 1 ? 'is' : 'are'} also out during this time.</p>`}</div></div>`
          : html`<div className="lf-s muted"><span><${Icon} n="calendar" s=${18}/></span><div><b>Pick your dates</b></div></div>`}
        <button className="btn pri lf-send" type="submit" disabled=${!valid}>Send request</button>
      </form>
      <section><div className="sec-h"><h2>History</h2><span>${plural(hist.length, 'request')}</span></div>
        ${hist.length > 3 && html`<${FilterBar} q=${fq} setQ=${setFq} placeholder="Search reason" shown=${histShown.length} total=${hist.length} noun="requests" groups=${[
          { label: 'Status', value: fs, set: setFs, options: [['all', 'All statuses'], ['pending', 'Pending'], ['approved', 'Approved'], ['declined', 'Declined']] },
          { label: 'Leave type', value: ft, set: setFt, options: [['all', 'All types'], ...[...new Set(hist.map(l => l.type))].map(t => [t, t])] }]}/>`}
        ${hist.length === 0 ? html`<div className="empty" style=${{ textAlign: 'left', padding: '12px 0' }}>No requests</div>`
          : histShown.length === 0 ? html`<div className="tc-empty"><b>No requests match</b>Try a different search or clear the filters.</div>`
          : html`<div className="tc stk" role="table" aria-label="Your leave requests">${histShown.map(l => html`<article className="tc-r" key=${l.id}>
            <div className="tc-who"><span><b>${l.type}${l.half ? ' · half day' : ''}</b><small>${range(l.from, l.to)} ${l.from.slice(0, 4)}</small></span></div>
            <div data-l="Duration"><b>${l.half ? 'Half day' : plural(l.days, 'day')}</b></div>
            <div data-l="Status"><span className=${'pay-s ' + (l.state === 'approved' ? 'ok' : l.state === 'declined' ? 'err' : 'warn')}><i></i>${l.state[0].toUpperCase() + l.state.slice(1)}</span>${l.by && l.state !== 'pending' && html`<small>by ${l.byId === me.n ? 'you' : l.by}</small>`}</div>
            ${l.reason && html`<div data-l="Reason" data-w="all" title=${l.reason}><span className="tc-fn">${l.reason}</span></div>`}
            ${(l.state === 'pending' || (l.state === 'approved' && l.from > TODISO)) && html`<div className="tc-act"><button className="btn ghost sm" onClick=${async () => { const was = l.state === 'pending'; if (await ask({ title: was ? 'Withdraw this request?' : 'Cancel your approved leave?', icon: 'leaves', danger: true, confirm: was ? 'Withdraw request' : 'Cancel leave', body: l.type + ' \u00b7 ' + range(l.from, l.to) + ' \u00b7 ' + plural(l.days, 'day'), items: [{ tone: 'warn', text: was ? 'It will not be sent for approval.' : 'Your approved leave is cancelled and the days go back to your balance.' }] })) setLeaves(ls => ls.filter(x => x.id !== l.id)); }}>${l.state === 'pending' ? 'Withdraw' : 'Cancel leave'}</button></div>`}
          </article>`)}</div>`}</section>
    </div>
  </div>`;
}
