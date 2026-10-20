import { useState, useMemo } from 'react';
import { html, Icon, first } from '../ui.jsx';
import { TOD, DAY, WDL, MONL, pd, fmt, fmtDM, fmtDay, rel, plural, isoOf, TODISO, HOL, BY, awayList, activeEmps } from '../data.js';

/* ---------- Calendar ---------- */
const KIND = { holiday:['Holiday','#FE6D00'], birthday:['Birthday','#E8B93F'], anniv:['Anniversary','#46D39A'], leave:['Time off','#B79BF2'] };
const KORDER = ['holiday','birthday','anniv','leave'];
function itemsFor(k, away) {
  const y = Number(k.slice(0,4)), md = k.slice(5), out = [], wkd = new Date(pd(k)).getUTCDay();
  if (HOL[k]) out.push({ kind:'holiday', label:HOL[k], short:HOL[k], sub:WDL[wkd] });
  activeEmps().forEach(e => {
    if (e.dob.slice(5) === md) out.push({ kind:'birthday', label:e.name, short:first(e) + ' · bday', sub:'Turns ' + (y - Number(e.dob.slice(0,4))), emp:e.n });
    const jy = Number(e.join.slice(0,4));
    if (e.join.slice(5) === md && y > jy) out.push({ kind:'anniv', label:e.name, short:first(e) + ' · ' + (y - jy) + ' yr', sub:plural(y - jy, 'year') + ' at Maayasthra', emp:e.n });
  });
  if (wkd !== 0 && wkd !== 6 && !HOL[k]) away.forEach(l => { if (k >= l.from && k <= l.to) out.push({ kind:'leave', label:BY[l.emp].name, short:first(BY[l.emp]) + ' away', sub:l.type + ' until ' + fmtDM(l.to), emp:l.emp }); });
  return out.sort((a, b) => KORDER.indexOf(a.kind) - KORDER.indexOf(b.kind));
}
const Item = ({ it, open }) => {
  const inner = html`<i style=${{ '--c': KIND[it.kind][1] }}></i><span className="it-t"><b>${it.label}</b><small>${KIND[it.kind][0]}${it.sub ? ' · ' + it.sub : ''}</small></span>`;
  return it.emp ? html`<button className="it" onClick=${() => open(it.emp)}>${inner}</button>` : html`<div className="it">${inner}</div>`;
};
export function CalendarView({ leaves, open }) {
  const T0 = new Date(TOD), thisM = { y: T0.getUTCFullYear(), m: T0.getUTCMonth() };
  const [cur, setCur] = useState(thisM);
  const [sel, setSel] = useState(TODISO);
  const [on, setOn] = useState({ holiday:true, birthday:true, anniv:true, leave:true });
  const away = useMemo(() => awayList(leaves), [leaves]);
  const dim = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(cur.y, cur.m, 1)).getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(isoOf(Date.UTC(cur.y, cur.m, d)));
  while (cells.length % 7) cells.push(null);
  const go = n => {
    const t = new Date(Date.UTC(cur.y, cur.m + n, 1)); const y = t.getUTCFullYear(), m = t.getUTCMonth();
    setCur({ y, m }); setSel(y === thisM.y && m === thisM.m ? TODISO : isoOf(Date.UTC(y, m, 1)));
  };
  const back = () => { setCur(thisM); setSel(TODISO); };
  const dayItems = itemsFor(sel, away).filter(i => on[i.kind]);
  const selT = pd(sel), sd = rel(Math.round((selT - TOD) / DAY));
  const nextHol = Object.keys(HOL).sort().filter(k => k >= TODISO).slice(0, 4);
  return html`<div>
    <div className="cal-top"><h1>${MONL[cur.m]} <span>${cur.y}</span></h1>
      <div className="cal-nav"><button className="btn ghost" onClick=${back}>Today</button>
        <button className="ib" onClick=${() => go(-1)} aria-label="Previous month"><${Icon} n="back" s=${16}/></button>
        <button className="ib" onClick=${() => go(1)} aria-label="Next month"><${Icon} n="next" s=${16}/></button></div></div>
    <div className="legend">${KORDER.map(k => html`<button key=${k} className=${'lg' + (on[k] ? ' on' : '')} aria-pressed=${on[k]} onClick=${() => setOn({ ...on, [k]: !on[k] })}><i style=${{ '--c': KIND[k][1] }}></i>${({ holiday:'Holidays', birthday:'Birthdays', anniv:'Anniversaries', leave:'Team time off' })[k]}</button>`)}</div>
    <div className="cal">
      <div className="mg">
        <div className="dows">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => html`<span key=${d}>${d}</span>`)}</div>
        <div className="days">${cells.map((k, i) => {
          if (!k) return html`<div key=${'b' + i} className="cell blank"></div>`;
          const its = itemsFor(k, away).filter(x => on[x.kind]), w = new Date(pd(k)).getUTCDay();
          const lv = its.filter(x => x.kind === 'leave'), lab = lv.length ? [...its.filter(x => x.kind !== 'leave'), { kind:'leave', short: lv.length + ' away' }] : its;
          return html`<button key=${k} className=${'cell' + (k === sel ? ' sel' : '') + (k === TODISO ? ' today' : '') + (w === 0 || w === 6 ? ' we' : '')} onClick=${() => setSel(k)} aria-label=${fmtDay(pd(k)) + ', ' + its.length + ' items'}>
            <span className="num">${Number(k.slice(8))}</span>
            ${lab.slice(0, 2).map((x, j) => html`<span key=${j} className=${'cl' + (x.kind === 'holiday' ? ' hol' : '')}><i style=${{ '--c': KIND[x.kind][1] }}></i>${x.short}</span>`)}
            ${lab.length > 2 && html`<span className="cl more">+${lab.length - 2} more</span>`}
            ${its.length > 0 && html`<span className="dots">${its.slice(0, 4).map((x, j) => html`<i key=${j} style=${{ '--c': KIND[x.kind][1] }}></i>`)}</span>`}
          </button>`; })}</div>
      </div>
      <aside className="dp">
        <h2>${WDL[new Date(selT).getUTCDay()]}, ${fmtDM(sel)}</h2>
        <div className="dp-s">${sd}${sel === TODISO ? '' : ' · ' + fmt(sel)}</div>
        <div className="dp-l">${dayItems.length ? dayItems.map((it, i) => html`<${Item} key=${i} it=${it} open=${open}/>`) : html`<div className="empty" style=${{ textAlign: 'left', padding: '22px 0' }}>Nothing on this day.</div>`}</div>
        <div className="dp-n"><h3>Next holidays</h3>${nextHol.map(k => html`<div className="hl" key=${k}>${HOL[k]}<span>${fmtDay(pd(k))}</span></div>`)}</div>
      </aside>
    </div>
  </div>`;
}

