import { useState } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { useNow } from '../attendance.js';
import { mkTask, completeCard, reopenCard, startTimer, pauseTimer, isDoing, spentMs, fmtDur, closeSessions } from '../tasks.js';
import { TODISO } from '../data.js';

// My Tasks: To do, Doing, Completed. Moving a card to Doing starts its clock. Pausing or completing it stops the clock.
export function MyTasks({ tasks, setTasks, user, tq, openTask }) {
  const now = useNow(1000);
  const [title, setTitle] = useState(''), [drag, setDrag] = useState(null), [over, setOver] = useState(null), [allDone, setAllDone] = useState(false);
  const term = tq.trim().toLowerCase();
  const mine = tasks.filter(t => (t.cols.includes(user.n) || (t.done && (t.prev || []).includes(user.n))) && (!term || t.title.toLowerCase().includes(term)));
  const doing = mine.filter(t => isDoing(t, user.n));
  const todo = mine.filter(t => !t.done && !isDoing(t, user.n));
  const lastEnd = t => Math.max(0, ...(t.time || []).map(s => s.end || 0), t.created || 0);
  const done = mine.filter(t => t.done).sort((a, b) => lastEnd(b) - lastEnd(a));
  const shownDone = allDone ? done : done.slice(0, 12);
  const loggedToday = tasks.reduce((sum, t) => sum + (t.time || []).reduce((x, s) => s.emp === user.n ? x + Math.max(0, Math.min(s.end == null ? now : s.end, Infinity) - Math.max(s.start, new Date(TODISO + 'T00:00:00').getTime())) : x, 0), 0);

  // The three moves. Starting also pauses nothing else: someone can run more than one card at once.
  const toDoing = id => setTasks(ts => startTimer(ts, id, user.n));
  const toTodo = id => setTasks(ts => { const t = ts.find(x => x.id === id); return t && t.done ? reopenCard(ts, id, user.n) : pauseTimer(ts, id, user.n); });
  const toDone = id => setTasks(ts => completeCard(ts, id));
  const drop = (ev, col) => { ev.preventDefault(); if (drag) { (col === 'doing' ? toDoing : col === 'todo' ? toTodo : toDone)(drag); } setDrag(null); setOver(null); };
  const add = () => { if (!title.trim()) return; setTasks(ts => [...ts, mkTask({ title: title.trim(), cols: [user.n] }, user)]); setTitle(''); };

  const Card = ({ t, col }) => {
    const total = spentMs(t, now), mineMs = spentMs(t, now, user.n);
    return html`<article className=${'mt3-k' + (col === 'doing' ? ' run' : '') + (drag === t.id ? ' dragging' : '')} draggable="true" onDragStart=${ev => { setDrag(t.id); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
      <button className="mt3-t" onClick=${() => openTask(t.id)}>${t.title}</button>
      ${t.client && html`<small className="mt3-c">${t.client}</small>`}
      <div className="mt3-f">
        ${col === 'doing' ? html`<span className="mt3-tm live"><i></i>${fmtDur(mineMs, true)}</span>`
          : col === 'done' ? html`<span className="mt3-tm" title="Total time on this card">${total > 0 ? 'Took ' + fmtDur(total) : 'No time logged'}</span>`
          : html`<span className="mt3-tm">${mineMs > 0 ? fmtDur(mineMs) + ' so far' : 'Not started'}</span>`}
        <span className="mt3-a">
          ${col === 'todo' && html`<button className="btn pri sm" onClick=${() => toDoing(t.id)}><${Icon} n="timer" s=${14}/> Start</button>`}
          ${col === 'doing' && html`<button className="btn ghost sm" onClick=${() => toTodo(t.id)}>Pause</button><button className="mt3-ok" onClick=${() => toDone(t.id)} title="Complete" aria-label=${'Complete ' + t.title}><${Icon} n="check" s=${14}/></button>`}
          ${col === 'done' && html`<button className="btn ghost sm" onClick=${() => toDoing(t.id)}>Reopen</button>`}
        </span>
      </div></article>`;
  };
  const Col = ({ id, label, list, empty }) => html`<section className=${'mt3-col' + (over === id ? ' over' : '')} onDragOver=${ev => { if (drag) { ev.preventDefault(); setOver(id); } }} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o === id ? null : o); }} onDrop=${ev => drop(ev, id)}>
    <header><b>${label}</b><span className="kc-n">${list.length}</span></header>
    <div className="mt3-b">${list.map(t => html`<${Card} key=${t.id} t=${t} col=${id}/>`)}${list.length === 0 && html`<div className="mt3-e">${empty}</div>`}
      ${id === 'done' && done.length > 12 && html`<button className="link" onClick=${() => setAllDone(a => !a)}>${allDone ? 'Show fewer' : 'Show all ' + done.length}</button>`}</div></section>`;

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="mytasks" tone="blue"/>My Tasks</h1><p>${doing.length ? doing.length + ' in progress' : 'Nothing in progress'}${loggedToday > 0 ? ' · ' + fmtDur(loggedToday) + ' logged today' : ''}</p></div>
      <button className="btn pri" onClick=${() => openTask('new', { col: user.n })}><${Icon} n="plus" s=${16}/> New</button></div>
    <div className="mt-add"><input id="mt-add" className="inp" value=${title} placeholder="Add a task and press Enter" onChange=${ev => setTitle(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') add(); }} aria-label="Quick add a task"/></div>
    <div className="mt3">
      <${Col} id="todo" label="To do" list=${todo} empty="Nothing waiting. Add a task above."/>
      <${Col} id="doing" label="Doing" list=${doing} empty="Drag a card here, or press Start, to begin timing it."/>
      <${Col} id="done" label="Completed" list=${shownDone} empty="Finished tasks and the time they took appear here."/>
    </div>
  </div>`;
}
