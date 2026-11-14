import { useState } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { fmtH } from '../eodDb.js';
import { HOL, pd, fmtDM, TODISO } from '../data.js';

/* Hours charts for the EOD reports page. Two series: Reported (what people wrote in their end-of-day report) and Tracked (time
   recorded by the Start / Pause timers on task cards). Colours are the validated chart palette (see untitled.css, .eh).
   Each chart has a table view, bars grow from one baseline, and the value is only printed where it helps. */
const hrs = ms => ms / 3600000;
const working = iso => { const w = new Date(pd(iso)).getUTCDay(); return w !== 0 && w !== 6 && !HOL[iso]; };
const wd = iso => new Date(pd(iso)).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });

function Card({ title, sub, legend, table, children }) {
  const [tab, setTab] = useState('chart');
  return html`<section className="eh-c">
    <header><div><h2>${title}</h2>${sub && html`<p>${sub}</p>`}</div>
      <div className="seg eh-seg" role="group" aria-label=${title + ' view'}>${[['chart', 'Chart'], ['table', 'Table']].map(([k, l]) => html`<button key=${k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</div></header>
    ${tab === 'chart' ? html`${legend && html`<div className="eh-lg">${legend.map(([c, l]) => html`<span key=${l}><i className=${'eh-k ' + c}></i>${l}</span>`)}</div>`}<div className="eh-body">${children}</div>`
      : html`<div className="eh-tw"><table className="eh-tbl"><thead><tr>${table.head.map((h, i) => html`<th key=${i} className=${i ? 'r' : ''}>${h}</th>`)}</tr></thead>
        <tbody>${table.rows.map((r, i) => html`<tr key=${i}>${r.map((c, j) => html`<td key=${j} className=${j ? 'r' : ''}>${c}</td>`)}</tr>`)}</tbody></table></div>`}
  </section>`;
}

// A small hover/focus tip that follows the pointer inside a chart body
function useTip() {
  const [tip, setTip] = useState(null);
  const show = (ev, lines) => { const b = ev.currentTarget.closest('.eh-body'), r = b.getBoundingClientRect(), t = ev.type === 'focus' ? ev.currentTarget.getBoundingClientRect() : { left: ev.clientX, top: ev.clientY, width: 0, height: 0 }; setTip({ x: Math.min(t.left - r.left + t.width / 2, r.width - 190), y: t.top - r.top + t.height, lines }); };
  const el = tip && html`<div className="eh-tip" role="tooltip" style=${{ left: Math.max(4, tip.x + 10), top: tip.y + 12 }}>${tip.lines.map((l, i) => html`<div key=${i} className=${i ? 'r' : 'h'}>${Array.isArray(l) ? html`<i className=${'eh-k ' + l[0]}></i><span>${l[1]}</span><b>${l[2]}</b>` : l}</div>`)}</div>`;
  return { show, hide: () => setTip(null), el };
}
const gap = (rep, trk) => trk > 0 && rep > 0 ? (rep >= trk ? '+' : '−') + fmtH(Math.abs(rep - trk)) : '';

/* Hours by person: two thin bars each (reported, tracked) and a tick for the shift length */
export function HoursByPerson({ data, onOpen, days }) {
  const tip = useTip(), max = Math.max(1, ...data.map(d => Math.max(d.rep, d.trk, d.target))) * 1.12;
  return html`<${Card} title="Hours by person" sub=${'Reported and tracked time. The tick marks the shift length' + (days > 1 ? ' for the days shown.' : '.')}
    legend=${[['rep', 'Reported'], ['trk', 'Tracked on tasks'], ['tgt', 'Shift']]}
    table=${{ head: ['Person', 'Reported', 'Tracked', 'Difference', 'Shift'], rows: data.map(d => [d.e.name, fmtH(d.rep), fmtH(d.trk), gap(d.rep, d.trk) || '–', fmtH(d.target)]) }}>
    ${data.map(d => html`<button key=${d.e.n} className="eh-r" onClick=${() => onOpen(d.e.n)} onMouseMove=${ev => tip.show(ev, [d.e.name, ['rep', 'Reported', fmtH(d.rep)], ['trk', 'Tracked on tasks', fmtH(d.trk)], ['tgt', 'Shift', fmtH(d.target)]])} onMouseLeave=${tip.hide} onFocus=${ev => tip.show(ev, [d.e.name, ['rep', 'Reported', fmtH(d.rep)], ['trk', 'Tracked on tasks', fmtH(d.trk)]])} onBlur=${tip.hide}
      aria-label=${d.e.name + ': reported ' + fmtH(d.rep) + ', tracked ' + fmtH(d.trk)}>
      <span className="eh-n"><${Av} e=${d.e} s=${24}/><b>${d.e.name}</b></span>
      <span className="eh-b"><span className="eh-t">
        <i className="eh-m rep" style=${{ width: d.rep / max * 100 + '%' }}></i><i className="eh-m trk" style=${{ width: d.trk / max * 100 + '%' }}></i>
        ${d.target > 0 && html`<i className="eh-tg" style=${{ left: d.target / max * 100 + '%' }}></i>`}
        <span className="eh-v" style=${{ left: Math.max(d.rep, d.trk) / max * 100 + '%' }}>${fmtH(d.rep)}</span></span></span></button>`)}
    ${tip.el}<//>`;
}

/* Hours per day over a week or month: a pair of columns per day */
export function HoursByDay({ days, rep, trk, target, who }) {
  const tip = useTip(), vals = days.map(d => [(rep[d] || 0), hrs(trk[d] || 0)]);
  const top = Math.max(4, Math.ceil(Math.max(0, ...vals.flat(), (target || 0) * 1.15) / 2) * 2), month = days.length > 8;
  return html`<${Card} title="Hours per day" sub=${who} legend=${[['rep', 'Reported'], ['trk', 'Tracked on tasks']].concat(target ? [['tgt', 'Shift']] : [])}
    table=${{ head: ['Day', 'Reported', 'Tracked', 'Difference'], rows: days.filter(d => working(d) || rep[d] || trk[d]).map(d => [wd(d) + ' ' + fmtDM(d), fmtH(rep[d] || 0), fmtH(hrs(trk[d] || 0)), gap(rep[d] || 0, hrs(trk[d] || 0)) || '–']) }}>
    <div className=${'eh-cv' + (month ? ' eh-mon' : '')}>
      <div className="eh-y" aria-hidden="true">${[top, top / 2, 0].map(v => html`<span key=${v}>${v}h</span>`)}</div>
      <div className="eh-pl">
        <div className="eh-gl" aria-hidden="true"><i></i><i></i><i></i></div>
        ${target > 0 && target <= top && html`<div className="eh-tl" style=${{ bottom: target / top * 100 + '%' }}><span>Shift ${fmtH(target)}</span></div>`}
        <div className="eh-cs">${days.map((d, i) => { const [a, b] = vals[i], off = !working(d) && !a && !b;
          return html`<div key=${d} className=${'eh-col' + (off ? ' off' : '') + (d === TODISO ? ' now' : '')} tabIndex=${off ? -1 : 0} aria-label=${wd(d) + ' ' + fmtDM(d) + ': reported ' + fmtH(a) + ', tracked ' + fmtH(b)}
            onMouseMove=${ev => !off && tip.show(ev, [wd(d) + ' ' + fmtDM(d), ['rep', 'Reported', fmtH(a)], ['trk', 'Tracked on tasks', fmtH(b)]])} onMouseLeave=${tip.hide} onFocus=${ev => tip.show(ev, [wd(d) + ' ' + fmtDM(d), ['rep', 'Reported', fmtH(a)], ['trk', 'Tracked on tasks', fmtH(b)]])} onBlur=${tip.hide}>
            <span className="eh-pr"><i className="eh-cb rep" style=${{ height: a / top * 100 + '%' }}></i><i className="eh-cb trk" style=${{ height: b / top * 100 + '%' }}></i></span>
            <span className="eh-x">${month ? (i === 0 || (i + 1) % 5 === 0 ? Number(d.slice(8)) : '') : wd(d)}</span></div>`; })}</div></div>
    </div>${tip.el}<//>`;
}

/* Where the time went: ranked bars by project, one colour, biggest first */
export function HoursByProject({ items, total }) {
  const tip = useTip(), max = Math.max(1, ...items.map(x => x.h)) * 1.18;
  return html`<${Card} title="Where the time went" sub="Reported hours by project"
    table=${{ head: ['Project', 'Hours', 'Share'], rows: items.map(x => [x.name, fmtH(x.h), Math.round(x.h / total * 100) + '%']) }}>
    ${items.map(x => html`<div key=${x.name} className="eh-r pj" tabIndex="0" aria-label=${x.name + ': ' + fmtH(x.h) + ', ' + Math.round(x.h / total * 100) + ' percent'}
      onMouseMove=${ev => tip.show(ev, [x.name, ['rep', 'Hours', fmtH(x.h)], ['tgt', 'Share', Math.round(x.h / total * 100) + '%']])} onMouseLeave=${tip.hide} onFocus=${ev => tip.show(ev, [x.name, ['rep', 'Hours', fmtH(x.h)]])} onBlur=${tip.hide}>
      <span className="eh-n"><b title=${x.name}>${x.name}</b></span>
      <span className="eh-b one"><span className="eh-t"><i className=${'eh-m rep' + (x.other ? ' other' : '')} style=${{ width: x.h / max * 100 + '%' }}></i>
        <span className="eh-v" style=${{ left: x.h / max * 100 + '%' }}>${fmtH(x.h)} <small>${Math.round(x.h / total * 100)}%</small></span></span></span></div>`)}
    ${tip.el}<//>`;
}
