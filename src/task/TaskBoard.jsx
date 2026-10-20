import { useState, useEffect, useRef } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { BY, activeEmps, DEPTS } from '../data.js';
import { PINNED, DONE, LABEL_C, moveCard, copyCard, duplicateCard, deleteCard, completeCard, reopenCard, mkTask, colName } from '../tasks.js';

/* The three-dots menu: open, move, copy, duplicate to a column, or delete */
function CardMenu({ m, user, setTasks, openTask, close }) {
  const [stage, setStage] = useState('root'), [q, setQ] = useState(''), [sure, setSure] = useState(false);
  const { t, col } = m;
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name)).filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
  const pins = PINNED.filter(p => p[1].toLowerCase().includes(q.toLowerCase()));
  const pick = to => {
    if (stage === 'move') setTasks(ts => moveCard(ts, t.id, col, to));
    else if (stage === 'copy') setTasks(ts => copyCard(ts, t.id, to));
    else setTasks(ts => duplicateCard(ts, t.id, to, user));
    close();
  };
  const blocked = to => (stage === 'move' && to === col) || (stage === 'copy' && (t.done || t.cols.includes(to)));
  const L = { move: 'Move to', copy: 'Copy to', dup: 'Duplicate to' };
  const style = { left: Math.max(12, Math.min(m.x, window.innerWidth - 284)), top: Math.max(12, Math.min(m.y, window.innerHeight - 380)) };
  return html`<div className="cm" style=${style} role="menu" onMouseDown=${ev => ev.stopPropagation()}>
    ${stage === 'root' ? html`
      <button role="menuitem" onClick=${() => { close(); openTask(t.id); }}><${Icon} n="edit" s=${15}/> Open details</button>
      <button role="menuitem" onClick=${() => setStage('move')}><${Icon} n="next" s=${15}/> Move to…</button>
      <button role="menuitem" onClick=${() => setStage('copy')}><${Icon} n="copy" s=${15}/> Copy to…</button>
      <button role="menuitem" onClick=${() => setStage('dup')}><${Icon} n="plus" s=${15}/> Duplicate to…</button>
      <hr/>
      ${sure ? html`<div className="cm-s">Delete this card?</div><div className="cm-a"><button className="btn ghost sm" onClick=${() => setSure(false)}>Cancel</button><button className="btn sm danger" onClick=${() => { setTasks(ts => deleteCard(ts, t.id, col)); close(); }}>Delete</button></div>`
        : html`<button role="menuitem" className="cm-d" onClick=${() => setSure(true)}><${Icon} n="trash" s=${15}/> Delete this card</button>`}`
    : html`
      <div className="cm-h"><button className="ib" onClick=${() => { setStage('root'); setQ(''); }} aria-label="Back"><${Icon} n="chevL" s=${14}/></button><b>${L[stage]}</b></div>
      <input autoFocus className="inp" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Find a column or person" aria-label="Find a column or person"/>
      <div className="cm-l">
        ${pins.map(p => html`<button key=${p[0]} role="menuitem" disabled=${blocked(p[0])} onClick=${() => pick(p[0])}><span className="cm-pi" style=${{ '--c': p[2] }}></span><span><b>${p[1]}</b></span></button>`)}
        ${people.map(e => html`<button key=${e.n} role="menuitem" disabled=${blocked(e.n)} onClick=${() => pick(e.n)}><${Av} e=${e} s=${28}/><span><b>${e.name}</b></span></button>`)}
        ${people.length === 0 && pins.length === 0 && html`<div className="cm-s">No match.</div>`}
      </div>`}
  </div>`;
}

