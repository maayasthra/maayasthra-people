import { useState, useEffect } from 'react';
import { html, Icon, Av, HI } from '../ui.jsx';
import { EMP, ROLEMAP, STAT_C } from '../data.js';
import { IS_DEMO } from '../env.js';
import { loadMembers } from '../staff.js';

const when = (t, time) => t ? new Date(t).toLocaleString('en-US', time ? { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
  : { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }): '';
const FILTERS = [['all', 'Everyone'], ['Admin', 'Admins'], ['Project manager', 'Project managers'], ['Employee', 'Employees'], ['invited', 'Not signed up']];

// Admin only: everyone with their access, when they last signed in, and when their account was created.
export function Members({ open, openForm }) {
  const [info, setInfo] = useState(null), [err, setErr] = useState(''), [q, setQ] = useState(''), [f, setF] = useState('all'), [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    if (IS_DEMO) { const now = Date.now(); const o = {}; EMP.forEach(e => { o[e.n] = { last: e.n % 6 === 0 ? 0 : now - ((e.n * 37) % 90) * 864e5, created: now - (200 + e.n * 11) * 864e5, signedUp: e.n % 6 !== 0 }; }); setInfo(o); return; }
    loadMembers().then(o => { if (live) setInfo(o); }).catch(e => { if (live) { setErr(e.message); setInfo({}); } });
    return () => { live = false; };
  }, []);
  const term = q.trim().toLowerCase();
  const list = EMP.filter(e => {
    const i = info && info[e.n], acc = ROLEMAP[e.n] || 'Employee';
    if (f === 'invited' ? (i && i.signedUp) : f !== 'all' && acc !== f) return false;
    return !term || e.name.toLowerCase().includes(term) || (e.email || '').toLowerCase().includes(term);
  }).sort((a, b) => (a.status === 'Exited') - (b.status === 'Exited') || a.name.localeCompare(b.name));
  const link = location.origin;
  const copy = () => { try { navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => {}); } catch (x) {} };

  return html`<div className="mb">
    <div className="pg-h"><div><h1><${HI} n="members" tone="blue"/>Members</h1><p>Manage members and invite new users</p></div></div>
    <div className="mb-bar">
      <button className="btn pri" onClick=${() => openForm(null)}><${Icon} n="plus" s=${16}/> Invite Members</button>
      <button className="btn ghost" onClick=${copy} title="Send this link to new members. They sign up with their work email."><${Icon} n=${copied ? 'check' : 'copy'} s=${15}/> ${copied ? 'Link copied' : 'Copy sign-up link'}</button>
      <span style=${{ flex: 1 }}></span>
      <div className="mb-s"><${Icon} n="search" s=${15}/><input className="inp" value=${q} placeholder="Search members" aria-label="Search members" onChange=${ev => setQ(ev.target.value)}/></div>
    </div>
    <div className="mb-f" role="group" aria-label="Filter">${FILTERS.map(([k, l]) => html`<button key=${k} className=${f === k ? 'on' : ''} onClick=${() => setF(k)}>${l}</button>`)}</div>
    ${err && html`<div className="eod-e" role="alert">${err}</div>`}
    <div className="mb-t" role="table" aria-label="Members">
      <div className="mb-hd" role="row"><span>Name</span><span>Last login</span><span>Created</span><span></span></div>
      ${info === null && html`<div className="none">Loading…</div>`}
      ${info !== null && list.length === 0 && html`<div className="none"><b>No members found</b>Try a different search or filter.</div>`}
      ${info !== null && list.map(e => { const i = info[e.n] || {}, acc = ROLEMAP[e.n] || 'Employee', out = e.status === 'Exited';
        return html`<button className=${'mb-r' + (out ? ' out' : '')} key=${e.n} role="row" onClick=${() => open(e.n)} aria-label=${'Open ' + e.name}>
          <span className="mb-n"><${Av} e=${e} s=${44}/><span className="row-t"><b>${e.name}</b><span className="mb-sub"><span className="mb-em">${e.email}</span><i>•</i><span className="mb-ro">${acc}${out ? ' · Exited' : ''}</span></span></span></span>
          <span className="mb-d">${i.signedUp === false ? html`<em className="mb-inv">Not signed up yet</em>` : i.last ? when(i.last, true) : '—'}</span>
          <span className="mb-d mb-c">${i.created ? when(i.created) : '—'}</span>
          <span className="mb-a"><${Icon} n="next" s=${16}/></span></button>`; })}
    </div>
  </div>`;
}
