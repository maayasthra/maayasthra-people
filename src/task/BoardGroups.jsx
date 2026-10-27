import { useEffect } from 'react';
import { html, Icon } from '../ui.jsx';

const COLORS = ['#0A84FF', '#BF5AF2', '#FF375F', '#FF9F0A', '#30D158', '#64D2FF', '#FFD60A', '#AC8E68', '#8E8E93', '#FF6482'];
const EMOJI = ['📌', '🎨', '💻', '🎬', '✍️', '📣', '⭐', '🔥'];

/* Admins sort the board's columns into departments by hand. Each department has its own name, colour and emoji. Nothing is assigned automatically. */
export function BoardGroups({ groups, setGroups, columns, onClose, focusId }) {
  useEffect(() => { if (focusId) { const el = document.getElementById('bg-g-' + focusId); if (el) el.scrollIntoView({ block: 'center' }); } }, []);
  useEffect(() => { const k = ev => { if (ev.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const patch = (id, p) => setGroups(gs => gs.map(g => g.id === id ? { ...g, ...p } : g));
  const add = () => setGroups(gs => [...gs, { id: 'g' + Date.now().toString(36), name: '', color: COLORS.find(c => !gs.some(g => g.color === c)) || COLORS[0], icon: '', members: [], position: gs.length }]);
  const remove = id => setGroups(gs => gs.filter(g => g.id !== id));
  // A column belongs to one group at a time: ticking it here takes it out of any other group
  const toggle = (id, key) => setGroups(gs => gs.map(g => g.id === id ? { ...g, members: g.members.includes(key) ? g.members.filter(m => m !== key) : [...g.members, key] } : { ...g, members: g.members.filter(m => m !== key) }));
  const move = (id, d) => setGroups(gs => { const i = gs.findIndex(g => g.id === id), j = i + d; if (j < 0 || j >= gs.length) return gs; const n = [...gs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const otherOf = (id, key) => groups.find(g => g.id !== id && g.members.includes(key));

  return html`<div className="dlg-bg" onClick=${onClose}></div>
    <div className="dlg bg-d" role="dialog" aria-modal="true" aria-labelledby="bg-t">
      <div className="eod-h"><div className="dlg-i"><${Icon} n="layers" s=${22}/></div>
        <div><h2 id="bg-t">Board departments</h2><p>Create departments and put the board’s columns into them by hand. Each department has its own name, colour and emoji, and shows above its columns. You can close and open a whole department on the board.</p></div></div>
      <div className="bg-l">
        ${groups.length === 0 && html`<div className="none"><b>No departments yet</b>Add one, then pick which columns belong to it.</div>`}
        ${groups.map((g, i) => html`<section className=${'bg-g' + (g.id === focusId ? ' focus' : '')} id=${'bg-g-' + g.id} key=${g.id} style=${{ '--c': g.color }}>
          <div className="bg-top">
            <input className="inp bg-ic" value=${g.icon} placeholder="🙂" maxLength="4" aria-label="Emoji" onChange=${ev => patch(g.id, { icon: ev.target.value })}/>
            <input className="inp bg-nm" value=${g.name} placeholder="Department name" maxLength="60" aria-label="Department name" autoComplete="off" onChange=${ev => patch(g.id, { name: ev.target.value })}/>
            <button className="ib" disabled=${i === 0} onClick=${() => move(g.id, -1)} aria-label="Move up" title="Move up"><${Icon} n="up" s=${14}/></button>
            <button className="ib" disabled=${i === groups.length - 1} onClick=${() => move(g.id, 1)} aria-label="Move down" title="Move down"><${Icon} n="down" s=${14}/></button>
            <button className="ib" onClick=${() => remove(g.id)} aria-label=${'Delete ' + (g.name || 'this department')} title="Delete this department"><${Icon} n="trash" s=${14}/></button>
          </div>
          <div className="bg-row"><span>Emoji</span><div className="bg-em">${EMOJI.map(e => html`<button key=${e} className=${g.icon === e ? 'on' : ''} onClick=${() => patch(g.id, { icon: e })} aria-label=${'Use ' + e}>${e}</button>`)}</div></div>
          <div className="bg-row"><span>Colour</span><div className="bg-sw">${COLORS.map(c => html`<button key=${c} className=${g.color.toLowerCase() === c.toLowerCase() ? 'on' : ''} style=${{ background: c }} onClick=${() => patch(g.id, { color: c })} aria-label=${'Colour ' + c}></button>`)}
            <input type="color" value=${g.color} onChange=${ev => patch(g.id, { color: ev.target.value.toUpperCase() })} aria-label="Pick any colour" title="Pick any colour"/></div></div>
          <div className="bg-row"><span>Columns</span><div className="bg-cols">${columns.map(c => { const on = g.members.includes(c.key), o = !on && otherOf(g.id, c.key);
            return html`<button key=${c.key} className=${'bg-c' + (on ? ' on' : '')} onClick=${() => toggle(g.id, c.key)} title=${o ? 'In “' + (o.name || 'another department') + '”. Click to move it here.' : undefined}>${o && html`<i style=${{ background: o.color }}></i>`}${c.label}</button>`; })}
            ${columns.length === 0 && html`<small>No columns to group yet.</small>`}</div></div>
        </section>`)}
      </div>
      <div className="dlg-a"><button className="btn ghost" onClick=${add}><${Icon} n="plus" s=${14}/> Add a department</button><button className="btn pri" onClick=${onClose}>Done</button></div>
    </div>`;
}