export function TaskBoard({ tasks, setTasks, user, role, tf, setTf, tq, openTask, focus, collapsed, setCollapsed }) {
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(null), [adding, setAdding] = useState(null), [text, setText] = useState('');
  const [edit, setEdit] = useState(null), [pending, setPending] = useState({});
  const timers = useRef({}), scroller = useRef(null);
  const canMove = t => role === 'admin' || t.cols.includes(user.n) || t.by === user.n || (t.prev || []).includes(user.n);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => { if (!menu) return; const f = () => setMenu(null); const k = ev => { if (ev.key === 'Escape') setMenu(null); }; document.addEventListener('mousedown', f); document.addEventListener('keydown', k); window.addEventListener('resize', f); return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); window.removeEventListener('resize', f); }; }, [menu]);
  const jump = n => { const el = scroller.current && scroller.current.querySelector('[data-col="' + n + '"]'); if (el) { setCollapsed(c => ({ ...c, [n]: false })); scroller.current.scrollTo({ left: Math.max(0, el.offsetLeft - 640), behavior: 'smooth' }); } };
  useEffect(() => { if (focus != null) setTimeout(() => jump(focus), 120); }, [focus]);

  const term = tq.trim().toLowerCase();
  const match = t => !term || (t.title + ' ' + t.client + ' ' + t.labels.join(' ')).toLowerCase().includes(term);
  const people = activeEmps().filter(e => tf.dept === 'All' || e.dept === tf.dept).sort((a, b) => (b.n === user.n) - (a.n === user.n) || a.name.localeCompare(b.name));
  const cards = col => tasks.filter(t => match(t) && t.cols.includes(col));
  const shown = tf.hideEmpty ? people.filter(e => cards(e.n).length) : people;
  const openCount = tasks.filter(t => !t.done).length;
  const toggle = k => setCollapsed(c => ({ ...c, [k]: !c[k] }));

  /* Completing: the tick shows straight away, the card moves to Completed Tasks after 2 seconds. */
  const complete = t => {
    if (t.done) { setTasks(ts => reopenCard(ts, t.id, user.n)); return; }
    if (pending[t.id]) { clearTimeout(timers.current[t.id]); setPending(p => { const n = { ...p }; delete n[t.id]; return n; }); return; }
    setPending(p => ({ ...p, [t.id]: true }));
    timers.current[t.id] = setTimeout(() => { setTasks(ts => completeCard(ts, t.id)); setPending(p => { const n = { ...p }; delete n[t.id]; return n; }); }, 2000);
  };
  const saveEdit = () => { if (!edit) return; const v = edit.val.trim(); if (v) setTasks(ts => ts.map(x => x.id === edit.id ? { ...x, title: v } : x)); setEdit(null); };

  const onOver = (ev, col) => { if (!drag) return; ev.preventDefault(); const cs = [...ev.currentTarget.querySelectorAll('.kt:not(.dragging)')]; const next = cs.find(c => ev.clientY < c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2); setOver({ col, before: next ? next.dataset.id : null }); };
  const onDrop = (ev, col) => { ev.preventDefault(); if (drag) setTasks(ts => moveCard(ts, drag.id, drag.col, col, over && over.col === col ? over.before : null)); setDrag(null); setOver(null); };
  const add = col => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setAdding(null); return; }
    setTasks(ts => [...ts, ...lines.map(title => mkTask({ title, cols: [col] }, user))]);
    setText(''); setAdding(null);
  };

  // A plain function, not a component, so typing or dragging never remounts the columns.
  const renderCol = (key, kind, label, opts = {}) => {
    const list = cards(key), shut = !!collapsed[key];
    const cls = 'kc2 ' + kind + (shut ? ' shut' : '') + (over && over.col === key ? ' over' : '');
    const style = opts.left != null ? { left: opts.left, '--c': opts.color } : opts.color ? { '--c': opts.color } : null;
    if (shut) return html`<section key=${key} data-col=${key} className=${cls} style=${style}><button className="kc2-s" onClick=${() => toggle(key)} aria-label=${'Show ' + label}><${Icon} n="next" s=${14}/><span className="kc2-v">${label}</span><span className="kc-n">${list.length}</span></button></section>`;
    return html`<section key=${key} data-col=${key} className=${cls} style=${style} onDragOver=${ev => onOver(ev, key)} onDrop=${ev => onDrop(ev, key)} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o && o.col === key ? null : o); }}>
      <header className="kc2-h">
        ${opts.e && html`<${Av} e=${opts.e} s=${32}/>`}
        <b className="kc2-t">${label}</b><span className="kc-n">${list.length}</span><span style=${{ flex: 1 }}></span>
        ${kind !== 'doneCol' && html`<button className="ib" onClick=${() => { setAdding(adding === key ? null : key); setText(''); }} aria-label=${'Add a card to ' + label}><${Icon} n="plus" s=${15}/></button>`}
        <button className="ib" onClick=${() => toggle(key)} aria-label=${'Hide ' + label} title="Hide this column"><${Icon} n="chevL" s=${15}/></button>
      </header>
      <div className="kc2-b">
        ${adding === key && html`<div className="kc-add"><textarea autoFocus rows="2" className="inp" value=${text} placeholder="Card title. Paste several lines to add several cards." onChange=${ev => setText(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); add(key); } if (ev.key === 'Escape') setAdding(null); }} onBlur=${() => { if (!text.trim()) setAdding(null); }} aria-label="New card title"></textarea><small>Enter to add</small></div>`}
        ${list.map(t => { const isDone = t.done || pending[t.id], editing = edit && edit.id === t.id && edit.col === key, can = canMove(t);
          return html`<article key=${t.id + key} data-id=${t.id} className=${'kt' + (drag && drag.id === t.id && drag.col === key ? ' dragging' : '') + (over && over.col === key && over.before === t.id ? ' drop-before' : '') + (isDone ? ' isdone' : '')}
            draggable=${can && !editing} onDragStart=${ev => { setDrag({ id: t.id, col: key }); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
            <div className="kt-top">
              <div className="kt-body" onClick=${() => { if (editing) return; if (can) setEdit({ id: t.id, col: key, val: t.title }); else openTask(t.id); }}>
                ${t.labels.length > 0 && html`<span className="kt-l">${t.labels.slice(0, 3).map(l => html`<span key=${l} style=${{ '--c': LABEL_C[l] }}>${l}</span>`)}</span>`}
                ${editing ? html`<textarea autoFocus className="kt-edit" rows="2" value=${edit.val} onFocus=${ev => ev.target.select()} onChange=${ev => setEdit({ ...edit, val: ev.target.value })} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); saveEdit(); } if (ev.key === 'Escape') setEdit(null); }} onBlur=${saveEdit} aria-label="Edit card title"></textarea>`
                  : html`<b className="kt-t" title=${can ? 'Click to rename' : ''}>${t.title}</b>`}
                ${t.client && html`<span className="kt-p">${t.client}</span>`}
                ${key === DONE && t.prev && html`<span className="kt-p">From ${t.prev.map(c => colName(c, BY)).filter(Boolean).join(', ')}</span>`}
              </div>
              ${can && html`<button className="kt-dots" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setMenu(menu && menu.t.id === t.id && menu.col === key ? null : { t, col: key, x: r.right - 250, y: r.bottom + 6 }); }} aria-label=${'Card actions for ' + t.title} aria-haspopup="menu"><${Icon} n="dots" s=${18}/></button>`}
            </div>
            <div className="kt-f">
              ${can ? html`<button className=${'kt-c' + (isDone ? ' on' : '')} onClick=${() => complete(t)} aria-label=${t.done ? 'Reopen ' + t.title : isDone ? 'Undo complete' : 'Complete ' + t.title}><${Icon} n="check" s=${13}/>${t.done ? 'Reopen' : pending[t.id] ? 'Completed' : 'Complete'}</button>` : html`<span></span>`}
              <span className="kt-s">${t.subs.length > 0 && html`<span><${Icon} n="check" s=${12}/>${t.subs.filter(s => s.done).length}/${t.subs.length}</span>`}${t.comments.length > 0 && html`<span><${Icon} n="comment" s=${12}/>${t.comments.length}</span>`}${t.cols.length > 1 && !t.done && html`<span className="kt-sh" title="Also in other columns">Shared</span>`}</span>
            </div>
          </article>`; })}
        ${list.length === 0 && adding !== key && html`<div className="kc-e">${term ? 'No matching cards' : kind === 'doneCol' ? 'Finished cards land here' : kind === 'pin' ? 'Nothing here yet' : 'Drop a card here'}</div>`}
        ${over && over.col === key && over.before === null && list.length > 0 && html`<div className="kc-drop"></div>`}
      </div></section>`;
  };

  const pinLeft = i => PINNED.slice(0, i).reduce((s, p) => s + (collapsed[p[0]] ? 56 : 304) + 14, 0);
  return html`<div>
    <div className="pg-h"><div><h1>Board</h1><p>${openCount} open cards. Click a card to rename it, drag it to another column, or use the three dots.</p></div>
      <button className="btn pri" onClick=${() => openTask('new', { col: role === 'admin' ? 'priority' : user.n })}><${Icon} n="plus" s=${16}/> New card</button></div>
    <div className="bt-bar">
      <span style=${{ flex: 1 }}></span>
      <select id="kb-dept" className="sel" value=${tf.dept} onChange=${ev => setTf({ ...tf, dept: ev.target.value })} aria-label="Department"><option value="All">All departments</option>${DEPTS.map(d => html`<option key=${d} value=${d}>${d}</option>`)}</select>
      <select id="kb-jump" className="sel" value="" onChange=${ev => { if (ev.target.value) jump(ev.target.value); }} aria-label="Jump to a person"><option value="">Jump to…</option>${shown.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}<option value=${DONE}>Completed Tasks</option></select>
      <button className=${'chip' + (tf.hideEmpty ? ' on' : '')} onClick=${() => setTf({ ...tf, hideEmpty: !tf.hideEmpty })} aria-pressed=${!!tf.hideEmpty}>Hide empty columns</button>
    </div>
    <div className="kb2" ref=${scroller}>
      ${PINNED.map((p, i) => renderCol(p[0], 'pin', p[1], { color: p[2], left: pinLeft(i) }))}
      ${shown.map(e => renderCol(e.n, 'person', e.n === user.n ? e.name + ' (you)' : e.name, { e }))}
      ${renderCol(DONE, 'doneCol', 'Completed Tasks')}
    </div>
    ${menu && html`<${CardMenu} m=${menu} user=${user} setTasks=${setTasks} openTask=${openTask} close=${() => setMenu(null)}/>`}
  </div>`;
}
