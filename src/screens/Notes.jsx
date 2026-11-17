import { useState, useEffect, useRef, useMemo } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { useConfirm } from '../Confirm.jsx';
import { useNotes, TITLE_MAX, BODY_MAX } from '../notesDb.js';

/* My notes: private to the signed-in person, the same on every device. Typing is saved on its own a moment after you stop. */

const isEmpty = x => !x.title.trim() && !x.body.trim();
const DAY = 86400000;
function stamp(ms, now = Date.now()) {
  const d = new Date(ms), t = new Date(now), start = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  if (ms >= start) return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (ms >= start - DAY) return 'Yesterday';
  if (ms >= start - 6 * DAY) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
}
const preview = b => b.replace(/\s+/g, ' ').trim().slice(0, 110);

// The page for one note. Keyed by note id, so switching notes starts a fresh editor (the old one saves first).
function Editor({ note, save, onDelete, onBack }) {
  const [title, setTitle] = useState(note.title), [body, setBody] = useState(note.body), [state, setState] = useState('saved');
  const live = useRef({ title: note.title, body: note.body }), dirty = useRef(false), timer = useRef(0), busy = useRef(false), again = useRef(false), alive = useRef(true);
  const seen = useRef(note.updated), titleRef = useRef(null);

  const flush = async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true; dirty.current = false;
    const sent = { ...live.current };
    try { await save(note.id, sent); if (alive.current && !dirty.current) setState('saved'); }
    catch (e) { dirty.current = true; if (alive.current) setState('failed'); }
    busy.current = false;
    if (again.current && dirty.current) { again.current = false; flush(); }
  };
  const edit = patch => {
    live.current = { ...live.current, ...patch }; dirty.current = true; setState('saving');
    clearTimeout(timer.current); timer.current = setTimeout(flush, 700);
  };
  useEffect(() => { alive.current = true; if (isEmpty(note) && titleRef.current) titleRef.current.focus(); return () => { alive.current = false; clearTimeout(timer.current); if (dirty.current) flush(); }; }, []);
  useEffect(() => {            // a change made on another device shows here, unless you are in the middle of typing
    if (note.updated === seen.current) return;
    seen.current = note.updated;
    if (!dirty.current && !busy.current && (note.title !== live.current.title || note.body !== live.current.body)) { live.current = { title: note.title, body: note.body }; setTitle(note.title); setBody(note.body); }
  }, [note.updated]);
  useEffect(() => {            // leaving the tab or closing the page: send what is typed
    const out = () => { if (dirty.current) flush(); };
    window.addEventListener('pagehide', out); document.addEventListener('visibilitychange', out);
    return () => { window.removeEventListener('pagehide', out); document.removeEventListener('visibilitychange', out); };
  }, []);

  const status = state === 'saving' ? 'Saving…' : state === 'failed' ? null : 'Saved';
  return html`<section className="nt-ed" aria-label="Note">
    <div className="nt-bar">
      <button type="button" className="btn ghost sm nt-back" onClick=${() => { flush(); onBack(); }}><${Icon} n="back" s=${16}/> Notes</button>
      <span className=${'nt-st' + (state === 'failed' ? ' err' : '')} role="status">${state === 'failed' ? html`Not saved. <button type="button" className="nt-retry" onClick=${flush}>Try again</button>` : status}</span>
      <span className="nt-sp"></span>
      <button type="button" className=${'btn ghost sm nt-pin' + (note.pinned ? ' on' : '')} aria-pressed=${note.pinned} title=${note.pinned ? 'Unpin' : 'Pin to the top'} onClick=${() => save(note.id, { pinned: !note.pinned }).catch(() => setState('failed'))}><${Icon} n="flag" s=${16}/><span className="nt-lb">${note.pinned ? 'Pinned' : 'Pin'}</span></button>
      <button type="button" className="btn ghost sm" title="Delete this note" aria-label="Delete this note" onClick=${onDelete}><${Icon} n="trash" s=${16}/><span className="nt-lb">Delete</span></button>
    </div>
    <input ref=${titleRef} className="nt-title" value=${title} maxLength=${TITLE_MAX} placeholder="Title" aria-label="Title" onChange=${ev => { setTitle(ev.target.value); edit({ title: ev.target.value }); }}/>
    <textarea className="nt-body" value=${body} maxLength=${BODY_MAX} placeholder="Start typing…" aria-label="Note" onChange=${ev => { setBody(ev.target.value); edit({ body: ev.target.value }); }}></textarea>
    <p className="nt-foot">Only you can see your notes. They are the same on every device you sign in on.${body.length > BODY_MAX - 1500 ? ' ' + (BODY_MAX - body.length) + ' characters left.' : ''}</p>
  </section>`;
}

