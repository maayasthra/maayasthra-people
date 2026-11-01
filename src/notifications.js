import { useState, useEffect, useCallback } from 'react';

/* The notification list behind the bell: new tasks and end-of-day reminders.
   It is kept in this browser, per person, and holds the latest 40. */
const key = n => 'mp-notif-' + n;
const load = n => { try { const v = JSON.parse(localStorage.getItem(key(n)) || '[]'); return Array.isArray(v) ? v : []; } catch (x) { return []; } };
const save = (n, l) => { try { localStorage.setItem(key(n), JSON.stringify(l.slice(0, 40))); } catch (x) { /* kept for this visit only */ } };

export function useNotifications(n) {
  const [list, setList] = useState(() => n ? load(n) : []);
  useEffect(() => { setList(n ? load(n) : []); }, [n]);
  const commit = useCallback(fn => setList(prev => { const next = fn(prev); if (n) save(n, next); return next; }), [n]);
  // add: [{ id, kind, title, body, ref }]. An id that is already there is not added twice.
  const add = useCallback(items => commit(prev => {
    const fresh = items.filter(i => !prev.some(p => p.id === i.id)).map(i => ({ ...i, at: Date.now(), read: false }));
    return fresh.length ? [...fresh, ...prev] : prev;
  }), [commit]);
  const markRead = useCallback(id => commit(prev => prev.map(p => p.id === id ? { ...p, read: true } : p)), [commit]);
  const markAll = useCallback(() => commit(prev => prev.map(p => ({ ...p, read: true }))), [commit]);
  const clearKind = useCallback(kind => commit(prev => prev.filter(p => p.kind !== kind)), [commit]);
  const clearAll = useCallback(() => commit(() => []), [commit]);
  return { list, unread: list.filter(p => !p.read).length, add, markRead, markAll, clearKind, clearAll };
}
