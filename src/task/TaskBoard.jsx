import { useState, useEffect, useRef } from 'react';
import { html, Icon } from '../ui.jsx';
import { BY, activeEmps, DEPTS } from '../data.js';
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
        ${people.map(e => html`<button key=${e.n} role="menuitem" disabled=${blocked(e.n)} onClick=${() => pick(e.n)}><span><b>${e.name}</b></span></button>`)}
        ${people.length === 0 && pins.length === 0 && html`<div className="cm-s">No match.</div>`}
      </div>`}
  </div>`;
}

/* Rename or remove a column you added */
function ColMenu({ m, custom, setCustom, setTasks, close }) {
  const c = custom.find(x => x.id === m.id); const [name, setName] = useState(c ? c.name : ''), [sure, setSure] = useState(false);
  if (!c) return null;
  const style = { left: Math.max(12, Math.min(m.x, window.innerWidth - 284)), top: m.y };
  const save = () => { if (name.trim()) setCustom(cs => cs.map(x => x.id === c.id ? { ...x, name: name.trim() } : x)); close(); };
  return html`<div className="cm" style=${style} role="menu" onMouseDown=${ev => ev.stopPropagation()}>
    <label className="cm-lb" htmlFor="col-name">Column name</label>
    <input id="col-name" autoFocus className="inp" value=${name} onChange=${ev => setName(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') save(); }}/>
    <div className="cm-a"><button className="btn ghost sm" onClick=${close}>Cancel</button><button className="btn pri sm" onClick=${save}>Save</button></div>
    <hr/>
    ${sure ? html`<div className="cm-s">Remove this column? Its cards go back to Priority Tasks.</div><div className="cm-a"><button className="btn ghost sm" onClick=${() => setSure(false)}>Keep</button><button className="btn sm danger" onClick=${() => { setTasks(ts => dropColumn(ts, c.id)); setCustom(cs => cs.filter(x => x.id !== c.id)); close(); }}>Remove</button></div>`
      : html`<button role="menuitem" className="cm-d" onClick=${() => setSure(true)}><${Icon} n="trash" s=${15}/> Remove column</button>`}
  </div>`;
}