export function Notes({ user }) {
  const { list, ready, error, add, save, remove, reload } = useNotes(user.n);
  const [sel, setSel] = useState(null), [q, setQ] = useState(''), [err, setErr] = useState(''), [onPage, setOnPage] = useState(false), [cfEl, ask] = useConfirm();
  const sorted = useMemo(() => [...list].sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated)), [list]);
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return s ? sorted.filter(x => (x.title + '\n' + x.body).toLowerCase().includes(s)) : sorted; }, [sorted, q]);
  const cur = list.find(x => x.id === sel) || null;
  // On a wide screen the newest note opens by itself. On a phone you start at the list.
  const wide = () => window.matchMedia && window.matchMedia('(min-width: 861px)').matches;
  useEffect(() => { if (ready && !cur && shown.length && wide()) setSel(shown[0].id); }, [ready, cur, shown.length]);
  useEffect(() => { if (sel && !list.some(x => x.id === sel)) { setSel(null); setOnPage(false); } }, [list, sel]);   // deleted on another device

  // Only an explicit delete may remove a note. The persisted list can still be
  // blank while the editor's asynchronous first save is pending.
  const pick = id => { setSel(id); setOnPage(true); setErr(''); };
  const create = async () => {
    setErr('');
    const blank = list.find(isEmpty); if (blank) { pick(blank.id); return; }
    try { const note = await add(); setQ(''); pick(note.id); } catch (e) { setErr(e.message); }
  };
  const del = async () => {
    if (!cur) return;
    const ok = await ask({ title: 'Delete this note?', icon: 'trash', danger: true, confirm: 'Delete note', quote: cur.title || preview(cur.body) || 'Untitled', body: 'This cannot be undone.' });
    if (!ok) return;
    try { await remove(cur.id); setSel(null); setOnPage(false); } catch (e) { setErr(e.message); }
  };

  return html`<div className="nt">
    <div className="pg-h"><div><h1><${HI} n="notes" tone="orange"/>My notes</h1><p>Private to you. Saved to your account, so they are the same on every device.</p></div></div>
    ${(error || err) && html`<p className="nt-err" role="alert">${err || error} ${error && !err && html`<button type="button" className="nt-retry" onClick=${reload}>Try again</button>`}</p>`}
    <div className=${'nt-grid' + (onPage ? ' on-page' : '')}>
      <aside className="nt-list" aria-label="Your notes">
        <div className="nt-top">
          <button type="button" className="btn pri nt-new" onClick=${create}><${Icon} n="plus" s=${16}/> New note</button>
          <input className="inp nt-q" type="search" value=${q} onChange=${ev => setQ(ev.target.value)} placeholder="Search notes" aria-label="Search notes"/>
        </div>
        <div className="nt-items">
          ${!ready ? html`<p className="nt-none">Loading…</p>`
            : shown.length === 0 ? html`<p className="nt-none">${q ? 'No notes match that search.' : 'No notes yet. Tap New note to start.'}</p>`
            : shown.map(x => html`<button type="button" key=${x.id} className=${'nt-item' + (cur && cur.id === x.id ? ' on' : '')} onClick=${() => pick(x.id)} aria-current=${cur && cur.id === x.id ? 'true' : undefined}>
                <span className="nt-t">${x.pinned && html`<span className="nt-pn" aria-label="Pinned"><${Icon} n="flag" s=${12}/></span>`}<b>${x.title.trim() || 'Untitled'}</b><time>${stamp(x.updated)}</time></span>
                <span className="nt-p">${preview(x.body) || 'No text'}</span>
              </button>`)}
        </div>
      </aside>
      <div className="nt-main">${cur ? html`<${Editor} key=${cur.id} note=${cur} save=${save} onDelete=${del} onBack=${() => setOnPage(false)}/>`
        : html`<div className="nt-empty"><${Icon} n="notes" s=${34}/><p>${list.length ? 'Pick a note to read it.' : 'Your notes will show up here.'}</p>${ready && !list.length && html`<button type="button" className="btn pri" onClick=${create}><${Icon} n="plus" s=${16}/> New note</button>`}</div>`}</div>
    </div>
    ${cfEl}
  </div>`;
}
