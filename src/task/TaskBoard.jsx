import { useState, useEffect, useRef } from 'react';
import { html, Icon, Av } from '../ui.jsx';
import { Sheet, DueChip, PrioFlag } from './parts.jsx';
import { BY, activeEmps, DEPTS } from '../data.js';
import { POOL, LABEL_C, moveCard, copyCard, duplicateCard, deleteCard, mkTask, isOpen } from '../tasks.js';

function BoardForm({ setBoards, setTf, close }) {
  const [name, setName] = useState(''), [pool, setPool] = useState(false);
  const save = () => { if (!name.trim()) return; const b = { id: 'b' + Date.now().toString(36), name: name.trim(), pool }; setBoards(bs => [...bs, b]); setTf(f => ({ ...f, board: b.id })); close(); };
  return html`<${Sheet} title="New board" onClose=${close} footer=${html`<button className="btn ghost" onClick=${close}>Cancel</button><button className="btn pri" disabled=${!name.trim()} onClick=${save}>Create board</button>`}>
    <div className="fld"><label htmlFor="bd-n">Board name</label><input id="bd-n" className="inp" value=${name} onChange=${ev => setName(ev.target.value)} placeholder="For example, Campaigns"/></div>
    <label className="cbx" htmlFor="bd-p"><input id="bd-p" type="checkbox" checked=${pool} onChange=${ev => setPool(ev.target.checked)}/> Start with a Priority Tasks column</label>
    <p className="bar-l">Every board gets a column for each person. A Priority Tasks column is a pool to load work into, then hand out to people.</p>
  <//>`;
}

/* The three-dots menu: move, copy, duplicate to a person, or delete */
function CardMenu({ m, board, user, setTasks, close }) {
  const [stage, setStage] = useState('root'), [q, setQ] = useState(''), [sure, setSure] = useState(false);
  const { t, col } = m;
  const people = activeEmps().sort((a, b) => a.name.localeCompare(b.name)).filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
  const pick = to => {
    if (stage === 'move') setTasks(ts => moveCard(ts, t.id, col, to));
    else if (stage === 'copy') setTasks(ts => copyCard(ts, t.id, to));
    else setTasks(ts => duplicateCard(ts, t.id, to, user));
    close();
  };
  const blocked = to => (stage === 'move' && to === col) || (stage === 'copy' && t.cols.includes(to));
  const L = { move: 'Move to', copy: 'Copy to', dup: 'Duplicate to' };
  const style = { left: Math.max(12, Math.min(m.x, window.innerWidth - 284)), top: Math.max(12, Math.min(m.y, window.innerHeight - 380)) };
  return html`<div className="cm" style=${style} role="menu" onMouseDown=${ev => ev.stopPropagation()}>
    ${stage === 'root' ? html`
      <button role="menuitem" onClick=${() => setStage('move')}><${Icon} n="next" s=${15}/> Move to…</button>
      <button role="menuitem" onClick=${() => setStage('copy')}><${Icon} n="copy" s=${15}/> Copy to…</button>
      <button role="menuitem" onClick=${() => setStage('dup')}><${Icon} n="plus" s=${15}/> Duplicate to…</button>
      <hr/>
      ${sure ? html`<div className="cm-s">Delete this card?</div><div className="cm-a"><button className="btn ghost sm" onClick=${() => setSure(false)}>Cancel</button><button className="btn sm danger" onClick=${() => { setTasks(ts => deleteCard(ts, t.id, col)); close(); }}>Delete</button></div>`
        : html`<button role="menuitem" className="cm-d" onClick=${() => setSure(true)}><${Icon} n="trash" s=${15}/> Delete this card</button>`}`
    : html`
      <div className="cm-h"><button className="ib" onClick=${() => { setStage('root'); setQ(''); }} aria-label="Back"><${Icon} n="chevL" s=${14}/></button><b>${L[stage]}</b></div>
      <input autoFocus className="inp" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Find a person" aria-label="Find a person"/>
      <div className="cm-l">
        ${board.pool && !q && html`<button role="menuitem" disabled=${blocked(POOL)} onClick=${() => pick(POOL)}><span className="cm-pi"><${Icon} n="flag" s=${15}/></span><span><b>Priority Tasks</b><small>Shared pool</small></span></button>`}
        ${people.map(e => html`<button key=${e.n} role="menuitem" disabled=${blocked(e.n)} onClick=${() => pick(e.n)}><${Av} e=${e} s=${28}/><span><b>${e.name}</b><small>${e.role}</small></span></button>`)}
        ${people.length === 0 && html`<div className="cm-s">No one matches.</div>`}
      </div>`}
  </div>`;
}

