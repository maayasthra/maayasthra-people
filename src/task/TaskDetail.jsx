import { useState } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { Sheet } from './parts.jsx';
import { BY, TODISO, activeEmps, awayList, isAway, fmtDM, isoOf } from '../data.js';
import { COLS, PRIO, LABELS, LABEL_C, newId, moveTask } from '../tasks.js';

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };

export function TaskDetail({ id, ctx, tasks, setTasks, projects, user, role, leaves, close }) {
  const isNew = id === 'new';
  const existing = isNew ? null : tasks.find(t => t.id === id);
  const [draft, setDraft] = useState(() => ({ id: newId(), project: (ctx && ctx.project) || projects[0].id, title: '', desc: '', status: (ctx && ctx.status) || 'todo', prio: 'med', assignee: user.n, due: '', labels: [], by: user.n, subs: [], comments: [], created: Date.now() }));
  const [newSub, setNewSub] = useState(''), [comment, setComment] = useState(''), [confirm, setConfirm] = useState(false), [err, setErr] = useState('');
  const t = isNew ? draft : existing;
  if (!t) return null;
  const canEdit = role === 'admin' || isNew || t.assignee === user.n || t.by === user.n;
  const upd = p => {
    if (isNew) { setDraft(d => ({ ...d, ...p })); setErr(''); return; }
    setTasks(ts => p.status && p.status !== t.status ? moveTask(ts.map(x => x.id === t.id ? { ...x, ...p } : x), t.id, p.status) : ts.map(x => x.id === t.id ? { ...x, ...p } : x));
  };
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name));
  const away = awayList(leaves);
  const onLeave = t.assignee && t.due && BY[t.assignee] && isAway(t.assignee, t.due, away);
  const done = t.subs.filter(s => s.done).length;

  const create = () => {
    if (!t.title.trim()) { setErr('Give the task a title.'); return; }
    setTasks(ts => moveTask([...ts, { ...draft, title: draft.title.trim() }], draft.id, draft.status));
    close();
  };
  const addComment = () => { if (!comment.trim()) return; upd({ comments: [...t.comments, { id: Date.now(), by: user.n, text: comment.trim(), at: Date.now() }] }); setComment(''); };
  const addSub = () => { if (!newSub.trim()) return; upd({ subs: [...t.subs, { id: Date.now(), t: newSub.trim(), done: false }] }); setNewSub(''); };

  const footer = isNew ? html`<button className="btn ghost" onClick=${close}>Cancel</button><button className="btn pri" onClick=${create}>Create task</button>`
    : canEdit ? (confirm ? html`<span className="sh-c">Delete this task?</span><button className="btn ghost sm" onClick=${() => setConfirm(false)}>Keep</button><button className="btn sm danger" onClick=${() => { setTasks(ts => ts.filter(x => x.id !== t.id)); close(); }}>Delete</button>`
      : html`<button className="btn ghost sm" onClick=${() => setConfirm(true)}><${Icon} n="trash" s=${15}/> Delete</button><span style=${{ flex: 1 }}></span><button className="btn pri" onClick=${close}>Done</button>`)
    : html`<span style=${{ flex: 1 }}></span><button className="btn pri" onClick=${close}>Close</button>`;

  return html`<${Sheet} title=${isNew ? 'New task' : 'Task'} onClose=${close} footer=${footer}>
    ${!canEdit && html`<div className="note-row" style=${{ marginBottom: 14 }}><${Icon} n="user" s=${16}/> Only the assignee, the creator and admins can edit this task. You can still comment.</div>`}
    <input id="td-title" className="td-title" value=${t.title} disabled=${!canEdit} placeholder="Task title" onChange=${ev => upd({ title: ev.target.value })} aria-label="Task title"/>
    ${err && html`<div className="lg-err" role="alert">${err}</div>`}
    <div className="td-g">
      <label>Project<select className="inp" value=${t.project} disabled=${!canEdit} onChange=${ev => upd({ project: ev.target.value })}>${projects.map(p => html`<option key=${p.id} value=${p.id}>${p.client} · ${p.name}</option>`)}</select></label>
      <label>Status<select className="inp" value=${t.status} disabled=${!canEdit} onChange=${ev => upd({ status: ev.target.value })}>${COLS.map(c => html`<option key=${c[0]} value=${c[0]}>${c[1]}</option>`)}</select></label>
      <label>Assignee<select className="inp" value=${t.assignee || ''} disabled=${!canEdit} onChange=${ev => upd({ assignee: ev.target.value ? Number(ev.target.value) : null })}><option value="">Unassigned</option>${people.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}</select></label>
      <label>Due date<input className="inp" type="date" value=${t.due || ''} disabled=${!canEdit} onChange=${ev => upd({ due: ev.target.value })}/></label>
    </div>
    ${onLeave && html`<div className="note-row warn" style=${{ marginTop: 12 }}><${Icon} n="bell" s=${16}/> ${BY[t.assignee].name.split(' ')[0]} is on leave on ${fmtDM(t.due)}. Consider another date or assignee.</div>`}
    <div className="td-s"><span className="lb">Priority</span><div className="seg s3" role="group" aria-label="Priority" style=${{ width: 280, margin: 0 }}>${Object.entries(PRIO).map(([k, v]) => html`<button key=${k} disabled=${!canEdit} className=${t.prio === k ? 'on' : ''} onClick=${() => upd({ prio: k })}>${v[0]}</button>`)}</div></div>
    <div className="td-s"><span className="lb">Labels</span><div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${LABELS.map(l => html`<button key=${l} disabled=${!canEdit} className=${'chip' + (t.labels.includes(l) ? ' on' : '')} onClick=${() => upd({ labels: t.labels.includes(l) ? t.labels.filter(x => x !== l) : [...t.labels, l] })}>${l}</button>`)}</div></div>
    <div className="td-s"><label className="lb" htmlFor="td-desc">Description</label><textarea id="td-desc" className="inp" value=${t.desc} disabled=${!canEdit} placeholder="Add details, links or notes" onChange=${ev => upd({ desc: ev.target.value })}></textarea></div>
    <div className="td-s"><span className="lb">Subtasks ${t.subs.length ? '· ' + done + ' of ' + t.subs.length : ''}</span>
      ${t.subs.map(s => html`<div className="sub" key=${s.id}><button className=${'ck-c' + (s.done ? ' on' : '')} disabled=${!canEdit} onClick=${() => upd({ subs: t.subs.map(x => x.id === s.id ? { ...x, done: !x.done } : x) })} aria-label=${(s.done ? 'Mark not done: ' : 'Mark done: ') + s.t}>${s.done && html`<${Icon} n="check" s=${12}/>`}</button>
        <span className=${s.done ? 'dn' : ''}>${s.t}</span>${canEdit && html`<button className="link" onClick=${() => upd({ subs: t.subs.filter(x => x.id !== s.id) })} aria-label=${'Remove ' + s.t}>Remove</button>`}</div>`)}
      ${canEdit && html`<div className="td-add"><input className="inp" value=${newSub} placeholder="Add a subtask" onChange=${ev => setNewSub(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addSub(); }} aria-label="New subtask"/><button className="btn ghost sm" onClick=${addSub}>Add</button></div>`}</div>
    ${!isNew && html`<div className="td-s"><span className="lb">Comments ${t.comments.length ? '· ' + t.comments.length : ''}</span>
      ${t.comments.map(c => BY[c.by] && html`<div className="cmt" key=${c.id}><${Av} e=${BY[c.by]} s=${30}/><div><b>${BY[c.by].name}</b><small>${ago(c.at)}</small><p>${c.text}</p></div></div>`)}
      <div className="td-add"><input className="inp" value=${comment} placeholder="Write a comment" onChange=${ev => setComment(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addComment(); }} aria-label="New comment"/><button className="btn ghost sm" onClick=${addComment}>Post</button></div></div>`}
  <//>`;
}
