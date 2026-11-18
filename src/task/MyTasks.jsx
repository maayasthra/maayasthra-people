import { useState, useEffect } from 'react';

import { startSound, pendingSound, doneSound, deleteSound } from '../alerts.js';
import { html, Icon, HI } from '../ui.jsx';
import { WorkLog } from './WorkLog.jsx';
import { mkTask, completeCard, reopenCard, startTimer, pauseTimer, isDoing, myTasksOf, finishedBy, finishCard, unfinishCard } from '../tasks.js';
import { workedMs, workedIn, shortDur } from '../taskTime.js';
import { dayKey, dayStart } from '../attendance.js';

// My Tasks: Pending, In progress, Completed. Several cards can be In progress at once. Pause sends it back to Pending and keeps the time worked on it;
// the time so far shows on the card and fills the end-of-day report.
export function MyTasks({ tasks, setTasks, user, tq, openTask, canDelete, tick, onEdit, away }) {
  const [title, setTitle] = useState(''), [drag, setDrag] = useState(null), [over, setOver] = useState(null), [allDone, setAllDone] = useState(false), [adding, setAdding] = useState(false), [ask, setAsk] = useState(null), [tab, setTab] = useState('tasks');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);   // keeps the time on the cards fresh
  // The time on a card is today's time on it: the same figure the end-of-day report fills in
  const dFrom = dayStart(dayKey(now)), todayOf = t => workedIn(t, user.n, dFrom, dFrom + 86400000, now, away);
  const spent = t => { const d = todayOf(t); return d >= 60000 ? shortDur(d) + ' today' : workedMs(t, user.n, now) >= 60000 ? shortDur(workedMs(t, user.n, now)) + ' so far' : shortDur(d) + ' today'; };
  const term = tq.trim().toLowerCase();
  const mine = myTasksOf(tasks, user.n).filter(t => !term || t.title.toLowerCase().includes(term));
  const doing = mine.filter(t => isDoing(t, user.n));
  const fin = t => t.done || finishedBy(t, user.n);      // completed, or finished by me and waiting for a manager
  const todo = mine.filter(t => !fin(t) && !isDoing(t, user.n));
  const lastEnd = t => Math.max(0, ...(t.time || []).map(s => s.end || 0), t.created || 0);
  const done = mine.filter(fin).sort((a, b) => lastEnd(b) - lastEnd(a));
  const shownDone = allDone ? done : done.slice(0, 12);

  // The three moves. Any number of cards can be In progress at once.
  const toDoing = id => { startSound(); setTasks(ts => startTimer(ts, id, user.n)); };
  const toTodo = id => { pendingSound(); setTasks(ts => { const t = ts.find(x => x.id === id); return t && t.done ? reopenCard(ts, id, user.n) : t && finishedBy(t, user.n) ? unfinishCard(ts, id, user.n) : pauseTimer(ts, id, user.n); }); };
  const toDone = id => { doneSound(); setTasks(ts => canDelete ? completeCard(ts, id) : finishCard(ts, id, user.n)); };
  const drop = (ev, col) => { ev.preventDefault(); if (drag) { (col === 'doing' ? toDoing : col === 'todo' ? toTodo : toDone)(drag); } setDrag(null); setOver(null); };
  // Paste or type one task per line; Enter adds them
  const add = () => { const lines = title.split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) { setAdding(false); return; } setTasks(ts => [...ts, ...lines.map(l => mkTask({ title: l, cols: [user.n] }, user))]); setTitle(''); setAdding(false); };

  const Card = ({ t, col }) => {
    return html`<article key=${t.id} style=${t.retainer && t.rcolor ? { '--ret': t.rcolor } : undefined} className=${'mt3-k' + (col === 'done' ? ' isdone' : '') + (t.retainer ? ' is-ret' : '') + (col === 'doing' ? ' run' : '') + (drag === t.id ? ' dragging' : '')} draggable="true" onClick=${ev => { if (!ev.target.closest('button, a, input, textarea')) openTask(t.id); }} onDragStart=${ev => { setDrag(t.id); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
      <button className="mt3-t" onClick=${() => openTask(t.id)}>${t.title}</button>
      ${canDelete && ask === t.id && html`<div className="mt3-del" role="alert"><span>Delete this task?</span><button className="btn ghost sm" onClick=${() => setAsk(null)}>Keep</button><button className="btn danger sm" onClick=${() => { deleteSound(); setTasks(ts => ts.filter(x => x.id !== t.id)); setAsk(null); }}>Delete</button></div>`}
      <div className="mt3-f">
        ${col === 'doing' ? html`<span className="kt-st doing mt3-st"><i></i>In progress · ${spent(t)}${t.client ? ' · ' + t.client : ''}</span>` : col === 'done' ? html`<span className="mt3-st mt3-dn"><${Icon} n="check" s=${13}/>${t.done ? 'Completed' : 'Done · your manager will confirm'}${t.client ? ' · ' + t.client : ''}</span>` : workedMs(t, user.n, now) >= 60000 ? html`<span className="mt3-st mt3-ps" title="Time already worked on this task is kept">Paused · ${spent(t)}${t.client ? ' · ' + t.client : ''}</span>` : html`<span className="mt3-st">${t.client || 'Not started'}</span>`}
        <span className="mt3-a">
          ${canDelete && ask !== t.id && html`<button className="mt3-rm" onClick=${() => setAsk(t.id)} title="Delete this task" aria-label=${'Delete ' + t.title}><${Icon} n="trash" s=${15}/></button>`}
          ${col === 'todo' && html`<button className="btn pri sm" onClick=${() => toDoing(t.id)}>${workedMs(t, user.n, now) >= 60000 ? 'Resume' : 'Start'}</button>`}
          ${col === 'doing' && html`<button className="btn ghost sm" onClick=${() => toTodo(t.id)} title="Stop the clock. The time so far is kept.">Pause</button><button className="mt3-ok" onClick=${() => toDone(t.id)} title="Complete" aria-label=${'Complete ' + t.title}><${Icon} n="check" s=${14}/></button>`}
          ${col === 'done' && html`<button className="btn ghost sm" onClick=${() => toDoing(t.id)}>Reopen</button>`}
        </span>
      </div></article>`;
  };
  const Col = ({ id, label, list, empty }) => html`<section key=${id} className=${'mt3-col' + (over === id ? ' over' : '')} onDragOver=${ev => { if (drag) { ev.preventDefault(); setOver(id); } }} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o === id ? null : o); }} onDrop=${ev => drop(ev, id)}>
    <header><b>${label}</b><span className="kc-n">${list.length}</span></header>
    <div className="mt3-b">${list.map(t => Card({ t, col: id }))}${list.length === 0 && !(id === 'todo' && adding) && (id === 'todo' ? html`<button className="mt3-e mt3-add" onClick=${() => setAdding(true)}><span className="a1">${empty}</span><span className="a2"><${Icon} n="plus" s=${16}/> Add a new task</span></button>` : html`<div className="mt3-e">${empty}</div>`)}
      ${id === 'todo' && (adding
        ? html`<div className="kc-compose"><textarea autoFocus rows="2" value=${title} placeholder="What needs doing? One task per line." aria-label="New task" onChange=${ev => setTitle(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); add(); } if (ev.key === 'Escape') { setAdding(false); setTitle(''); } }} onBlur=${() => { if (!title.trim()) setAdding(false); }}></textarea>
            <div className="kc-compose-a"><small>Enter to add</small><span style=${{ flex: 1 }}></span><button className="ib" onMouseDown=${ev => ev.preventDefault()} onClick=${() => { setAdding(false); setTitle(''); }} aria-label="Cancel"><${Icon} n="x" s=${13}/></button><button className="btn pri sm" onMouseDown=${ev => ev.preventDefault()} onClick=${add}>Add</button></div></div>`
        : list.length > 0 ? html`<button className="mt3-e mt3-add slim" onClick=${() => setAdding(true)}><span className="a2"><${Icon} n="plus" s=${16}/> Add a new task</span></button>` : null)}
      ${id === 'done' && done.length > 12 && html`<button className="link" onClick=${() => setAllDone(a => !a)}>${allDone ? 'Show fewer' : 'Show all ' + done.length}</button>`}</div></section>`;

  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="mytasks" tone="blue"/>My Tasks</h1><p>${tab === 'log' ? 'Your day reports, by date' : doing.length ? doing.length + ' in progress' : 'Nothing in progress'}</p></div>
    </div>
    <div className="tabs" role="tablist" aria-label="View">${[['tasks', 'Tasks', 'mytasks'], ['log', 'Submitted work', 'eod']].map(([k, l, ic]) => html`<button key=${k} role="tab" aria-selected=${tab === k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}><${Icon} n=${ic} s=${17}/>${l}</button>`)}</div>
    ${tab === 'log' ? html`<${WorkLog} user=${user} tick=${tick} onEdit=${onEdit}/>` : html`<div className="mt3">
      ${Col({ id: 'todo', label: 'Pending', list: todo, empty: 'Nothing waiting.' })}
      ${Col({ id: 'doing', label: 'In progress', list: doing, empty: 'Press Start on a card to begin. You can run several at once. Pause or Done stops the clock.' })}
      ${Col({ id: 'done', label: 'Completed', list: shownDone, empty: 'Finished tasks appear here.' })}
    </div>`}
  </div>`;
}
