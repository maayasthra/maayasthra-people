import { useState, useEffect } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { Sheet, DueChip, PrioFlag } from './parts.jsx';
import { BY, activeEmps } from '../data.js';
import { COLS, PRIO, LABEL_C, PROJECT_COLORS, moveTask, newId, isOpen } from '../tasks.js';

function ProjectForm({ projects, setProjects, setTf, close }) {
  const [name, setName] = useState(''), [client, setClient] = useState(''), [color, setColor] = useState(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
  const save = () => { if (!name.trim()) return; const p = { id: 'p' + Date.now().toString(36), name: name.trim(), client: client.trim() || 'Internal', color }; setProjects(ps => [...ps, p]); setTf(f => ({ ...f, project: p.id })); close(); };
  return html`<${Sheet} title="New project" onClose=${close} footer=${html`<button className="btn ghost" onClick=${close}>Cancel</button><button className="btn pri" disabled=${!name.trim()} onClick=${save}>Create project</button>`}>
    <div className="fld"><label htmlFor="pj-n">Project name</label><input id="pj-n" className="inp" value=${name} onChange=${ev => setName(ev.target.value)} placeholder="For example, Packaging design"/></div>
    <div className="fld"><label htmlFor="pj-c">Client</label><input id="pj-c" className="inp" value=${client} onChange=${ev => setClient(ev.target.value)} placeholder="Client or team name"/></div>
    <div className="fld"><span className="lb">Colour</span><div className="pj-col">${PROJECT_COLORS.map(c => html`<button key=${c} className=${color === c ? 'on' : ''} style=${{ '--c': c }} onClick=${() => setColor(c)} aria-label=${'Colour ' + c}></button>`)}</div></div>
  <//>`;
}

export function TaskBoard({ tasks, setTasks, projects, setProjects, user, role, tf, setTf, tq, openTask }) {
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(null), [adding, setAdding] = useState(null), [title, setTitle] = useState(''), [pform, setPform] = useState(false);
  const PJ = Object.fromEntries(projects.map(p => [p.id, p]));
  const canMove = t => role === 'admin' || t.assignee === user.n || t.by === user.n;
  useEffect(() => { if (menu == null) return; const f = () => setMenu(null); document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, [menu]);

  const term = tq.trim().toLowerCase();
  const list = tasks.filter(t => (tf.project === 'all' || t.project === tf.project) && (tf.assignee === 'all' || String(t.assignee) === String(tf.assignee)) && (tf.prio === 'all' || t.prio === tf.prio)
    && (!tf.mine || t.assignee === user.n) && (!term || (t.title + ' ' + (BY[t.assignee] ? BY[t.assignee].name : '') + ' ' + t.labels.join(' ')).toLowerCase().includes(term)));
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name));

  const onOver = (ev, col) => {
    if (!drag) return; ev.preventDefault();
    const cards = [...ev.currentTarget.querySelectorAll('.kt:not(.dragging)')];
    const next = cards.find(c => ev.clientY < c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2);
    setOver({ col, before: next ? next.dataset.id : null });
  };
  const onDrop = (ev, col) => { ev.preventDefault(); if (drag) setTasks(ts => moveTask(ts, drag, col, over && over.col === col ? over.before : null)); setDrag(null); setOver(null); };
  const add = col => {
    if (!title.trim()) { setAdding(null); return; }
    const project = tf.project !== 'all' ? tf.project : projects[0].id;
    const nt = { id: newId(), project, title: title.trim(), desc: '', status: col, prio: 'med', assignee: user.n, due: '', labels: [], by: user.n, subs: [], comments: [], created: Date.now() };
    setTasks(ts => moveTask([...ts, nt], nt.id, col, null));
    setTitle(''); setAdding(null);
  };

  return html`<div>
    <div className="pg-h"><div><h1>Board</h1><p>${list.filter(isOpen).length} open tasks${tf.project !== 'all' && PJ[tf.project] ? ' in ' + PJ[tf.project].client + ' · ' + PJ[tf.project].name : ' across ' + projects.length + ' projects'}. Drag a card to change its status.</p></div>
      <button className="btn pri" onClick=${() => openTask('new', { project: tf.project !== 'all' ? tf.project : undefined })}><${Icon} n="plus" s=${16}/> New task</button></div>
    <div className="kb-bar">
      <div className="chips" style=${{ marginTop: 0, flex: 1, minWidth: 0 }}>
        <button className=${'chip' + (tf.project === 'all' ? ' on' : '')} onClick=${() => setTf({ ...tf, project: 'all' })}>All projects</button>
        ${projects.map(p => html`<button key=${p.id} className=${'chip' + (tf.project === p.id ? ' on' : '')} onClick=${() => setTf({ ...tf, project: p.id })}><i className="pdot" style=${{ '--c': p.color }}></i>${p.client}<small>${p.name}</small></button>`)}
        ${role === 'admin' && html`<button className="chip" onClick=${() => setPform(true)}><${Icon} n="plus" s=${13}/> Project</button>`}
      </div>
      <select id="kb-assignee" className="sel" value=${tf.assignee} onChange=${ev => setTf({ ...tf, assignee: ev.target.value })} aria-label="Assignee"><option value="all">Everyone</option>${people.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}</select>
      <select id="kb-prio" className="sel" value=${tf.prio} onChange=${ev => setTf({ ...tf, prio: ev.target.value })} aria-label="Priority"><option value="all">Any priority</option>${Object.entries(PRIO).map(([k, v]) => html`<option key=${k} value=${k}>${v[0]}</option>`)}</select>
      <button className=${'chip' + (tf.mine ? ' on' : '')} onClick=${() => setTf({ ...tf, mine: !tf.mine })} aria-pressed=${tf.mine}>Only mine</button>
    </div>
    <div className="kb">${COLS.map(([key, label, color]) => {
      const col = list.filter(t => t.status === key);
      return html`<section key=${key} className=${'kc' + (over && over.col === key ? ' over' : '')} onDragOver=${ev => onOver(ev, key)} onDrop=${ev => onDrop(ev, key)} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o && o.col === key ? null : o); }}>
        <header className="kc-h"><i className="pdot big" style=${{ '--c': color }}></i><b>${label}</b><span className="kc-n">${col.length}</span><span style=${{ flex: 1 }}></span>
          <button className="ib" onClick=${() => { setAdding(adding === key ? null : key); setTitle(''); }} aria-label=${'Add a task to ' + label}><${Icon} n="plus" s=${15}/></button></header>
        ${adding === key && html`<div className="kc-add"><input autoFocus className="inp" value=${title} placeholder="Task title, then Enter" onChange=${ev => setTitle(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') add(key); if (ev.key === 'Escape') setAdding(null); }} onBlur=${() => { if (!title.trim()) setAdding(null); }} aria-label="New task title"/></div>`}
        ${col.map(t => { const p = PJ[t.project], a = BY[t.assignee], sd = t.subs.filter(s => s.done).length;
          return html`<article key=${t.id} data-id=${t.id} className=${'kt' + (drag === t.id ? ' dragging' : '') + (over && over.col === key && over.before === t.id ? ' drop-before' : '') + (t.status === 'done' ? ' isdone' : '')}
            draggable=${canMove(t)} onDragStart=${ev => { setDrag(t.id); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
            <button className="kt-open" onClick=${() => openTask(t.id)} aria-label=${'Open ' + t.title}>
              ${t.labels.length > 0 && html`<span className="kt-l">${t.labels.slice(0, 3).map(l => html`<span key=${l} style=${{ '--c': LABEL_C[l] }}>${l}</span>`)}</span>`}
              <b className="kt-t">${t.title}</b>
              ${tf.project === 'all' && p && html`<span className="kt-p"><i className="pdot" style=${{ '--c': p.color }}></i>${p.client}</span>`}
              <span className="kt-m"><${DueChip} due=${t.due} status=${t.status}/><${PrioFlag} p=${t.prio}/></span>
            </button>
            <div className="kt-f">
              <span className="kt-s">${t.subs.length > 0 && html`<span><${Icon} n="check" s=${13}/>${sd}/${t.subs.length}</span>`}${t.comments.length > 0 && html`<span><${Icon} n="comment" s=${13}/>${t.comments.length}</span>`}</span>
              <span style=${{ flex: 1 }}></span>
              ${canMove(t) && html`<button className="kt-mv" onMouseDown=${ev => ev.stopPropagation()} onClick=${() => setMenu(menu === t.id ? null : t.id)} aria-label=${'Move ' + t.title} aria-expanded=${menu === t.id}>Move</button>`}
              ${a ? html`<span title=${a.name}><${Av} e=${a} s=${24}/></span>` : html`<span className="kt-un" title="Unassigned"></span>`}
            </div>
            ${menu === t.id && html`<div className="kt-menu" role="menu" onMouseDown=${ev => ev.stopPropagation()}>${COLS.map(c => html`<button key=${c[0]} role="menuitem" disabled=${c[0] === t.status} onClick=${() => { setTasks(ts => moveTask(ts, t.id, c[0], null)); setMenu(null); }}><i className="pdot" style=${{ '--c': c[2] }}></i>${c[1]}</button>`)}</div>`}
          </article>`; })}
        ${col.length === 0 && adding !== key && html`<div className="kc-e">${term || tf.assignee !== 'all' || tf.mine ? 'No matching tasks' : 'Drop a task here'}</div>`}
        ${over && over.col === key && over.before === null && col.length > 0 && html`<div className="kc-drop"></div>`}
      </section>`; })}</div>
    ${pform && html`<${ProjectForm} projects=${projects} setProjects=${setProjects} setTf=${setTf} close=${() => setPform(false)}/>`}
  </div>`;
}
