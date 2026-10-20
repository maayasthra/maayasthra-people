import { useState } from 'react';
import { html, Icon } from '../ui.jsx';
import { DueChip, PrioFlag } from './parts.jsx';
import { TODISO, TOD, DAY, isoOf } from '../data.js';
import { COL, moveTask, newId, dueState, isOpen } from '../tasks.js';

export function MyTasks({ tasks, setTasks, projects, user, tq, openTask }) {
  const PJ = Object.fromEntries(projects.map(p => [p.id, p]));
  const [showDone, setShowDone] = useState(false), [title, setTitle] = useState('');
  const term = tq.trim().toLowerCase();
  const mine = tasks.filter(t => t.assignee === user.n && (!term || t.title.toLowerCase().includes(term)));
  const open = mine.filter(isOpen), done = mine.filter(t => !isOpen(t));
  const week = isoOf(TOD + 7 * DAY);
  const groups = [
    ['Overdue', open.filter(t => t.due && t.due < TODISO), 'over'],
    ['Today', open.filter(t => t.due === TODISO), 'today'],
    ['This week', open.filter(t => t.due > TODISO && t.due <= week), ''],
    ['Later', open.filter(t => t.due > week), ''],
    ['No due date', open.filter(t => !t.due), '']
  ].map(([l, ts, c]) => [l, ts.sort((a, b) => (a.due || '9').localeCompare(b.due || '9')), c]);
  const toggle = t => setTasks(ts => moveTask(ts, t.id, t.status === 'done' ? 'todo' : 'done', null));
  const add = () => { if (!title.trim()) return; const nt = { id: newId(), project: projects[0].id, title: title.trim(), desc: '', status: 'todo', prio: 'med', assignee: user.n, due: TODISO, labels: [], by: user.n, subs: [], comments: [], created: Date.now() }; setTasks(ts => moveTask([...ts, nt], nt.id, 'todo', null)); setTitle(''); };
  const Row = ({ t }) => { const p = PJ[t.project]; return html`<div className=${'mt-r' + (t.status === 'done' ? ' done' : '')}>
    <button className=${'ck-c big' + (t.status === 'done' ? ' on' : '')} onClick=${() => toggle(t)} aria-label=${(t.status === 'done' ? 'Reopen ' : 'Complete ') + t.title}>${t.status === 'done' && html`<${Icon} n="check" s=${13}/>`}</button>
    <button className="mt-t" onClick=${() => openTask(t.id)}><b>${t.title}</b><span>${p ? p.client + ' · ' + p.name : ''}${t.status !== 'todo' && t.status !== 'done' ? ' · ' + COL[t.status][1] : ''}</span></button>
    <span className="mt-m"><${DueChip} due=${t.due} status=${t.status}/><${PrioFlag} p=${t.prio}/></span></div>`; };
  return html`<div>
    <div className="pg-h"><div><h1>My Tasks</h1><p>${open.length ? open.length + ' open' + (groups[0][1].length ? ', ' + groups[0][1].length + ' overdue' : '') + '.' : 'Nothing open. Enjoy the quiet.'}</p></div>
      <button className="btn pri" onClick=${() => openTask('new', {})}><${Icon} n="plus" s=${16}/> New task</button></div>
    <div className="mt-add"><input id="mt-add" className="inp" value=${title} placeholder="Add a task for today, then press Enter" onChange=${ev => setTitle(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') add(); }} aria-label="Quick add a task"/></div>
    ${groups.filter(g => g[1].length).map(([label, ts, c]) => html`<section className="mt-g" key=${label}><div className="sec-h"><h2 className=${c}>${label}</h2><span>${ts.length}</span></div><div className="card" style=${{ padding: '2px 18px' }}>${ts.map(t => html`<${Row} key=${t.id} t=${t}/>`)}</div></section>`)}
    ${open.length === 0 && html`<div className="none"><b>You are all caught up</b>Tasks assigned to you will appear here.</div>`}
    ${done.length > 0 && html`<section className="mt-g"><button className="link" onClick=${() => setShowDone(s => !s)}>${showDone ? 'Hide' : 'Show'} ${done.length} completed</button>
      ${showDone && html`<div className="card" style=${{ padding: '2px 18px', marginTop: 12 }}>${done.map(t => html`<${Row} key=${t.id} t=${t}/>`)}</div>`}</section>`}
  </div>`;
}
