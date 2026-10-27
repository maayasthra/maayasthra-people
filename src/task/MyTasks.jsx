import { useState } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { mkTask, completeCard, reopenCard, startTimer, pauseTimer, isDoing, myTasksOf } from '../tasks.js';

// My Tasks: To do, Doing, Completed. Doing is a marker for what you are on right now; it resets when you check out.
export function MyTasks({ tasks, setTasks, user, tq, openTask }) {
  const [title, setTitle] = useState(''), [drag, setDrag] = useState(null), [over, setOver] = useState(null), [allDone, setAllDone] = useState(false);
  const term = tq.trim().toLowerCase();
  const mine = myTasksOf(tasks, user.n).filter(t => !term || t.title.toLowerCase().includes(term));
  const doing = mine.filter(t => isDoing(t, user.n));
  const todo = mine.filter(t => !t.done && !isDoing(t, user.n));
  const lastEnd = t => Math.max(0, ...(t.time || []).map(s => s.end || 0), t.created || 0);
  const done = mine.filter(t => t.done).sort((a, b) => lastEnd(b) - lastEnd(a));
  const shownDone = allDone ? done : done.slice(0, 12);

  // The three moves. Any number of cards can be Doing at once.
  const toDoing = id => setTasks(ts => startTimer(ts, id, user.n));
  const toTodo = id => setTasks(ts => { const t = ts.find(x => x.id === id); return t && t.done ? reopenCard(ts, id, user.n) : pauseTimer(ts, id, user.n); });
  const toDone = id => setTasks(ts => completeCard(ts, id));
  const drop = (ev, col) => { ev.preventDefault(); if (drag) { (col === 'doing' ? toDoing : col === 'todo' ? toTodo : toDone)(drag); } setDrag(null); setOver(null); };
  const add = () => { if (!title.trim()) return; setTasks(ts => [...ts, mkTask({ title: title.trim(), cols: [user.n] }, user)]); setTitle(''); };

  const Card = ({ t, col }) => {
    return html`<article className=${'mt3-k' + (col === 'doing' ? ' run' : '') + (drag === t.id ? ' dragging' : '')} draggable="true" onDragStart=${ev => { setDrag(t.id); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
      <button className="mt3-t" onClick=${() => openTask(t.id)}>${t.title}</button>
      ${t.client && html`<small className="mt3-c">${t.client}</small>`}
      <div className="mt3-f">
        <span className="mt3-tm">${col === 'doing' ? 'In progress' : col === 'done' ? 'Completed' : ''}</span>
        <span className="mt3-a">
          ${col === 'todo' && html`<button className="btn pri sm" onClick=${() => toDoing(t.id)}>Start</button>`}
          ${col === 'doing' && html`<button className="btn ghost sm" onClick=${() => toTodo(t.id)}>Back to to do</button><button className="mt3-ok" onClick=${() => toDone(t.id)} title="Complete" aria-label=${'Complete ' + t.title}><${Icon} n="check" s=${14}/></button>`}
          ${col === 'done' && html`<button className="btn ghost sm" onClick=${() => toDoing(t.id)}>Reopen</button>`}
        </span>
      </div></article>`;
  };
  const Col = ({ id, label, list, empty }) => html`<section className=${'mt3-col' + (over === id ? ' over' : '')} onDragOver=${ev => { if (drag) { ev.preventDefault(); setOver(id); } }} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o === id ? null : o); }} onDrop=${ev => drop(ev, id)}>
    <header><b>${label}</b><span className="kc-n">${list.length}</span></header>
    <div className="mt3-b">${list.map(t => html`<${Card} key=${t.id} t=${t} col=${id}/>`)}${list.length === 0 && html`<div className="mt3-e">${empty}</div>`}
      ${id === 'done' && done.length > 12 && html`<button className="link" onClick=${() => setAllDone(a => !a)}>${allDone ? 'Show fewer' : 'Show all ' + done.length}</button>`}</div></section>`;

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="mytasks" tone="blue"/>My Tasks</h1><p>${doing.length ? doing.length + ' in progress' : 'Nothing in progress'}</p></div>
      <button className="btn pri" onClick=${() => openTask('new', { col: user.n })}><${Icon} n="plus" s=${16}/> New</button></div>
    <div className="mt-add"><input id="mt-add" className="inp" value=${title} placeholder="Add a task and press Enter" onChange=${ev => setTitle(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') add(); }} aria-label="Quick add a task"/></div>
    <div className="mt3">
      <${Col} id="todo" label="To do" list=${todo} empty="Nothing waiting. Add a task above."/>
      <${Col} id="doing" label="Doing" list=${doing} empty="Drag a card here, or press Start, to mark what you are on."/>
      <${Col} id="done" label="Completed" list=${shownDone} empty="Finished tasks appear here."/>
    </div>
  </div>`;
}
