import { useState, useEffect, useRef } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { BY, activeEmps } from '../data.js';
import { PINNED, DONE, LABELS, LABEL_C, moveCard, copyCard, duplicateCard, deleteCard, completeCard, reopenCard, dropColumn, mkTask, colName } from '../tasks.js';

/* The three-dots menu: open, move, copy, duplicate to a column, or delete */
function CardMenu({ m, user, custom, setTasks, openTask, close }) {
  const [stage, setStage] = useState('root'), [q, setQ] = useState(''), [sure, setSure] = useState(false);
  const { t, col } = m, ql = q.toLowerCase();
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name)).filter(e => e.name.toLowerCase().includes(ql));
  const pins = [...PINNED.map(p => [p[0], p[1], p[2]]), ...custom.map(c => [c.id, c.name, '#8E8E93'])].filter(p => p[1].toLowerCase().includes(ql));
  const pick = to => {
    if (stage === 'move') setTasks(ts => moveCard(ts, t.id, col, to));
    else if (stage === 'copy') setTasks(ts => copyCard(ts, t.id, to));
    else setTasks(ts => duplicateCard(ts, t.id, to, user));
    close();
  };
  const blocked = to => (stage === 'move' && to === col) || (stage === 'copy' && (t.done || t.cols.includes(to)));
  const L = { move: 'Move to', copy: 'Copy to', dup: 'Duplicate to' };
  const style = { left: Math.max(12, Math.min(m.x, window.innerWidth - 228)), top: Math.max(12, Math.min(m.y, window.innerHeight - 330)) };
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
        ${people.map(e => html`<button key=${e.n} role="menuitem" disabled=${blocked(e.n)} onClick=${() => pick(e.n)}><span><b>${e.name}</b></span></button>`)}
        ${people.length === 0 && pins.length === 0 && html`<div className="cm-s">No match.</div>`}
      </div>`}
  </div>`;
}