export function TaskBoard({ tasks, setTasks, user, role, tf, setTf, tq, openTask, focus, collapsed, setCollapsed, custom, setCustom }) {
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(null), [cmenu, setCmenu] = useState(null), [adding, setAdding] = useState(null), [text, setText] = useState('');
  const [pending, setPending] = useState({}), [lmenu, setLmenu] = useState(false), [newCol, setNewCol] = useState(null);
  const timers = useRef({}), scroller = useRef(null), lref = useRef(null);
  const canMove = t => role === 'admin' || t.cols.includes(user.n) || t.by === user.n || (t.prev || []).includes(user.n);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = 0; }, []);
  useEffect(() => {
    if (!menu && !cmenu && !lmenu) return;
    const f = ev => { if (lmenu && lref.current && lref.current.contains(ev.target)) return; setMenu(null); setCmenu(null); setLmenu(false); };
    const k = ev => { if (ev.key === 'Escape') { setMenu(null); setCmenu(null); setLmenu(false); } };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k); window.addEventListener('resize', f);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); window.removeEventListener('resize', f); };
  }, [menu, cmenu, lmenu]);

  const pinW = () => PINNED.reduce((s, p) => s + (collapsed[p[0]] ? 52 : 260) + 12, 0);
  const jump = n => { const el = scroller.current && scroller.current.querySelector('[data-col="' + n + '"]'); if (el) { setCollapsed(c => ({ ...c, [n]: false })); scroller.current.scrollTo({ left: Math.max(0, el.offsetLeft - pinW() - 12), behavior: 'smooth' }); } };
  useEffect(() => { if (focus != null) setTimeout(() => jump(focus), 120); }, [focus]);

  const term = tq.trim().toLowerCase();
  const match = t => (!term || t.title.toLowerCase().includes(term)) && (!tf.lfilter || !tf.labels.length || t.labels.some(l => tf.labels.includes(l)));
  const people = activeEmps().filter(e => tf.dept === 'All' || e.dept === tf.dept).sort((a, b) => (b.n === user.n) - (a.n === user.n) || a.name.localeCompare(b.name));
  const cards = col => tasks.filter(t => match(t) && t.cols.includes(col));
  const shown = tf.hideEmpty ? people.filter(e => cards(e.n).length) : people;
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

  const onOver = (ev, col) => { if (!drag) return; ev.preventDefault(); const cs = [...ev.currentTarget.querySelectorAll('.kt:not(.dragging)')]; const next = cs.find(c => ev.clientY < c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2); setOver({ col, before: next ? next.dataset.id : null }); };
  const onDrop = (ev, col) => { ev.preventDefault(); if (drag) setTasks(ts => moveCard(ts, drag.id, drag.col, col, over && over.col === col ? over.before : null)); setDrag(null); setOver(null); };
  // Scroll sideways on its own while a card is dragged near either edge
  const edge = ev => { const s = scroller.current; if (!drag || !s) return; const r = s.getBoundingClientRect(); if (ev.clientX < r.left + 90) s.scrollLeft -= 26; else if (ev.clientX > r.right - 90) s.scrollLeft += 26; };
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
    const cls = 'kc2 ' + kind + (shut ? ' shut' : '') + (over && over.col === key ? ' over' : '');
    const style = { ...(opts.color ? { '--c': opts.color } : null), ...(opts.left != null ? { left: opts.left } : null) };
    if (shut) return html`<section key=${key} data-col=${key} className=${cls} style=${style}><button className="kc2-s" onClick=${() => toggle(key)} aria-label=${'Show ' + label}><${Icon} n="next" s=${14}/><span className="kc2-v">${label}</span><span className="kc-n">${list.length}</span></button></section>`;
    return html`<section key=${key} data-col=${key} className=${cls} style=${style} onDragOver=${ev => onOver(ev, key)} onDrop=${ev => onDrop(ev, key)} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o && o.col === key ? null : o); }}>
      <header className="kc2-h">
        <b className="kc2-t">${label}</b><span className="kc-n">${list.length}</span><span style=${{ flex: 1 }}></span>
        ${kind !== 'doneCol' && html`<button className="ib" onClick=${() => { setAdding(adding === key ? null : key); setText(''); }} aria-label=${'Add a card to ' + label}><${Icon} n="plus" s=${14}/></button>`}
        ${kind === 'cust' && html`<button className="ib" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setCmenu(cmenu && cmenu.id === key ? null : { id: key, x: r.right - 250, y: r.bottom + 6 }); }} aria-label=${'Options for ' + label}><${Icon} n="dots" s=${15}/></button>`}
        <button className="ib" onClick=${() => toggle(key)} aria-label=${'Hide ' + label} title="Hide this column"><${Icon} n="chevL" s=${14}/></button>
      </header>
      <div className="kc2-b">
        ${adding === key && html`<div className="kc-add"><textarea autoFocus rows="2" className="inp" value=${text} placeholder="Card title. Paste several lines to add several cards." onChange=${ev => setText(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); add(key); } if (ev.key === 'Escape') setAdding(null); }} onBlur=${() => { if (!text.trim()) setAdding(null); }} aria-label="New card title"></textarea><small>Enter to add</small></div>`}
        ${list.map(t => { const isDone = t.done || pending[t.id], can = canMove(t), ls = t.labels.filter(l => tf.labels.includes(l));
          return html`<article key=${t.id + key} data-id=${t.id} className=${'kt' + (drag && drag.id === t.id && drag.col === key ? ' dragging' : '') + (over && over.col === key && over.before === t.id ? ' drop-before' : '') + (isDone ? ' isdone' : '')}
            draggable=${can} onDragStart=${ev => { setDrag({ id: t.id, col: key }); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
            <div className="kt-top">
              <button className="kt-open" onClick=${() => openTask(t.id)} aria-label=${'Open ' + t.title}>
                ${ls.length > 0 && html`<span className="kt-l">${ls.map(l => html`<span key=${l} style=${{ '--c': LABEL_C[l] }}>${l}</span>`)}</span>`}
                <b className="kt-t">${t.title}</b>
                ${key === DONE && t.prev && html`<span className="kt-p">From ${t.prev.map(c => colName(c, BY, custom)).filter(Boolean).join(', ')}</span>`}
              </button>
              ${can && html`<button className="kt-dots" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setMenu(menu && menu.t.id === t.id && menu.col === key ? null : { t, col: key, x: r.right - 250, y: r.bottom + 6 }); }} aria-label=${'Card actions for ' + t.title} aria-haspopup="menu"><${Icon} n="dots" s=${18}/></button>`}
            </div>
            <div className="kt-f">
              ${can ? html`<button className=${'kt-c' + (isDone ? ' on' : '')} onClick=${() => complete(t)} aria-label=${t.done ? 'Reopen ' + t.title : isDone ? 'Undo complete' : 'Complete ' + t.title}><${Icon} n="check" s=${12}/>${t.done ? 'Reopen' : pending[t.id] ? 'Completed' : 'Complete'}</button>` : html`<span></span>`}
              <span className="kt-s">${t.subs.length > 0 && html`<span><${Icon} n="check" s=${12}/>${t.subs.filter(s => s.done).length}/${t.subs.length}</span>`}${t.comments.length > 0 && html`<span><${Icon} n="comment" s=${12}/>${t.comments.length}</span>`}${t.cols.length > 1 && !t.done && html`<span className="kt-sh" title="Also in other columns">Shared</span>`}</span>
            </div>
          </article>`; })}
        ${list.length === 0 && adding !== key && html`<div className="kc-e">${term ? 'No matching cards' : kind === 'doneCol' ? 'Finished cards land here' : 'Drop a card here'}</div>`}
        ${over && over.col === key && over.before === null && list.length > 0 && html`<div className="kc-drop"></div>`}
      </div></section>`;
  };

  const pinLeft = i => PINNED.slice(0, i).reduce((s, p) => s + (collapsed[p[0]] ? 52 : 260) + 12, 0);
  const lcount = tf.labels.length;
  return html`<div>
    <div className="pg-h kbh"><div><h1>Board</h1><p>${openCount} open cards. Click a card to open it, drag it to another column, or use the three dots.</p></div>
      <div className="kbh-r">
        <select id="kb-dept" className="sel" value=${tf.dept} onChange=${ev => setTf({ ...tf, dept: ev.target.value })} aria-label="Department"><option value="All">All departments</option>${DEPTS.map(d => html`<option key=${d} value=${d}>${d}</option>`)}</select>
        <select id="kb-jump" className="sel" value="" onChange=${ev => { if (ev.target.value) jump(ev.target.value); }} aria-label="Jump to a person"><option value="">Jump to…</option>${shown.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}<option value=${DONE}>Completed Tasks</option></select>
        <button className=${'chip' + (tf.hideEmpty ? ' on' : '')} onClick=${() => setTf({ ...tf, hideEmpty: !tf.hideEmpty })} aria-pressed=${!!tf.hideEmpty}>Hide empty columns</button>
        <div className="lm-w" ref=${lref}>
          <button className=${'chip' + (lcount ? ' on' : '')} onClick=${() => setLmenu(o => !o)} aria-haspopup="true" aria-expanded=${lmenu}><${Icon} n="filter" s=${14}/> Labels${lcount ? ' · ' + lcount : ''}</button>
          ${lmenu && html`<div className="lm" role="dialog" aria-label="Labels">
            <div className="lm-h"><b>Labels</b><button className="link" onClick=${() => setTf({ ...tf, labels: [], lfilter: false })}>Hide all</button></div>
            ${LABELS.map(l => html`<label className="lm-r" key=${l} htmlFor=${'lb-' + l}><input id=${'lb-' + l} type="checkbox" checked=${tf.labels.includes(l)} onChange=${() => toggleLabel(l)}/><i style=${{ '--c': LABEL_C[l] }}></i>${l}</label>`)}
            <hr/>
            <label className="lm-r" htmlFor="lb-filter"><input id="lb-filter" type="checkbox" checked=${tf.lfilter} disabled=${!lcount} onChange=${ev => setTf({ ...tf, lfilter: ev.target.checked })}/>Only show cards with these labels</label>
            <p className="lm-n">Checked labels appear on the cards. Unchecked labels stay hidden.</p></div>`}
        </div>
        <button className="btn pri" onClick=${() => openTask('new', { col: role === 'admin' ? 'priority' : user.n })}><${Icon} n="plus" s=${16}/> New card</button>
      </div></div>
    <div className="kb2" ref=${scroller} onDragOver=${edge}>
      ${PINNED.map((p, i) => renderCol(p[0], 'pin', p[1], { color: p[2], left: pinLeft(i) }))}
      ${shown.map(e => renderCol(e.n, 'person', e.n === user.n ? e.name + ' (you)' : e.name))}
      ${custom.map(c => renderCol(c.id, 'cust', c.name))}
      ${renderCol(DONE, 'doneCol', 'Completed Tasks')}
      <div className="kc2 addcol">${newCol == null ? html`<button className="addcol-b" onClick=${() => setNewCol('')}><${Icon} n="plus" s=${16}/> Add column</button>`
        : html`<div className="addcol-f"><input autoFocus className="inp" value=${newCol} placeholder="Column name" onChange=${ev => setNewCol(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') addColumn(); if (ev.key === 'Escape') setNewCol(null); }} aria-label="New column name"/><div className="cm-a"><button className="btn ghost sm" onClick=${() => setNewCol(null)}>Cancel</button><button className="btn pri sm" onClick=${addColumn}>Add</button></div></div>`}</div>
    </div>
    ${menu && html`<${CardMenu} m=${menu} user=${user} custom=${custom} setTasks=${setTasks} openTask=${openTask} close=${() => setMenu(null)}/>`}
    ${cmenu && html`<${ColMenu} m=${cmenu} custom=${custom} setCustom=${setCustom} setTasks=${setTasks} close=${() => setCmenu(null)}/>`}
  </div>`;
}
