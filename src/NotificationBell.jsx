import { useState, useEffect, useRef } from 'react';
import { html, Icon } from './ui.jsx';

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const ICON = { task: 'board', eod: 'eod' };
const TONE = { task: '#0A84FF', eod: '#FF9F0A' };

// The bell in the top bar: a list of new tasks and reminders, with a count of what has not been seen
export function NotificationBell({ notif, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const f = ev => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    const k = ev => { if (ev.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const { list, unread } = notif;
  return html`<div className="nf" ref=${ref}>
    <button className=${'ib nf-b' + (unread ? ' has' : '')} onClick=${() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded=${open} aria-label=${unread ? 'Notifications, ' + unread + ' new' : 'Notifications'} title="Notifications">
      <${Icon} n="bell" s=${18}/>${unread > 0 && html`<span className="nf-n">${unread > 9 ? '9+' : unread}</span>`}</button>
    ${open && html`<div className="nf-p" role="dialog" aria-label="Notifications">
      <div className="nf-h"><b>Notifications</b>${unread > 0 ? html`<button className="link" onClick=${notif.markAll}>Mark all as read</button>` : list.length > 0 ? html`<button className="link" onClick=${notif.clearAll}>Clear</button>` : null}</div>
      <div className="nf-l">${list.length === 0 ? html`<div className="nf-e"><span><${Icon} n="bell" s=${22}/></span><b>You are all caught up</b><small>New tasks and reminders show up here.</small></div>`
        : list.map(i => html`<button key=${i.id} className=${'nf-i' + (i.read ? '' : ' un')} onClick=${() => { notif.markRead(i.id); setOpen(false); onOpen(i); }}>
          <span className="nf-ic" style=${{ '--c': TONE[i.kind] || '#8E8E93' }}><${Icon} n=${ICON[i.kind] || 'bell'} s=${16}/></span>
          <span className="nf-t"><b>${i.title}</b>${i.body && html`<small>${i.body}</small>`}<em>${ago(i.at)}</em></span>
          ${!i.read && html`<i className="nf-d" aria-label="New"></i>`}</button>`)}</div>
    </div>`}
  </div>`;
}