/* Rename or remove a column you added */
function ColMenu({ m, custom, setCustom, setTasks, close, onShift, onHide, atStart, atEnd }) {
  const c = custom.find(x => x.id === m.id); const [name, setName] = useState(c ? c.name : ''), [sure, setSure] = useState(false);
  const style = { left: Math.max(12, Math.min(m.x, window.innerWidth - 228)), top: m.y };
  const save = () => { if (c && name.trim()) setCustom(cs => cs.map(x => x.id === c.id ? { ...x, name: name.trim() } : x)); close(); };
  return html`<div className="cm" style=${style} role="menu" onMouseDown=${ev => ev.stopPropagation()}>
    <button role="menuitem" disabled=${atStart} onClick=${() => { onShift(-1); close(); }}><${Icon} n="chevL" s=${15}/> Move left</button>
    <button role="menuitem" disabled=${atEnd} onClick=${() => { onShift(1); close(); }}><${Icon} n="next" s=${15}/> Move right</button>
    <button role="menuitem" onClick=${() => { onHide(); close(); }}><${Icon} n="eyeoff" s=${15}/> Hide from board</button>
    ${c && html`<hr/>
      <label className="cm-lb" htmlFor="col-name">Rename</label>
      <input id="col-name" className="inp" value=${name} onChange=${ev => setName(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') save(); }}/>
      <div className="cm-a"><button className="btn ghost sm" onClick=${close}>Cancel</button><button className="btn pri sm" onClick=${save}>Save</button></div>
      <hr/>
      ${sure ? html`<div className="cm-s">Remove column? Cards return to Priority.</div><div className="cm-a"><button className="btn ghost sm" onClick=${() => setSure(false)}>Keep</button><button className="btn sm danger" onClick=${() => { setTasks(ts => dropColumn(ts, c.id)); setCustom(cs => cs.filter(x => x.id !== c.id)); close(); }}>Remove</button></div>`
        : html`<button role="menuitem" className="cm-d" onClick=${() => setSure(true)}><${Icon} n="trash" s=${15}/> Remove column</button>`}`}
  </div>`;
}

/* Jump to a person's column */
function JumpMenu({ m, cols: all, jump, close }) {
  const [q, setQ] = useState(''); const ql = q.toLowerCase();
  const cols = all.filter(c => c[1].toLowerCase().includes(ql));
  const style = { left: Math.max(12, Math.min(m.x, window.innerWidth - 228)), top: m.y };
  return html`<div className="cm" style=${style} role="menu" onMouseDown=${ev => ev.stopPropagation()}>
    <input autoFocus className="inp" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Find" aria-label="Find a column or person"/>
    <div className="cm-l">${cols.map(c => html`<button key=${c[0]} role="menuitem" onClick=${() => { jump(c[0]); close(); }}>${c[2] && html`<span className="cm-pi" style=${{ '--c': c[2] }}></span>`}<span><b>${c[1]}</b></span></button>`)}
      ${cols.length === 0 && html`<div className="cm-s">No match</div>`}</div></div>`;
}

export function TaskBoard({ tasks, setTasks, user, role, tf, setTf, tq, openTask, focus, collapsed, setCollapsed, custom, setCustom, layout, setLayout }) {
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(null), [cmenu, setCmenu] = useState(null), [colDrag, setColDrag] = useState(null), [colOver, setColOver] = useState(null), [colsMenu, setColsMenu] = useState(false), [adding, setAdding] = useState(null), [text, setText] = useState('');
  const [pending, setPending] = useState({}), [lmenu, setLmenu] = useState(false), [newCol, setNewCol] = useState(null), [jmenu, setJmenu] = useState(null);
  const timers = useRef({}), scroller = useRef(null), lref = useRef(null), cref = useRef(null);
  const canMove = t => role === 'admin' || role === 'pm' || t.cols.includes(user.n) || t.by === user.n || (t.prev || []).includes(user.n);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = 0; }, []);
  useEffect(() => {
    if (!menu && !cmenu && !lmenu && !jmenu && !colsMenu) return;
    const f = ev => { if (lmenu && lref.current && lref.current.contains(ev.target)) return; if (colsMenu && cref.current && cref.current.contains(ev.target)) return; setMenu(null); setCmenu(null); setLmenu(false); setJmenu(null); setColsMenu(false); };
    const k = ev => { if (ev.key === 'Escape') { setMenu(null); setCmenu(null); setLmenu(false); setJmenu(null); setColsMenu(false); } };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k); window.addEventListener('resize', f);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); window.removeEventListener('resize', f); };
  }, [menu, cmenu, lmenu, jmenu, colsMenu]);

  const jump = n => { const el = scroller.current && scroller.current.querySelector('[data-col="' + n + '"]'); if (el) { setCollapsed(c => ({ ...c, [n]: false })); scroller.current.scrollTo({ left: Math.max(0, el.offsetLeft - pinW() - 12), behavior: 'smooth' }); } };
  useEffect(() => { if (focus != null) setTimeout(() => jump(focus), 120); }, [focus]);

  const term = tq.trim().toLowerCase();
  const match = t => !term || t.title.toLowerCase().includes(term);
  const cards = col => tasks.filter(t => match(t) && t.cols.includes(col));
  const isAdmin = role === 'admin' || role === 'pm';
  // Every column, its look, and the saved order. Retainer first, then Priority, then people A to Z, then added columns.
  const everyone = activeEmps().sort((a, b) => a.name.localeCompare(b.name));
  const defs = {};
  PINNED.forEach(p => { defs[p[0]] = { kind: p[0] === 'retainer' || p[0] === 'pending' ? 'pin' : 'norm', label: p[1], color: p[2] }; });
  everyone.forEach(e => { defs[e.n] = { kind: 'person', label: e.name }; });
  custom.forEach(c => { defs[c.id] = { kind: 'cust', label: c.name }; });
  const baseKeys = [...PINNED.map(p => p[0]), ...everyone.map(e => e.n), ...custom.map(c => c.id)];
  const savedOrder = (layout && layout.order) || [], hiddenKeys = (layout && layout.hidden) || [];
  const rank = k => { const i = savedOrder.indexOf(k); return i >= 0 ? i : k === 'pending' && savedOrder.includes('priority') ? savedOrder.indexOf('priority') + 0.5 : 1e6 + baseKeys.indexOf(k); };
  const ordered = [...baseKeys].sort((a, b) => rank(a) - rank(b));
  const isHidden = k => hiddenKeys.includes(k);
  const visible = ordered.filter(k => !isHidden(k) && !(tf.hideEmpty && defs[k].kind === 'person' && !cards(k).length));
  const hiddenCount = ordered.filter(isHidden).length;
  // The first columns stay in view while the board scrolls sideways, as long as they are Retainer and Priority
  const lead = []; for (const k of visible) { if (k === 'retainer' || k === 'priority' || k === 'pending') lead.push(k); else break; }
  const stickyLeft = k => { let l = 0; for (const x of lead) { if (x === k) return l; l += (collapsed[x] ? 52 : 280) + 12; } return null; };
  const pinW = () => lead.reduce((sum, k) => sum + (collapsed[k] ? 52 : 280) + 12, 0);
  const moveCol = (key, target, after) => {
    if (key === target) return;
    setLayout(l => { const order = ordered.filter(k => k !== key), i = order.indexOf(target); order.splice(i < 0 ? order.length : i + (after ? 1 : 0), 0, key); return { ...l, order }; });
  };
  const shiftCol = (key, dir) => { const t = visible[visible.indexOf(key) + dir]; if (t !== undefined) moveCol(key, t, dir > 0); };
  const hideCol = key => setLayout(l => ({ ...l, hidden: [...new Set([...(l.hidden || []), key])] }));
  const showCol = key => setLayout(l => ({ ...l, hidden: (l.hidden || []).filter(k => k !== key) }));
  const openCount = tasks.filter(t => !t.done).length;
  const toggle = k => setCollapsed(c => ({ ...c, [k]: !c[k] }));
  const toggleLabel = l => setTf({ ...tf, labels: tf.labels.includes(l) ? tf.labels.filter(x => x !== l) : [...tf.labels, l] });

  /* Completing: the tick shows straight away, the card moves to Completed Tasks after 2 seconds. */
  const complete = t => {
    if (t.done) { setTasks(ts => reopenCard(ts, t.id, user.n)); return; }
    if (pending[t.id]) { clearTimeout(timers.current[t.id]); setPending(p => { const n = { ...p }; delete n[t.id]; return n; }); return; }
    setPending(p => ({ ...p, [t.id]: true }));
    timers.current[t.id] = setTimeout(() => { setTasks(ts => completeCard(ts, t.id)); setPending(p => { const n = { ...p }; delete n[t.id]; return n; }); }, 2000);
  };

  const onOver = (ev, col) => {
    if (colDrag != null) { if (col === DONE || col === colDrag) { setColOver(null); return; } ev.preventDefault(); const r = ev.currentTarget.getBoundingClientRect(); setColOver({ key: col, after: ev.clientX > r.left + r.width / 2 }); return; }
    if (!drag) return; ev.preventDefault(); const cs = [...ev.currentTarget.querySelectorAll('.kt:not(.dragging)')]; const next = cs.find(c => ev.clientY < c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2); setOver({ col, before: next ? next.dataset.id : null });
  };
  const onDrop = (ev, col) => {
    ev.preventDefault();
    if (colDrag != null) { if (colOver && colOver.key === col) moveCol(colDrag, col, colOver.after); setColDrag(null); setColOver(null); return; }
    if (drag) setTasks(ts => moveCard(ts, drag.id, drag.col, col, over && over.col === col ? over.before : null)); setDrag(null); setOver(null); };
  // Scroll sideways on its own while a card is dragged near either edge
  const edge = ev => { const s = scroller.current; if ((!drag && colDrag == null) || !s) return; const r = s.getBoundingClientRect(); if (ev.clientX < r.left + 90) s.scrollLeft -= 26; else if (ev.clientX > r.right - 90) s.scrollLeft += 26; };
  const add = col => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setAdding(null); return; }
    setTasks(ts => [...ts, ...lines.map(title => mkTask({ title, cols: [col] }, user))]);
    setText(''); setAdding(null);
  };
  const addColumn = () => { const n = (newCol || '').trim(); if (n) setCustom(cs => [...cs, { id: 'c' + Date.now().toString(36), name: n }]); setNewCol(null); };

  // A plain function, not a component, so typing or dragging never remounts the columns.
  const renderCol = (key, kind, label, opts = {}) => {
    const list = cards(key), shut = !!collapsed[key];
    const cls = 'kc2 ' + kind + (opts.left != null ? ' stk' : '') + (shut ? ' shut' : '') + (over && over.col === key ? ' over' : '') + (colDrag === key ? ' col-drag' : '') + (colOver && colOver.key === key ? (colOver.after ? ' ovr-r' : ' ovr-l') : '');
    const style = { ...(kind === 'pin' && opts.color ? { '--c': opts.color } : null), ...(opts.left != null ? { left: opts.left } : null) };
    const movable = isAdmin && kind !== 'doneCol';
    if (shut) return html`<section key=${key} data-col=${key} className=${cls} style=${style}><button className="kc2-s" onClick=${() => toggle(key)} aria-label=${'Show ' + label}><${Icon} n="next" s=${14}/><span className="kc2-v">${label}</span><span className="kc-n">${list.length}</span></button></section>`;
    return html`<section key=${key} data-col=${key} className=${cls} style=${style} onDragOver=${ev => onOver(ev, key)} onDrop=${ev => onDrop(ev, key)} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o && o.col === key ? null : o); }}>
      <header className=${'kc2-h' + (movable ? ' kc2-hd' : '')} draggable=${movable} title=${movable ? 'Drag to move this column' : undefined} onDragStart=${movable ? (ev => { if (ev.target !== ev.currentTarget) return; setColDrag(key); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'col:' + key); }) : undefined} onDragEnd=${() => { setColDrag(null); setColOver(null); }}>
        <b className="kc2-t">${label}</b><span className="kc-n">${list.length}</span><span style=${{ flex: 1 }}></span>
        ${movable && html`<button className="ib" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setCmenu(cmenu && cmenu.id === key ? null : { id: key, x: r.right - 216, y: r.bottom + 6 }); }} aria-label=${'Options for ' + label}><${Icon} n="dots" s=${15}/></button>`}
        <button className="ib" onClick=${() => toggle(key)} aria-label=${'Hide ' + label} title="Hide this column"><${Icon} n="chevL" s=${14}/></button>
      </header>
      <div className="kc2-b">
        ${list.map(t => { const isDone = t.done || pending[t.id], can = canMove(t), ls = t.labels.filter(l => tf.labels.includes(l));
          return html`<article key=${t.id + key} data-id=${t.id} className=${'kt' + (drag && drag.id === t.id && drag.col === key ? ' dragging' : '') + (over && over.col === key && over.before === t.id ? ' drop-before' : '') + (isDone ? ' isdone' : '')}
            draggable=${can} onDragStart=${ev => { setDrag({ id: t.id, col: key }); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
            <div className="kt-top">
              <button className="kt-open" onClick=${() => openTask(t.id)} aria-label=${'Open ' + t.title}>
                ${ls.length > 0 && html`<span className="kt-l">${ls.map(l => html`<span key=${l} style=${{ '--c': LABEL_C[l] }}>${l}</span>`)}</span>`}
                <b className="kt-t">${t.title}</b>
                ${key === DONE && t.prev && html`<span className="kt-p">From ${t.prev.map(c => colName(c, BY, custom)).filter(Boolean).join(', ')}</span>`}
              </button>
              ${can && html`<button className="kt-dots" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setMenu(menu && menu.t.id === t.id && menu.col === key ? null : { t, col: key, x: r.right - 216, y: r.bottom + 6 }); }} aria-label=${'Card actions for ' + t.title} aria-haspopup="menu"><${Icon} n="dots" s=${18}/></button>`}
            </div>
            <div className="kt-f">
              ${can ? html`<button className=${'kt-c' + (isDone ? ' on' : '')} onClick=${() => complete(t)} title=${t.done ? 'Reopen' : isDone ? 'Undo' : 'Mark complete'} aria-label=${t.done ? 'Reopen ' + t.title : isDone ? 'Undo complete' : 'Complete ' + t.title}><${Icon} n="check" s=${13}/></button>` : html`<span></span>`}
              <span className="kt-s">${t.subs.length > 0 && html`<span><${Icon} n="check" s=${12}/>${t.subs.filter(s => s.done).length}/${t.subs.length}</span>`}${t.comments.length > 0 && html`<span><${Icon} n="comment" s=${12}/>${t.comments.length}</span>`}${t.cols.length > 1 && !t.done && html`<span className="kt-sh" title="Also in other columns">Shared</span>`}</span>
            </div>
          </article>`; })}
        ${over && over.col === key && over.before === null && list.length > 0 && html`<div className="kc-drop"></div>`}
        ${kind !== 'doneCol' && (adding === key
          ? html`<div className="kc-compose"><textarea autoFocus rows="2" value=${text} placeholder="What needs doing? Paste lines to add several." aria-label=${'New card in ' + label} onChange=${ev => setText(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); add(key); } if (ev.key === 'Escape') { setAdding(null); setText(''); } }} onBlur=${() => { if (!text.trim()) setAdding(null); }}></textarea>
              <div className="kc-compose-a"><small>Enter to add</small><span style=${{ flex: 1 }}></span><button className="ib" onMouseDown=${ev => ev.preventDefault()} onClick=${() => { setAdding(null); setText(''); }} aria-label="Cancel"><${Icon} n="x" s=${13}/></button><button className="btn pri sm" onMouseDown=${ev => ev.preventDefault()} onClick=${() => add(key)}>Add</button></div></div>`
          : list.length === 0
            ? html`<button className="kc-e" onClick=${() => { setAdding(key); setText(''); }}><${Icon} n="plus" s=${15}/>${term ? 'No match' : 'New task'}</button>`
            : html`<button className="kc-new" onClick=${() => { setAdding(key); setText(''); }}><${Icon} n="plus" s=${15}/>New task</button>`)}
      </div></section>`;
  };

  const lcount = tf.labels.length;
  return html`<div>
    <div className="pg-h kbh"><div><h1><${HI} n="board" tone="purple"/>Board</h1><p>${openCount} open</p></div>
      <button className="btn pri new-m" onClick=${() => openTask('new', { col: 'priority' })}><${Icon} n="plus" s=${16}/> New</button>
      <div className="kbh-r">
        <button className="ibx" title="Jump to a person" aria-label="Jump to a person" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setJmenu(jmenu ? null : { x: r.right - 260, y: r.bottom + 8 }); }}><${Icon} n="jump" s=${18}/></button>
        <button className=${'ibx' + (tf.hideEmpty ? ' on' : '')} title=${tf.hideEmpty ? 'Show empty columns' : 'Hide empty columns'} aria-label="Hide empty columns" aria-pressed=${!!tf.hideEmpty} onClick=${() => setTf({ ...tf, hideEmpty: !tf.hideEmpty })}><${Icon} n=${tf.hideEmpty ? 'eyeoff' : 'eye'} s=${18}/></button>
        <div className="lm-w" ref=${lref}>
          <button className=${'ibx' + (lcount ? ' on' : '')} title="Show labels on cards" aria-label="Show labels on cards" aria-haspopup="true" aria-expanded=${lmenu} onClick=${() => setLmenu(o => !o)}><${Icon} n="tag" s=${18}/>${lcount > 0 && html`<span className="ibx-n">${lcount}</span>`}</button>
          ${lmenu && html`<div className="lm" role="dialog" aria-label="Labels">
            <div className="lm-h"><b>Show labels</b><button className="link" onClick=${() => setTf({ ...tf, labels: [] })}>Clear</button></div>
            ${LABELS.map(l => html`<label className="lm-r" key=${l} htmlFor=${'lb-' + l}><input id=${'lb-' + l} type="checkbox" checked=${tf.labels.includes(l)} onChange=${() => toggleLabel(l)}/><i style=${{ '--c': LABEL_C[l] }}></i>${l}</label>`)}
          </div>`}
        </div>
        ${isAdmin && html`<div className="lm-w" ref=${cref}>
          <button className=${'ibx' + (hiddenCount ? ' on' : '')} title="Choose which columns show" aria-label="Choose which columns show" aria-haspopup="true" aria-expanded=${colsMenu} onClick=${() => setColsMenu(o => !o)}><${Icon} n="sidebar" s=${18}/>${hiddenCount > 0 && html`<span className="ibx-n">${hiddenCount}</span>`}</button>
          ${colsMenu && html`<div className="lm" role="dialog" aria-label="Columns">
            <div className="lm-h"><b>Columns</b>${hiddenCount > 0 && html`<button className="link" onClick=${() => setLayout(l => ({ ...l, hidden: [] }))}>Show all</button>`}</div>
            <div className="lm-l">${ordered.map(k => html`<label className="lm-r" key=${k} htmlFor=${'col-' + k}><input id=${'col-' + k} type="checkbox" checked=${!isHidden(k)} onChange=${() => isHidden(k) ? showCol(k) : hideCol(k)}/>${defs[k].label}</label>`)}</div>
            <p className="lm-n">Tick a column to show it. Drag a column header to change the order.</p></div>`}
        </div>`}
        <button className="btn pri new-d" onClick=${() => openTask('new', { col: 'priority' })}><${Icon} n="plus" s=${16}/> New</button>
      </div></div>
    <div className="kb2" ref=${scroller} onDragOver=${edge}>
      ${visible.map(k => renderCol(k, defs[k].kind, defs[k].label, { color: defs[k].color, left: stickyLeft(k) }))}
      ${renderCol(DONE, 'doneCol', 'Completed Tasks')}
      <div className="kc2 addcol">${newCol == null ? html`<button className="addcol-b" title="Add a column" aria-label="Add a column" onClick=${() => setNewCol('')}><${Icon} n="plus" s=${18}/></button>`
        : html`<div className="addcol-f"><input autoFocus className="inp" value=${newCol} placeholder="Name" onChange=${ev => setNewCol(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addColumn(); if (ev.key === 'Escape') setNewCol(null); }} aria-label="New column name"/><div className="cm-a"><button className="btn ghost sm" onClick=${() => setNewCol(null)}>Cancel</button><button className="btn pri sm" onClick=${addColumn}>Add</button></div></div>`}</div>
    </div>
    ${jmenu && html`<${JumpMenu} m=${jmenu} cols=${[...visible.map(k => [k, defs[k].label, defs[k].kind === 'pin' ? defs[k].color : null]), [DONE, 'Completed Tasks', '#30D158']]} jump=${jump} close=${() => setJmenu(null)}/>`}
    ${menu && html`<${CardMenu} m=${menu} user=${user} custom=${custom} setTasks=${setTasks} openTask=${openTask} close=${() => setMenu(null)}/>`}
    ${cmenu && html`<${ColMenu} m=${cmenu} custom=${custom} setCustom=${setCustom} setTasks=${setTasks} close=${() => setCmenu(null)} onShift=${d => shiftCol(cmenu.id, d)} onHide=${() => hideCol(cmenu.id)} atStart=${visible.indexOf(cmenu.id) <= 0} atEnd=${visible.indexOf(cmenu.id) >= visible.length - 1}/>`}
  </div>`;
}
