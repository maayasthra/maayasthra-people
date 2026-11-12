import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';
import { subscribeTables } from './tasksDb.js';

/* The notification list behind the bell: new tasks and end-of-day reminders, the latest 40 for each person.
   It lives in the database, so it is the same on every device. In demo mode it is kept in this browser. */
const LK = n => 'mp-notif-' + n;
const loadLocal = n => { try { const v = JSON.parse(localStorage.getItem(LK(n)) || '[]'); return Array.isArray(v) ? v : []; } catch (x) { return []; } };
const saveLocal = (n, l) => { try { localStorage.setItem(LK(n), JSON.stringify(l.slice(0, 40))); } catch (x) { /* ignore */ } };
const toApp = r => ({ id: r.key, kind: r.kind, title: r.title, body: r.body, ref: r.ref, read: r.read, at: new Date(r.created_at).getTime() });

export function useNotifications(n) {
  const account = useRef({ n, token: {} });
  if (account.current.n !== n) account.current = { n, token: {} };
  const token = account.current.token;
  const [state, setState] = useState(() => ({ token, list: n && IS_DEMO ? loadLocal(n) : [] }));
  const list = state.token === token ? state.list : [];
  const setList = useCallback(value => {
    if (account.current.token !== token) return;
    setState(prev => {
      if (account.current.token !== token) return prev;
      return { token, list: typeof value === 'function' ? value(prev.token === token ? prev.list : []) : value };
    });
  }, [token]);
  const ref = useRef(list); ref.current = list;

  const reload = useCallback(async () => {
    if (IS_DEMO || !n || account.current.token !== token) return;
    const { data, error } = await supabase.from('notifications').select('key, kind, title, body, ref, read, created_at').order('created_at', { ascending: false }).limit(40);
    if (!error && data) setList(data.map(toApp));
  }, [n, setList, token]);

  useEffect(() => {
    if (!n) { setList([]); return; }
    if (IS_DEMO) { setList(loadLocal(n)); return; }
    setList([]); reload();
    return subscribeTables('mp-notif-' + n, ['notifications'], reload);
  }, [n, setList, token]);

  // Change the list on screen at once; in demo mode keep it in this browser
  const local = useCallback(fn => setList(prev => { const next = fn(prev); if (IS_DEMO && n) saveLocal(n, next); return next; }), [n, setList]);

  const add = useCallback(items => {
    const fresh = items.filter(i => !ref.current.some(p => p.id === i.id)).map(i => ({ ...i, at: Date.now(), read: false }));
    if (!fresh.length) return;
    local(prev => [...fresh, ...prev].slice(0, 40));
    if (!IS_DEMO && n) supabase.from('notifications').upsert(fresh.map(i => ({ employee_id: n, key: i.id, kind: i.kind, title: i.title.slice(0, 200), body: (i.body || '').slice(0, 500), ref: String(i.ref || '') })), { onConflict: 'employee_id,key', ignoreDuplicates: true }).then(reload, reload);
  }, [local, n, reload]);
  const markRead = useCallback(id => { local(prev => prev.map(p => p.id === id ? { ...p, read: true } : p)); if (!IS_DEMO && n) supabase.from('notifications').update({ read: true }).eq('employee_id', n).eq('key', id).then(() => {}); }, [local, n]);
  const markAll = useCallback(() => { local(prev => prev.map(p => ({ ...p, read: true }))); if (!IS_DEMO && n) supabase.from('notifications').update({ read: true }).eq('employee_id', n).eq('read', false).then(() => {}); }, [local, n]);
  const clearKind = useCallback(kind => { local(prev => prev.filter(p => p.kind !== kind)); if (!IS_DEMO && n) supabase.from('notifications').delete().eq('employee_id', n).eq('kind', kind).then(() => {}); }, [local, n]);
  const clearAll = useCallback(() => { local(() => []); if (!IS_DEMO && n) supabase.from('notifications').delete().eq('employee_id', n).then(() => {}); }, [local, n]);
  const has = useCallback(id => ref.current.some(p => p.id === id), []);
  return { list, unread: list.filter(p => !p.read).length, add, markRead, markAll, clearKind, clearAll, has };
}
