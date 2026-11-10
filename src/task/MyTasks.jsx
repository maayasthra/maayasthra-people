import { useState } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { mkTask, completeCard, reopenCard, startTimer, pauseTimer, isDoing, myTasksOf } from '../tasks.js';

// My Tasks: Pending, In progress, Completed. In progress is a marker for what you are on right now; it resets when you check out.
export function MyTasks({ tasks, setTasks, user, tq, openTask, canDelete }) {
  const [title, setTitle] = useState(''), [drag, setDrag] = useState(null), [over, setOver] = useState(null), [allDone, setAllDone] = useState(false), [adding, setAdding] = useState(false), [ask, setAsk] = useState(null);
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
  // Paste or type one task per line; Enter adds them
  const add = () => { const lines = title.split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) { setAdding(false); return; } setTasks(ts => [...ts, ...lines.map(l => mkTask({ title: l, cols: [user.n] }, user))]); setTitle(''); setAdding(false); };

  const Card = ({ t, col }) => {
    return html`<article className=${'mt3-k' + (t.retainer ? ' is-ret' : '') + (col === 'doing' ? ' run' : '') + (drag === t.id ? ' dragging' : '')} draggable="true" onClick=${ev => { if (!ev.target.closest('button, a, input, textarea')) openTask(t.id); }} onDragStart=${ev => { setDrag(t.id); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
      <button className="mt3-t" onClick=${() => openTask(t.id)}>${t.title}</button>
      ${t.client && html`<small className="mt3-c">${t.client}</small>`}
      ${canDelete && ask === t.id && html`<div className="mt3-del" role="alert"><span>Delete this task?</span><button className="btn ghost sm" onClick=${() => setAsk(null)}>Keep</button><button className="btn danger sm" onClick=${() => { setTasks(ts => ts.filter(x => x.id !== t.id)); setAsk(null); }}>Delete</button></div>`}
      <div className="mt3-f">
        <span className="mt3-tm">${col === 'doing' ? 'In progress' : col === 'done' ? 'Completed' : ''}</span>
        <span className="mt3-a">
          ${canDelete && ask !== t.id && html`<button className="mt3-rm" onClick=${() => setAsk(t.id)} title="Delete this task" aria-label=${'Delete ' + t.title}><${Icon} n="trash" s=${15}/></button>`}
          ${col === 'todo' && html`<button className="btn pri sm" onClick=${() => toDoing(t.id)}>Start</button>`}
          ${col === 'doing' && html`<button className="btn ghost sm" onClick=${() => toTodo(t.id)}>Back to pending</button><button className="mt3-ok" onClick=${() => toDone(t.id)} title="Complete" aria-label=${'Complete ' + t.title}><${Icon} n="check" s=${14}/></button>`}
          ${col === 'done' && html`<button className="btn ghost sm" onClick=${() => toDoing(t.id)}>Reopen</button>`}
        </span>
      </div></article>`;
  };
  const Col = ({ id, label, list, empty }) => html`<section key=${id} className=${'mt3-col' + (over === id ? ' over' : '')} onDragOver=${ev => { if (drag) { ev.preventDefault(); setOver(id); } }} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o === id ? null : o); }} onDrop=${ev => drop(ev, id)}>
    <header><b>${label}</b><span className="kc-n">${list.length}</span></header>
    <div className="mt3-b">${list.map(t => html`<${Card} key=${t.id} t=${t} col=${id}/>`)}${list.length === 0 && html`<div className="mt3-e">${empty}</div>`}
      ${id === 'todo' && (adding
        ? html`<div className="kc-compose"><textarea autoFocus rows="2" value=${title} placeholder="What needs doing? One task per line." aria-label="New task" onChange=${ev => setTitle(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); add(); } if (ev.key === 'Escape') { setAdding(false); setTitle(''); } }} onBlur=${() => { if (!title.trim()) setAdding(false); }}></textarea>
            <div className="kc-compose-a"><small>Enter to add</small><span style=${{ flex: 1 }}></span><button className="ib" onMouseDown=${ev => ev.preventDefault()} onClick=${() => { setAdding(false); setTitle(''); }} aria-label="Cancel"><${Icon} n="x" s=${13}/></button><button className="btn pri sm" onMouseDown=${ev => ev.preventDefault()} onClick=${add}>Add</button></div></div>`
        : html`<button className="kc-new mt3-new" onClick=${() => setAdding(true)}><${Icon} n="plus" s=${15}/>New task</button>`)}
      ${id === 'done' && done.length > 12 && html`<button className="link" onClick=${() => setAllDone(a => !a)}>${allDone ? 'Show fewer' : 'Show all ' + done.length}</button>`}</div></section>`;

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="mytasks" tone="blue"/>My Tasks</h1><p>${doing.length ? doing.length + ' in progress' : 'Nothing in progress'}</p></div>
      <button className="btn pri" onClick=${() => openTask('new', { col: user.n })}><${Icon} n="plus" s=${16}/> New</button></div>
    <div className="mt3">
      ${Col({ id: 'todo', label: 'Pending', list: todo, empty: 'Nothing waiting.' })}
      ${Col({ id: 'doing', label: 'In progress', list: doing, empty: 'Drag a card here, or press Start, to mark what you are on.' })}
      ${Col({ id: 'done', label: 'Completed', list: shownDone, empty: 'Finished tasks appear here.' })}
    </div>
  </div>`;
}
