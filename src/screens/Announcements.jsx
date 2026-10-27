import { useState } from 'react';
import { html, Icon, Av, HI } from '../ui.jsx';
import { TODISO, BY, activeEmps, fmtDM } from '../data.js';
import { useAcks } from '../alerts.js';

export const KINDS = {
  general: { label: 'General', icon: 'megaphone', c: '#0A84FF' },
  holiday: { label: 'Holiday', icon: 'sun', c: '#FF9F0A' },
  reminder: { label: 'Reminder', icon: 'bell', c: '#FF453A' },
  celebrate: { label: 'Celebration', icon: 'star', c: '#30D158' }
};

const when = t => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/ (am|pm)$/i, m => m.toUpperCase());

// Admins: who has pressed "Got it" on an announcement, and who has not yet
export function AckBar({ a, acks }) {
  const [open, setOpen] = useState(false), [tab, setTab] = useState('pending');
  const list = acks[String(a.id)] || [];
  const mine = e => a.byId ? e.n === a.byId : e.name === a.by;
  const everyone = activeEmps().filter(e => !mine(e));
  const done = list.map(x => ({ e: BY[x.emp], at: x.at })).filter(x => x.e && !mine(x.e)).sort((p, q) => q.at - p.at);
  const doneIds = new Set(done.map(x => x.e.n)), pending = everyone.filter(e => !doneIds.has(e.n));
  const pct = everyone.length ? Math.round(done.length / everyone.length * 100) : 0;
  return html`<div className="ack">
    <button className="ack-b" onClick=${() => setOpen(o => !o)} aria-expanded=${open} title="See who has acknowledged this">
      <span className="ack-bar"><i style=${{ width: pct + '%' }}></i></span>
      <span className="ack-t"><b>${done.length}</b> of ${everyone.length} acknowledged${pending.length > 0 ? ' · ' + pending.length + ' waiting' : ' · everyone'}</span><${Icon} n=${open ? 'chevL' : 'next'} s=${14}/></button>
    ${open && html`<div className="ack-d">
      <div className="ack-seg" role="group" aria-label="Show"><button className=${tab === 'pending' ? 'on' : ''} onClick=${() => setTab('pending')}>Not yet (${pending.length})</button><button className=${tab === 'done' ? 'on' : ''} onClick=${() => setTab('done')}>Acknowledged (${done.length})</button></div>
      <div className="ack-l">${tab === 'pending'
        ? (pending.length ? pending.map(e => html`<div className="ack-r" key=${e.n}><${Av} e=${e} s=${28}/><span><b>${e.name}</b><small>${e.role}</small></span></div>`) : html`<div className="ack-n">Everyone has acknowledged this.</div>`)
        : (done.length ? done.map(x => html`<div className="ack-r" key=${x.e.n}><${Av} e=${x.e} s=${28}/><span><b>${x.e.name}</b><small>${x.e.role}</small></span><em>${when(x.at)}</em></div>`) : html`<div className="ack-n">No one has acknowledged this yet.</div>`)}</div>
    </div>`}
  </div>`;
}

export function AnnList({ ann, setAnn, canPost, tracker = false, limit = 0 }) {
  const acks = useAcks(tracker);
  const shown = limit ? ann.slice(0, limit) : ann;
  return html`<div className="anl">
    ${ann.length === 0 ? html`<div className="empty" style=${{ textAlign: 'left' }}>No announcements right now.</div>` :
      shown.map(a => { const kd = KINDS[a.kind] || KINDS.general; return html`<article className="an" key=${a.id}>
        <span className="an-i" style=${{ '--c': kd.c }}><${Icon} n=${kd.icon} s=${22}/></span>
        <div className="an-b">
          <div className="an-h"><b>${a.title}</b>${canPost && html`<button className="link" onClick=${() => setAnn(x => x.filter(y => y.id !== a.id))} aria-label=${'Remove ' + a.title}>Remove</button>`}</div>
          ${a.body && html`<p>${a.body}</p>`}<small>${kd.label} · ${a.by} · ${fmtDM(a.date)}</small>${tracker && html`<${AckBar} a=${a} acks=${acks}/>`}</div></article>`; })}
  </div>`;
}

export function Composer({ user, setAnn, close }) {
  const [t, setT] = useState(''); const [b, setB] = useState(''); const [k, setK] = useState('general');
  const post = ev => {
    ev.preventDefault(); if (!t.trim()) return;
    setAnn(a => [{ id: Date.now(), kind: k, title: t.trim(), body: b.trim(), date: TODISO, by: user.name }, ...a]); close();
  };
  return html`<form onSubmit=${post}>
    <div className="fld"><span className="lb">Type</span><div className="chips" style=${{ marginTop: 0, flexWrap: 'wrap' }}>${Object.entries(KINDS).map(([key, v]) => html`<button type="button" key=${key} className=${'chip' + (k === key ? ' on' : '')} onClick=${() => setK(key)}>${v.label}</button>`)}</div></div>
    <div className="fld"><label htmlFor="ann-t">Headline</label><input id="ann-t" className="inp" value=${t} onChange=${ev => setT(ev.target.value)} placeholder="What do people need to know?"/></div>
    <div className="fld"><label htmlFor="ann-b">Details (optional)</label><textarea id="ann-b" className="inp" value=${b} onChange=${ev => setB(ev.target.value)}></textarea></div>
    <div style=${{ display: 'flex', gap: 10, marginTop: 18 }}><button className="btn pri sm" type="submit" disabled=${!t.trim()}>Post to everyone</button><button className="btn ghost sm" type="button" onClick=${close}>Cancel</button></div></form>`;
}

/* The Announcements page: everyone reads here. Admins post, remove, and see who has acknowledged each one. */
export function Announcements({ ann, setAnn, user, role }) {
  const admin = role === 'admin', [composing, setComposing] = useState(false);
  return html`<div>
    <div className="pg-h"><div><h1><${HI} n="megaphone" tone="orange"/>Announcements</h1><p>${admin ? 'Post to everyone and see who has acknowledged' : 'Notices from People and Ops'}</p></div>
      ${admin && !composing && html`<button className="btn pri" onClick=${() => setComposing(true)}><${Icon} n="plus" s=${16}/> New announcement</button>`}</div>
    ${admin && composing && html`<section className="an-new"><h2>New announcement</h2><${Composer} user=${user} setAnn=${setAnn} close=${() => setComposing(false)}/></section>`}
    <section className="an-pg"><${AnnList} ann=${ann} setAnn=${setAnn} canPost=${admin} tracker=${admin}/></section>
  </div>`;
}
