import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { pendingSound, doneSound, deleteSound } from '../alerts.js';
import { html, Icon, Av, Switch } from '../ui.jsx';
import { Sheet } from './parts.jsx';
import { BY, activeEmps } from '../data.js';
import { PRIO, LABELS, PINNED, mkTask, colName, completeCard, reopenCard, statusOf, startTimer, pauseTimer, stopFor } from '../tasks.js';

const RET_COLORS = ['#0A84FF', '#BF5AF2', '#FF375F', '#FF9F0A', '#FFD60A', '#30D158', '#30B0C7', '#8E8E93'];
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };

export function TaskDetail({ id, ctx, tasks, setTasks, user, role, custom, close }) {
  const isNew = id === 'new';
  const existing = isNew ? null : tasks.find(t => t.id === id);
  const [draft, setDraft] = useState(() => mkTask({ cols: [ctx && ctx.col != null ? ctx.col : user.n] }, user));
  const [newSub, setNewSub] = useState(''), [addingSub, setAddingSub] = useState(false), [dragSub, setDragSub] = useState(null), [overSub, setOverSub] = useState(null), [comment, setComment] = useState(''), [editSub, setEditSub] = useState(null), [editVal, setEditVal] = useState(''), [sm, setSm] = useState(null), [smQ, setSmQ] = useState(''), [keepSub, setKeepSub] = useState(false), [made, setMade] = useState(''), [stm, setStm] = useState(null), [confirm, setConfirm] = useState(false), [err, setErr] = useState('');
  const t = isNew ? draft : existing;
  useEffect(() => { if (!sm) return; const off = () => setSm(null); document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off); }, [!!sm]);
  useEffect(() => { if (!stm) return; const off = () => setStm(null); document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off); }, [!!stm]);
  if (!t) return null;
  const mgr = role === 'admin' || role === 'pm';
  const canEdit = mgr || isNew || t.cols.includes(user.n) || t.by === user.n || (t.prev || []).includes(user.n);
  const upd = p => { if (isNew) { setDraft(d => ({ ...d, ...p })); setErr(''); } else setTasks(ts => ts.map(x => x.id === t.id ? { ...x, ...p } : x)); };
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name));
  const done = t.subs.filter(s => s.done).length;
  const addable = people.filter(e => !t.cols.includes(e.n));
  const addablePins = [...PINNED.map(p => [p[0], p[1]]), ...custom.map(c => [c.id, c.name])].filter(p => !t.cols.includes(p[0]));

  const create = () => { if (!t.title.trim()) { setErr('Give the card a title.'); return; } setTasks(ts => [...ts, { ...draft, title: draft.title.trim() }]); close(); };
  const addComment = () => { if (!comment.trim()) return; upd({ comments: [...t.comments, { id: Date.now(), by: user.n, text: comment.trim(), at: Date.now() }] }); setComment(''); };
  const addSub = () => { if (!newSub.trim()) return; upd({ subs: [...t.subs, { id: Date.now() + t.subs.length, t: newSub.trim(), done: false }] }); setNewSub(''); };
  const renameSub = (sid, v) => { const val = v.trim(); setEditSub(null); if (val && val !== (t.subs.find(x => x.id === sid) || {}).t) upd({ subs: t.subs.map(x => x.id === sid ? { ...x, t: val } : x) }); };
  // A subtask becomes its own card, titled "Main card: subtask", and goes to the chosen person
  const makeMain = (sub, person) => {
    const title = t.title.trim() + ' : ' + sub.t;
    setTasks(ts => { const nt = mkTask({ title, client: t.client, prio: t.prio, labels: t.labels, cols: [person] }, user); return [...(keepSub ? ts : ts.map(x => x.id === t.id ? { ...x, subs: x.subs.filter(q => q.id !== sub.id) } : x)), nt]; });
    setMade('Made “' + title + '” and gave it to ' + (BY[person] ? BY[person].name : 'them') + '.'); setSm(null); setSmQ('');
  };
  const stNow = t.done ? 'done' : statusOf(t).k;
  const ST = { new: ['Not started', 'var(--faint)'], idle: ['Paused', '#F5B301'], doing: ['In progress', '#30D158'], done: ['Completed', '#30D158'] };
  const setStatus = v => {
    setStm(null);
    if (v === 'doing') { setTasks(ts => startTimer(ts, t.id, user.n)); }
    else if (v === 'done') { doneSound(); setTasks(ts => completeCard(ts, t.id)); }
    else { if (t.done) { pendingSound(); setTasks(ts => reopenCard(ts, t.id, user.n)); } else setTasks(ts => pauseTimer(ts, t.id, user.n)); }
  };
  const toggleDone = () => { t.done ? pendingSound() : doneSound(); setTasks(ts => t.done ? reopenCard(ts, t.id, user.n) : completeCard(ts, t.id)); };

  const footer = isNew ? html`<button className="btn ghost" onClick=${close}>Cancel</button><span style=${{ flex: 1 }}></span><button className="btn pri" onClick=${create}>Create card</button>`
    : mgr ? (confirm ? html`<span className="sh-c">Delete this card?</span><button className="btn ghost" onClick=${() => setConfirm(false)}>Keep</button><button className="btn danger" onClick=${() => { deleteSound(); setTasks(ts => ts.filter(x => x.id !== t.id)); close(); }}>Delete</button>`
      : html`<button className="td2-del" onClick=${() => setConfirm(true)}><${Icon} n="trash" s=${15}/> Delete task</button><span style=${{ flex: 1 }}></span><span className="td2-saved"><${Icon} n="check" s=${14}/>Changes save automatically</span><button className="btn pri" onClick=${close}>Done</button>`)
    : html`<span style=${{ flex: 1 }}></span><button className="btn pri" onClick=${close}>${canEdit ? 'Done' : 'Close'}</button>`;

  return html`<${Sheet} title=${isNew ? 'New task' : 'Task details'} onClose=${close} footer=${footer}>
    ${!canEdit && html`<div className="note-row" style=${{ marginBottom: 14 }}><${Icon} n="user" s=${16}/> <span>View only. You are not on this card.</span></div>`}
    <div className="td2-top">
      ${!isNew && html`<button className=${'td2-tick' + (t.done ? ' on' : '')} disabled=${!canEdit} onClick=${toggleDone} title=${t.done ? 'Reopen' : 'Mark complete'} aria-label=${t.done ? 'Reopen this task' : 'Mark this task complete'}><${Icon} n="check" s=${15}/></button>`}
      <div className="td2-tw">
        <textarea id="td-title" rows="1" autoFocus=${isNew} className="td-title" value=${t.title} disabled=${!canEdit} placeholder="Task name" aria-label="Task name" title=${canEdit ? 'Click to rename' : undefined} ref=${el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} onChange=${ev => upd({ title: ev.target.value.replace(/\n/g, ' ') })} onKeyDown=${ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); } }}></textarea>
        ${canEdit && html`<span className="td2-pen" aria-hidden="true"><${Icon} n="edit" s=${15}/></span>`}
      </div>
    </div>
    ${!isNew && html`<div className="td2-stw"><button className=${'td2-st-b s-' + stNow} disabled=${!canEdit} aria-haspopup="listbox" aria-expanded=${!!stm} onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setStm(stm ? null : { x: r.left, y: r.bottom + 6 }); }}><i style=${{ background: ST[stNow][1] }}></i>${ST[stNow][0]}${(stNow === 'doing' || stNow === 'idle') && statusOf(t).who.length > 0 ? html`<span className="td2-who">· ${statusOf(t).who.map(n => BY[n] ? BY[n].name.split(' ')[0] : '').filter(Boolean).join(', ')}</span>` : null}${canEdit && html`<${Icon} n="chevD" s=${14}/>`}</button></div>`}
    ${stm && createPortal(html`<div className="cm td2-stm" role="listbox" aria-label="Status" style=${{ left: stm.x, top: stm.y }} onMouseDown=${ev => ev.stopPropagation()}>
      ${[['new', 'Not started', 'Nobody is working on it'], ['doing', 'In progress', 'Start your timer on it'], ['done', 'Completed', 'Move it to Completed Tasks']].map(([k, label, hint]) => { const off = k === 'doing' && !t.cols.includes(user.n); return html`<button key=${k} role="option" aria-selected=${stNow === k || (k === 'new' && stNow === 'idle')} disabled=${off} title=${off ? 'Only people on this card can start it' : undefined} onClick=${() => setStatus(k)}><i style=${{ background: ST[k][1] }}></i><span><b>${label}</b><small>${hint}</small></span>${(stNow === k || (k === 'new' && stNow === 'idle')) && html`<${Icon} n="check" s=${14}/>`}</button>`; })}
    </div>`, document.body)}
    ${err && html`<div className="lg-err" role="alert">${err}</div>`}

    ${made && html`<div className="td2-made" role="status"><${Icon} n="check" s=${15}/><span>${made}</span><button className="ib" onClick=${() => setMade('')} aria-label="Dismiss"><${Icon} n="x" s=${13}/></button></div>`}
    ${sm && (sub => sub && createPortal(html`<div className="cm td2-sm" style=${{ left: sm.x, top: sm.y }} role="menu" onMouseDown=${ev => ev.stopPropagation()}>
      ${sm.stage === 'root'
        ? html`<button role="menuitem" onClick=${() => { setEditSub(sub.id); setEditVal(sub.t); setSm(null); }}><${Icon} n="edit" s=${15}/> Rename</button>
            ${mgr && !isNew && html`<button role="menuitem" onClick=${() => setSm({ ...sm, stage: 'assign' })}><${Icon} n="next" s=${15}/> Make it a main card…</button>`}
            <button role="menuitem" className="cm-d" onClick=${() => { upd({ subs: t.subs.filter(x => x.id !== sub.id) }); setSm(null); }}><${Icon} n="trash" s=${15}/> Remove subtask</button>`
        : html`<div className="cm-h"><button className="ib" onClick=${() => setSm({ ...sm, stage: 'root' })} aria-label="Back"><${Icon} n="chevL" s=${14}/></button><b>Give it to…</b></div>
            <div className="td2-mm"><small>New card</small><b>${t.title.trim()} : ${sub.t}</b></div>
            <div className="cm-q"><${Icon} n="search" s=${15}/><input autoFocus className="inp" value=${smQ} onChange=${ev => setSmQ(ev.target.value)} placeholder="Find a person" aria-label="Find a person"/></div>
            <div className="cm-l">${people.filter(e => e.name.toLowerCase().includes(smQ.trim().toLowerCase())).map(e => html`<button key=${e.n} role="menuitem" onClick=${() => makeMain(sub, e.n)}><${Av} e=${e} s=${24}/><span className="cm-n">${e.name}</span></button>`)}</div>
            <label className="td2-keep"><input type="checkbox" checked=${keepSub} onChange=${ev => setKeepSub(ev.target.checked)}/> Also keep it on this card</label>`}
    </div>`, document.body))(t.subs.find(x => x.id === sm.id))}
    <div className="td2-grid">
    <div className="td2-main">
    <section className="td2-sec">
      <div className="td2-h"><b>Subtasks</b>${t.subs.length > 0 && html`<span className="td2-n">${done} of ${t.subs.length}</span>`}</div>
      <div className="td2-list">
        ${t.subs.map(s => html`<div className=${'td2-sub' + (dragSub === s.id ? ' dragging' : '') + (overSub === s.id && dragSub && dragSub !== s.id ? ' drop' : '')} key=${s.id} draggable=${canEdit && t.subs.length > 1}
          onDragStart=${ev => { if (ev.target.closest('button,input')) { ev.preventDefault(); return; } setDragSub(s.id); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'sub:' + s.id); }}
          onDragOver=${ev => { if (dragSub) { ev.preventDefault(); setOverSub(s.id); } }}
          onDrop=${ev => { ev.preventDefault(); if (dragSub && dragSub !== s.id) { const from = t.subs.findIndex(x => x.id === dragSub), to = t.subs.findIndex(x => x.id === s.id), arr = [...t.subs], [m] = arr.splice(from, 1); arr.splice(to, 0, m); upd({ subs: arr }); } setDragSub(null); setOverSub(null); }}
          onDragEnd=${() => { setDragSub(null); setOverSub(null); }}>
          ${canEdit && t.subs.length > 1 && html`<span className="td2-grip" aria-hidden="true" title="Drag to reorder"><${Icon} n="grip" s=${16}/></span>`}
          <button className=${'td2-ck' + (s.done ? ' on' : '')} disabled=${!canEdit} onClick=${() => upd({ subs: t.subs.map(x => x.id === s.id ? { ...x, done: !x.done } : x) })} aria-label=${(s.done ? 'Mark not done: ' : 'Mark done: ') + s.t}><${Icon} n="check" s=${12}/></button>
          ${editSub === s.id
            ? html`<input className="td2-edit" autoFocus value=${editVal} aria-label="Rename subtask" maxLength="200" onChange=${ev => setEditVal(ev.target.value)} onBlur=${() => renameSub(s.id, editVal)} onKeyDown=${ev => { if (ev.key === 'Enter') renameSub(s.id, editVal); if (ev.key === 'Escape') { ev.stopPropagation(); setEditSub(null); } }}/>`
            : html`<span className=${'td2-st' + (s.done ? ' dn' : '') + (canEdit ? ' ed' : '')} title=${canEdit ? 'Click to rename' : undefined} onClick=${() => { if (canEdit) { setEditSub(s.id); setEditVal(s.t); } }}>${s.t}</span>`}
          ${canEdit && html`<button className="td2-x" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setSm(sm && sm.id === s.id ? null : { id: s.id, stage: 'root', x: Math.max(12, Math.min(r.right - 224, window.innerWidth - 236)), y: Math.min(r.bottom + 6, window.innerHeight - 300) }); setSmQ(''); }} aria-label=${'Options for ' + s.t} aria-haspopup="menu" title="Options"><${Icon} n="dots" s=${16}/></button>`}</div>`)}
        ${canEdit && (addingSub
          ? html`<div className="td2-sub td2-sub-in"><span className="td2-ck plus"><${Icon} n="plus" s=${12}/></span>
              <input autoFocus value=${newSub} placeholder="Type a subtask and press Enter" aria-label="New subtask" onChange=${ev => setNewSub(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addSub(); if (ev.key === 'Escape') { ev.stopPropagation(); setAddingSub(false); setNewSub(''); } }} onBlur=${() => { if (!newSub.trim()) setAddingSub(false); }}/>
              ${newSub.trim() && html`<button className="td2-go" onMouseDown=${ev => ev.preventDefault()} onClick=${addSub} aria-label="Add subtask" title="Add"><${Icon} n="check" s=${14}/></button>`}</div>`
          : html`<button className="td2-sub td2-sub-add" onClick=${() => setAddingSub(true)}><span className="td2-ck plus"><${Icon} n="plus" s=${12}/></span>Add a subtask</button>`)}
      </div>
    </section>

    <section className="td2-sec"><label className="td2-h" htmlFor="td-desc"><b>Description</b></label>
      <textarea id="td-desc" className="td2-desc" rows="3" value=${t.desc} disabled=${!canEdit} placeholder="Add notes, links or details" ref=${el => { if (el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 96) + 'px'; } }} onChange=${ev => upd({ desc: ev.target.value })}></textarea></section>

    ${!isNew && html`<section className="td2-sec td2-cm">
      <div className="td2-h td2-hk"><span className="td2-k"><${Icon} n="comment" s=${16}/>Comments</span>${t.comments.length > 0 && html`<span className="td2-n">${t.comments.length}</span>`}</div>
      ${t.comments.map(c => BY[c.by] && html`<div className="td2-c" key=${c.id}><${Av} e=${BY[c.by]} s=${32}/><div><div className="td2-cn"><b>${BY[c.by].name}</b><small>${ago(c.at)}</small></div><p>${c.text}</p></div></div>`)}
      ${t.comments.length === 0 && !canEdit && html`<p className="td2-empty">No comments yet.</p>`}
      ${canEdit && html`<div className="td2-comp"><input value=${comment} placeholder="Write a comment" aria-label="New comment" onChange=${ev => setComment(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addComment(); }}/>
        <button className="td2-send" disabled=${!comment.trim()} onClick=${addComment} aria-label="Post comment" title="Post"><${Icon} n="arrow" s=${16}/></button></div>`}
    </section>`}
    </div>
    <div className="td2-side">
    <div className="td2-props">
      <div className="td2-r"><span className="td2-k"><${Icon} n="people" s=${16}/>Assigned to</span>
        <div className="td2-v td2-chips">
          ${t.cols.map(c => html`<span className="td2-chip" key=${c}>${typeof c === 'number' && BY[c] ? html`<${Av} e=${BY[c]} s=${22}/>` : html`<i className="td2-dot"></i>`}${colName(c, BY, custom)}${mgr && t.cols.length > 1 && !t.done && html`<button onClick=${() => upd({ cols: t.cols.filter(x => x !== c), time: typeof c === 'number' ? stopFor(t.time, c) : t.time })} aria-label=${'Remove ' + colName(c, BY, custom)}><${Icon} n="x" s=${11}/></button>`}</span>`)}
          ${mgr && !t.done && html`<label className="td2-add"><${Icon} n="plus" s=${14}/>Add<select value="" onChange=${ev => { const v = ev.target.value; if (v) upd({ cols: [...t.cols, /^\d+$/.test(v) ? Number(v) : v] }); }} aria-label="Add a person or column"><option value="">Add…</option>${addablePins.map(p => html`<option key=${p[0]} value=${p[0]}>${p[1]}</option>`)}${addable.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}</select></label>`}
        </div></div>
      <div className="td2-r td2-r-ret"><span className="td2-k"><${Icon} n="star" s=${16}/>Retainer${mgr && (t.cols.includes('retainer')
          ? html`<span className="td2-kr"><span className="td2-lock" title="Set by the Retainer column"><${Icon} n="lock" s=${13}/>On</span></span>`
          : html`<span className="td2-kr"><${Switch} on=${!!t.retainer} set=${v => upd({ retainer: v })} label="Retainer task"/></span>`)}</span>
        <div className="td2-v">${mgr ? html`<div className="td2-ret"><small>${t.cols.includes('retainer') ? 'This task is in the Retainer column, so it is a retainer task. Move it to another column to turn this off.' : t.retainer ? 'Keeps its tint wherever it is moved.' : 'Turn on to keep a tint wherever it is moved.'}</small>${t.retainer && html`<div className="td2-sw" role="radiogroup" aria-label="Colour">${RET_COLORS.map(c => { const on = (t.rcolor || RET_COLORS[0]) === c; return html`<button key=${c} role="radio" aria-checked=${on} className=${'td2-sw-b' + (on ? ' on' : '')} style=${{ '--c': c }} aria-label=${'Colour ' + c} onClick=${() => upd({ rcolor: c === RET_COLORS[0] ? '' : c })}>${on && html`<${Icon} n="check" s=${13}/>`}</button>`; })}</div>`}</div>` : html`<span className=${'td2-rtag' + (t.retainer ? ' on' : '')}>${t.retainer ? 'Retainer task' : 'Not a retainer task'}</span>`}</div></div>
      <div className="td2-r"><span className="td2-k"><${Icon} n="flag" s=${16}/>Priority</span>
        <div className="td2-v"><div className="seg s3" role="group" aria-label="Priority">${Object.entries(PRIO).map(([k, v]) => html`<button key=${k} type="button" role="radio" aria-checked=${t.prio === k} disabled=${!canEdit} className=${t.prio === k ? 'on' : ''} onClick=${() => upd({ prio: k })}><i style=${{ background: v[1] }}></i>${v[0]}</button>`)}</div></div></div>
      <div className="td2-r"><span className="td2-k"><${Icon} n="tag" s=${16}/>Labels</span>
        <div className="td2-v td2-chips">${LABELS.map(l => html`<button key=${l} disabled=${!canEdit} className=${'chip' + (t.labels.includes(l) ? ' on' : '')} aria-pressed=${t.labels.includes(l)} onClick=${() => upd({ labels: t.labels.includes(l) ? t.labels.filter(x => x !== l) : [...t.labels, l] })}>${t.labels.includes(l) && html`<${Icon} n="check" s=${13}/>`}${l}</button>`)}</div></div>
    </div>

    </div>
    </div>
  <//>`;
}