export function TaskBoard({ tasks, setTasks, boards, setBoards, user, role, tf, setTf, tq, openTask, focus }) {
  const board = boards.find(b => b.id === tf.board) || boards[0];
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(null), [adding, setAdding] = useState(null), [text, setText] = useState(''), [bform, setBform] = useState(false);
  const scroller = useRef(null);
  const canMove = t => role === 'admin' || t.cols.includes(user.n) || t.by === user.n;
  useEffect(() => { if (!menu) return; const f = () => setMenu(null); const k = ev => { if (ev.key === 'Escape') setMenu(null); }; document.addEventListener('mousedown', f); document.addEventListener('keydown', k); window.addEventListener('resize', f); return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); window.removeEventListener('resize', f); }; }, [menu]);
  const jump = n => { const el = scroller.current && scroller.current.querySelector('[data-col="' + n + '"]'); if (el) scroller.current.scrollTo({ left: el.offsetLeft - (board.pool ? 310 : 0) - 16, behavior: 'smooth' }); };
  useEffect(() => { if (focus != null) setTimeout(() => jump(focus), 120); }, [focus, tf.board]);

  const term = tq.trim().toLowerCase();
  const mine = t => t.board === board.id && (!term || (t.title + ' ' + t.client + ' ' + t.labels.join(' ')).toLowerCase().includes(term));
  const people = activeEmps().filter(e => tf.dept === 'All' || e.dept === tf.dept).sort((a, b) => (b.n === user.n) - (a.n === user.n) || a.name.localeCompare(b.name));
  const cards = col => tasks.filter(t => mine(t) && t.cols.includes(col));
  const shown = tf.hideEmpty ? people.filter(e => cards(e.n).length) : people;
  const open = tasks.filter(t => t.board === board.id && isOpen(t)).length;

  const onOver = (ev, col) => { if (!drag) return; ev.preventDefault(); const cs = [...ev.currentTarget.querySelectorAll('.kt:not(.dragging)')]; const next = cs.find(c => ev.clientY < c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2); setOver({ col, before: next ? next.dataset.id : null }); };
  const onDrop = (ev, col) => { ev.preventDefault(); if (drag) setTasks(ts => moveCard(ts, drag.id, drag.col, col, over && over.col === col ? over.before : null)); setDrag(null); setOver(null); };
  const add = col => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setAdding(null); return; }
    setTasks(ts => [...ts, ...lines.map(title => mkTask({ board: board.id, title, cols: [col] }, user))]);
    setText(''); setAdding(null);
  };

  // A plain function, not a component, so typing or dragging never remounts the columns.
  const renderCol = (col, head, e) => html`<section key=${col} data-col=${col} className=${'kc2' + (col === POOL ? ' pool' : '') + (over && over.col === col ? ' over' : '')} onDragOver=${ev => onOver(ev, col)} onDrop=${ev => onDrop(ev, col)} onDragLeave=${ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(o => o && o.col === col ? null : o); }}>
    <header className="kc2-h">${head}<span className="kc-n">${cards(col).length}</span><span style=${{ flex: 1 }}></span>
      <button className="ib" onClick=${() => { setAdding(adding === col ? null : col); setText(''); }} aria-label=${'Add a card to ' + (e ? e.name : 'Priority Tasks')}><${Icon} n="plus" s=${15}/></button></header>
    <div className="kc2-b">
      ${adding === col && html`<div className="kc-add"><textarea autoFocus rows="2" className="inp" value=${text} placeholder="Card title. Paste several lines to add several cards." onChange=${ev => setText(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); add(col); } if (ev.key === 'Escape') setAdding(null); }} onBlur=${() => { if (!text.trim()) setAdding(null); }} aria-label="New card title"></textarea><small>Enter to add</small></div>`}
      ${cards(col).map(t => html`<article key=${t.id + col} data-id=${t.id} className=${'kt' + (drag && drag.id === t.id && drag.col === col ? ' dragging' : '') + (over && over.col === col && over.before === t.id ? ' drop-before' : '') + (t.done ? ' isdone' : '')}
        draggable=${canMove(t)} onDragStart=${ev => { setDrag({ id: t.id, col }); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', t.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>
        <div className="kt-top">
          <button className=${'ck-c' + (t.done ? ' on' : '')} disabled=${!canMove(t)} onClick=${() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} aria-label=${(t.done ? 'Reopen ' : 'Complete ') + t.title}>${t.done && html`<${Icon} n="check" s=${12}/>`}</button>
          <button className="kt-open" onClick=${() => openTask(t.id)} aria-label=${'Open ' + t.title}>
            ${t.labels.length > 0 && html`<span className="kt-l">${t.labels.slice(0, 3).map(l => html`<span key=${l} style=${{ '--c': LABEL_C[l] }}>${l}</span>`)}</span>`}
            <b className="kt-t">${t.title}</b>
            ${t.client && html`<span className="kt-p">${t.client}</span>`}
            <span className="kt-m"><${DueChip} due=${t.due} done=${t.done}/><${PrioFlag} p=${t.prio}/></span>
          </button>
          ${canMove(t) && html`<button className="kt-dots" onMouseDown=${ev => ev.stopPropagation()} onClick=${ev => { const r = ev.currentTarget.getBoundingClientRect(); setMenu(menu && menu.t.id === t.id && menu.col === col ? null : { t, col, x: r.right - 250, y: r.bottom + 6 }); }} aria-label=${'Card actions for ' + t.title} aria-haspopup="menu"><${Icon} n="dots" s=${18}/></button>`}
        </div>
        ${(t.subs.length > 0 || t.comments.length > 0 || t.cols.length > 1) && html`<div className="kt-f"><span className="kt-s">${t.subs.length > 0 && html`<span><${Icon} n="check" s=${13}/>${t.subs.filter(s => s.done).length}/${t.subs.length}</span>`}${t.comments.length > 0 && html`<span><${Icon} n="comment" s=${13}/>${t.comments.length}</span>`}</span>
          ${t.cols.length > 1 && html`<span className="kt-sh" title="This card also appears in other columns">Shared · ${t.cols.length}</span>`}</div>`}
      </article>`)}
      ${cards(col).length === 0 && adding !== col && html`<div className="kc-e">${term ? 'No matching cards' : col === POOL ? 'Load priority tasks here' : 'Drop a card here'}</div>`}
      ${over && over.col === col && over.before === null && cards(col).length > 0 && html`<div className="kc-drop"></div>`}
    </div></section>`;

  return html`<div>
    <div className="pg-h"><div><h1>Board</h1><p>${open} open cards on ${board.name}. Drag a card to another person, or use the three dots.</p></div>
      <button className="btn pri" onClick=${() => openTask('new', { board: board.id, col: board.pool ? POOL : user.n })}><${Icon} n="plus" s=${16}/> New card</button></div>
    <div className="bt-bar">
      <div className="bt" role="tablist" aria-label="Boards">${boards.map(b => html`<button key=${b.id} role="tab" aria-selected=${b.id === board.id} className=${b.id === board.id ? 'on' : ''} onClick=${() => setTf({ ...tf, board: b.id })}>${b.name}<small>${tasks.filter(t => t.board === b.id && isOpen(t)).length}</small></button>`)}
        ${role === 'admin' && html`<button className="bt-new" onClick=${() => setBform(true)} aria-label="New board"><${Icon} n="plus" s=${14}/> New board</button>`}</div>
      <span style=${{ flex: 1 }}></span>
      <select id="kb-dept" className="sel" value=${tf.dept} onChange=${ev => setTf({ ...tf, dept: ev.target.value })} aria-label="Department"><option value="All">All departments</option>${DEPTS.map(d => html`<option key=${d} value=${d}>${d}</option>`)}</select>
      <select id="kb-jump" className="sel" value="" onChange=${ev => { if (ev.target.value) jump(ev.target.value); }} aria-label="Jump to a person"><option value="">Jump to…</option>${board.pool && html`<option value=${POOL}>Priority Tasks</option>`}${shown.map(e => html`<option key=${e.n} value=${e.n}>${e.name}</option>`)}</select>
      <button className=${'chip' + (tf.hideEmpty ? ' on' : '')} onClick=${() => setTf({ ...tf, hideEmpty: !tf.hideEmpty })} aria-pressed=${!!tf.hideEmpty}>Hide empty columns</button>
    </div>
    <div className="kb2" ref=${scroller}>
      ${board.pool && renderCol(POOL, html`<span className="pool-i"><${Icon} n="flag" s=${16}/></span><span className="row-t"><b>Priority Tasks</b><span>Load here, then hand out</span></span>`)}
      ${shown.map(e => renderCol(e.n, html`<${Av} e=${e} s=${34}/><span className="row-t"><b>${e.n === user.n ? e.name + ' (you)' : e.name}</b><span>${e.role}</span></span>`, e))}
    </div>
    ${menu && html`<${CardMenu} m=${menu} board=${board} user=${user} setTasks=${setTasks} close=${() => setMenu(null)}/>`}
    ${bform && html`<${BoardForm} setBoards=${setBoards} setTf=${setTf} close=${() => setBform(false)}/>`}
  </div>`;
}
