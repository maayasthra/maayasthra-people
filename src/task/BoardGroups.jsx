import { useState, useEffect } from 'react';
import { html, Icon } from '../ui.jsx';

const COLORS = ['#0A84FF', '#BF5AF2', '#FF375F', '#FF9F0A', '#30D158', '#64D2FF', '#FFD60A', '#AC8E68', '#8E8E93', '#FF6482'];
const EMOJI = ['📌', '🎨', '💻', '🎬', '✍️', '📣', '⭐', '🔥'];
const SHOW = [['all', 'All'], ['in', 'In this department'], ['free', 'Not in any']];

/* Admins sort the board's columns into departments by hand. Each department has its own name, colour and emoji.
   Nothing is assigned automatically. A list on the left, the selected department on the right, and a searchable list of columns that scrolls. */
export function BoardGroups({ groups, setGroups, columns, onClose, focusId }) {
  const [sel, setSel] = useState(() => (groups.find(g => g.id === focusId) || groups[0] || {}).id || null);
  const [q, setQ] = useState(''), [show, setShow] = useState('all');
  useEffect(() => { const k = ev => { if (ev.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const g = groups.find(x => x.id === sel) || null;

  const patch = p => setGroups(gs => gs.map(x => x.id === sel ? { ...x, ...p } : x));
  const add = () => { const id = 'g' + Date.now().toString(36); setGroups(gs => [...gs, { id, name: '', color: COLORS.find(c => !gs.some(x => x.color === c)) || COLORS[0], icon: '', members: [], position: gs.length }]); setSel(id); setQ(''); setShow('all'); };
  const remove = () => { const i = groups.findIndex(x => x.id === sel), next = groups[i + 1] || groups[i - 1]; setGroups(gs => gs.filter(x => x.id !== sel)); setSel(next ? next.id : null); };
  const move = d => setGroups(gs => { const i = gs.findIndex(x => x.id === sel), j = i + d; if (j < 0 || j >= gs.length) return gs; const n = [...gs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  // A column belongs to one department at a time: adding it here takes it out of any other
  const setMembers = (keys, on) => setGroups(gs => gs.map(x => x.id === sel ? { ...x, members: on ? [...new Set([...x.members, ...keys])] : x.members.filter(m => !keys.includes(m)) } : { ...x, members: on ? x.members.filter(m => !keys.includes(m)) : x.members }));
  const otherOf = key => groups.find(x => x.id !== sel && x.members.includes(key));

  const term = q.trim().toLowerCase();
  const rows = g ? columns.filter(c => {
    const inThis = g.members.includes(c.key), other = otherOf(c.key);
    if (show === 'in' && !inThis) return false;
    if (show === 'free' && (inThis || other)) return false;
    return !term || c.label.toLowerCase().includes(term) || (c.sub || '').toLowerCase().includes(term);
  }) : [];
  const shownKeys = rows.map(r => r.key), allOn = rows.length > 0 && rows.every(r => g.members.includes(r.key));

  return html`<div className="dlg-bg" onClick=${onClose}></div>
    <div className="dlg bg-d" role="dialog" aria-modal="true" aria-labelledby="bg-t">
      <header className="bg-hd">
        <div><h2 id="bg-t">Board departments</h2><p>Put the board’s columns into departments by hand. Each department has its own name, colour and emoji and shows above its columns.</p></div>
        <button className="ib" onClick=${onClose} aria-label="Close"><${Icon} n="x" s=${16}/></button>
      </header>
      <div className="bg-body">
        <nav className="bg-nav" aria-label="Departments">
          <div className="bg-navl">${groups.map(x => html`<button key=${x.id} className=${'bg-ni' + (x.id === sel ? ' on' : '')} style=${{ '--c': x.color }} onClick=${() => { setSel(x.id); setQ(''); setShow('all'); }}>
            <span className="bg-nic">${x.icon || html`<i></i>`}</span><span className="bg-nn">${x.name || 'Untitled department'}</span><small>${x.members.length}</small></button>`)}</div>
          <button className="bg-add" onClick=${add}><${Icon} n="plus" s=${14}/> Add a department</button>
        </nav>
        ${!g ? html`<div className="bg-empty"><${Icon} n="layers" s=${28}/><b>No departments yet</b><p>Add one, then choose which columns belong to it.</p><button className="btn pri" onClick=${add}><${Icon} n="plus" s=${14}/> Add a department</button></div>`
        : html`<section className="bg-ed" style=${{ '--c': g.color }}>
          <div className="bg-f"><label htmlFor="bg-name">Name</label>
            <div className="bg-nm-row"><input id="bg-nm-ic" className="inp bg-ic" value=${g.icon} placeholder="🙂" maxLength="4" aria-label="Emoji" onChange=${ev => patch({ icon: ev.target.value })}/>
              <input id="bg-name" className="inp" value=${g.name} placeholder="Department name" maxLength="60" autoComplete="off" onChange=${ev => patch({ name: ev.target.value })}/>
              <span className="bg-tools"><button className="ib" disabled=${groups[0] && groups[0].id === g.id} onClick=${() => move(-1)} aria-label="Move up" title="Move up"><${Icon} n="up" s=${14}/></button>
                <button className="ib" disabled=${groups[groups.length - 1].id === g.id} onClick=${() => move(1)} aria-label="Move down" title="Move down"><${Icon} n="down" s=${14}/></button>
                <button className="ib bg-del" onClick=${remove} aria-label=${'Delete ' + (g.name || 'this department')} title="Delete this department"><${Icon} n="trash" s=${14}/></button></span></div></div>
          <div className="bg-f"><label>Emoji</label><div className="bg-em">${EMOJI.map(e => html`<button key=${e} className=${g.icon === e ? 'on' : ''} onClick=${() => patch({ icon: e })} aria-label=${'Use ' + e}>${e}</button>`)}</div></div>
          <div className="bg-f"><label>Colour</label><div className="bg-sw">${COLORS.map(c => html`<button key=${c} className=${g.color.toLowerCase() === c.toLowerCase() ? 'on' : ''} style=${{ background: c }} onClick=${() => patch({ color: c })} aria-label=${'Colour ' + c}></button>`)}
            <label className="bg-pick" title="Pick any colour" style=${{ background: g.color }}><input type="color" value=${g.color} onChange=${ev => patch({ color: ev.target.value.toUpperCase() })} aria-label="Pick any colour"/></label></div></div>
          <div className="bg-mem">
            <div className="bg-mh"><b>Columns in this department</b><span>${g.members.length} of ${columns.length}</span></div>
            <div className="bg-mt">
              <div className="bg-search"><${Icon} n="search" s=${15}/><input className="inp" value=${q} placeholder="Search people" aria-label="Search columns" autoComplete="off" onChange=${ev => setQ(ev.target.value)}/></div>
              <div className="bg-seg" role="group" aria-label="Show">${SHOW.map(([k, l]) => html`<button key=${k} className=${show === k ? 'on' : ''} onClick=${() => setShow(k)}>${l}</button>`)}</div>
            </div>
            <div className="bg-bulk"><button className="link" disabled=${!rows.length} onClick=${() => setMembers(shownKeys, !allOn)}>${allOn ? 'Remove all shown' : 'Add all shown'} (${rows.length})</button></div>
            <div className="bg-list" role="group" aria-label="Columns">
              ${rows.map(c => { const on = g.members.includes(c.key), o = !on && otherOf(c.key);
                return html`<label className=${'bg-r' + (on ? ' on' : '')} key=${c.key}><input type="checkbox" checked=${on} onChange=${() => setMembers([c.key], !on)}/>
                  <span className="bg-ck"><${Icon} n="check" s=${12}/></span><span className="bg-rn"><b>${c.label}</b>${c.sub && html`<small>${c.sub}</small>`}</span>
                  ${o && html`<em className="bg-in" style=${{ '--c': o.color }}><i></i>${o.icon || ''} ${o.name || 'another department'}</em>`}</label>`; })}
              ${rows.length === 0 && html`<div className="bg-none">${columns.length === 0 ? 'No columns to put in a department yet.' : 'No one matches.'}</div>`}
            </div>
          </div>
        </section>`}
      </div>
      <footer className="bg-ft"><button className="btn pri" onClick=${onClose}>Done</button></footer>
    </div>`;
}
