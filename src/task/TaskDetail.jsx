import { useState } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { Sheet } from './parts.jsx';
import { BY, activeEmps, awayList, isAway, fmtDM } from '../data.js';
import { PRIO, LABELS, PINNED, DONE, mkTask, colName, completeCard, reopenCard } from '../tasks.js';

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };

export function TaskDetail({ id, ctx, tasks, setTasks, user, role, leaves, custom, close }) {
  const isNew = id === 'new';
  const existing = isNew ? null : tasks.find(t => t.id === id);
  const [draft, setDraft] = useState(() => mkTask({ cols: [ctx && ctx.col != null ? ctx.col : user.n] }, user));
  const [newSub, setNewSub] = useState(''), [comment, setComment] = useState(''), [confirm, setConfirm] = useState(false), [err, setErr] = useState('');
  const t = isNew ? draft : existing;
  if (!t) return null;
  const canEdit = role === 'admin' || isNew || t.cols.includes(user.n) || t.by === user.n || (t.prev || []).includes(user.n);
  const upd = p => { if (isNew) { setDraft(d => ({ ...d, ...p })); setErr(''); } else setTasks(ts => ts.map(x => x.id === t.id ? { ...x, ...p } : x)); };
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name));
  const away = awayList(leaves);
  const leaveNames = t.due ? t.cols.filter(c => typeof c === 'number' && BY[c] && isAway(c, t.due, away)).map(c => BY[c].name.split(' ')[0]) : [];
  const done = t.subs.filter(s => s.done).length;
  const addable = people.filter(e => !t.cols.includes(e.n));
  const addablePins = [...PINNED.map(p => [p[0], p[1]]), ...custom.map(c => [c.id, c.name])].filter(p => !t.cols.includes(p[0]));

  const create = () => { if (!t.title.trim()) { setErr('Give the card a title.'); return; } setTasks(ts => [...ts, { ...draft, title: draft.title.trim() }]); close(); };
  const addComment = () => { if (!comment.trim()) return; upd({ comments: [...t.comments, { id: Date.now(), by: user.n, text: comment.trim(), at: Date.now() }] }); setComment(''); };
  const addSub = () => { if (!newSub.trim()) return; upd({ subs: [...t.subs, { id: Date.now(), t: newSub.trim(), done: false }] }); setNewSub(''); };

  const footer = isNew ? html`<button className="btn ghost" onClick=${close}>Cancel</button><button className="btn pri" onClick=${create}>Create card</button>`
    : canEdit ? (confirm ? html`<span className="sh-c">Delete card?</span><button className="btn ghost sm" onClick=${() => setConfirm(false)}>Keep</button><button className="btn sm danger" onClick=${() => { setTasks(ts => ts.filter(x => x.id !== t.id)); close(); }}>Delete</button>`
      : html`<button className="btn ghost sm" onClick=${() => setConfirm(true)}><${Icon} n="trash" s=${15}/> Delete</button><span style=${{ flex: 1 }}></span><button className="btn pri" onClick=${close}>Done</button>`)
    : html`<span style=${{ flex: 1 }}></span><button className="btn pri" onClick=${close}>Close</button>`;

  return html`<${Sheet} title=${isNew ? 'New card' : 'Card'} onClose=${close} footer=${footer}>
    ${!canEdit && html`<div className="note-row" style=${{ marginBottom: 14 }}><${Icon} n="user" s=${16}/> <span>View only. You can comment.</span></div>`}
    <input id="td-title" autoFocus className="td-title" value=${t.title} disabled=${!canEdit} placeholder="Card title" onChange=${ev => upd({ title: ev.target.value })} aria-label="Card title"/>
    ${err && html`<div className="lg-err" role="alert">${err}</div>`}
    <div className="td-g one">
      <label>Due date<input className="inp" type="date" value=${t.due || ''} disabled=${!canEdit} onChange=${ev => upd({ due: ev.target.value })}/></label>
    </div>
    ${leaveNames.length > 0 && html`<div className="note-row warn" style=${{ marginTop: 12 }}><${Icon} n="bell" s=${16}/> <span>${leaveNames.join(', ')} on leave ${fmtDM(t.due)}</span></div>`}
    <div className="td-s"><span className="lb">On this card</span>
      <div className="as">${t.cols.map(c => html`<span className="as-c" key=${c}>${typeof c === 'number' && BY[c] ? html`<${Av} e=${BY[c]} s=${22}/>` : null}${colName(c, BY, custom)}${canEdit && t.cols.length > 1 && !t.done && html`<button onClick=${() => upd({ cols: t.cols.filter(x => x !== c) })} aria-label=${'Remove from ' + colName(c, BY, custom)}><${Icon} n="x" s=${11}/></button>`}</span>`)}</div>
      ${canEdit && !t.done && html`<select className="inp" value="" onChange=${ev => { const v = ev.target.value; if (v) upd({ cols: [...t.cols, /^\d+$/.test(v) ? Number(v) : v] }); }} aria-label="Add to a column"><option value="">Add to a column…</option>${addablePins.map(p => html`<option key=${p[0]} value=${p[0]}>${p[1]}</option>`)}${addable.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}</select>`}</div>
    <div className="td-s"><span className="lb">Priority</span><div className="seg s3" role="group" aria-label="Priority" style=${{ width: 280, margin: 0 }}>${Object.entries(PRIO).map(([k, v]) => html`<button key=${k} disabled=${!canEdit} className=${t.prio === k ? 'on' : ''} onClick=${() => upd({ prio: k })}>${v[0]}</button>`)}</div></div>
    <div className="td-s"><span className="lb">Labels</span><div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${LABELS.map(l => html`<button key=${l} disabled=${!canEdit} className=${'chip' + (t.labels.includes(l) ? ' on' : '')} onClick=${() => upd({ labels: t.labels.includes(l) ? t.labels.filter(x => x !== l) : [...t.labels, l] })}>${l}</button>`)}</div></div>
    <div className="td-s"><label className="lb" htmlFor="td-desc">Description</label><textarea id="td-desc" className="inp" value=${t.desc} disabled=${!canEdit} placeholder="Notes" onChange=${ev => upd({ desc: ev.target.value })}></textarea></div>
    <div className="td-s"><span className="lb">Subtasks ${t.subs.length ? '· ' + done + ' of ' + t.subs.length : ''}</span>
      ${t.subs.map(s => html`<div className="sub" key=${s.id}><button className=${'ck-c' + (s.done ? ' on' : '')} disabled=${!canEdit} onClick=${() => upd({ subs: t.subs.map(x => x.id === s.id ? { ...x, done: !x.done } : x) })} aria-label=${(s.done ? 'Mark not done: ' : 'Mark done: ') + s.t}>${s.done && html`<${Icon} n="check" s=${12}/>`}</button>
        <span className=${s.done ? 'dn' : ''}>${s.t}</span>${canEdit && html`<button className="link" onClick=${() => upd({ subs: t.subs.filter(x => x.id !== s.id) })} aria-label=${'Remove ' + s.t}>Remove</button>`}</div>`)}
      ${canEdit && html`<div className="td-add"><input className="inp" value=${newSub} placeholder="Add a subtask" onChange=${ev => setNewSub(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addSub(); }} aria-label="New subtask"/><button className="btn ghost sm" onClick=${addSub}>Add</button></div>`}</div>
    ${!isNew && html`<div className="td-s"><div className="sub" style=${{ padding: 0 }}><button className=${'ck-c' + (t.done ? ' on' : '')} disabled=${!canEdit} onClick=${() => setTasks(ts => t.done ? reopenCard(ts, t.id, user.n) : completeCard(ts, t.id))} aria-label="Mark card complete">${t.done && html`<${Icon} n="check" s=${12}/>`}</button><span>${t.done ? 'Completed' : 'Mark this card complete'}</span></div></div>
    <div className="td-s"><span className="lb">Comments ${t.comments.length ? '· ' + t.comments.length : ''}</span>
      ${t.comments.map(c => BY[c.by] && html`<div className="cmt" key=${c.id}><${Av} e=${BY[c.by]} s=${30}/><div><b>${BY[c.by].name}</b><small>${ago(c.at)}</small><p>${c.text}</p></div></div>`)}
      <div className="td-add"><input className="inp" value=${comment} placeholder="Write a comment" onChange=${ev => setComment(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addComment(); }} aria-label="New comment"/><button className="btn ghost sm" onClick=${addComment}>Post</button></div></div>`}
  <//>`;
}
