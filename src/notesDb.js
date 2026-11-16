import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';
import { subscribeTables } from './tasksDb.js';

/* Each person's private notes. They live in the database under the person's own account (the database lets nobody else see them),
   so they are the same on every device and update live. In demo mode they are kept in this browser. */
const LK = n => 'mp-notes-' + n;
const loadLocal = n => { try { const v = JSON.parse(localStorage.getItem(LK(n)) || '[]'); return Array.isArray(v) ? v : []; } catch (x) { return []; } };
const saveLocal = (n, l) => { try { localStorage.setItem(LK(n), JSON.stringify(l)); } catch (x) { /* ignore */ } };
const COLS = 'id, title, body, pinned, updated_at';
const toApp = r => ({ id: String(r.id), title: r.title || '', body: r.body || '', pinned: !!r.pinned, updated: new Date(r.updated_at).getTime() });

export const TITLE_MAX = 200, BODY_MAX = 20000;

export function useNotes(n) {
  const [list, setList] = useState([]), [ready, setReady] = useState(false), [error, setError] = useState('');
  const cur = useRef(n); cur.current = n;

  const reload = useCallback(async () => {
    if (IS_DEMO || !n) return;
    const { data, error: e } = await supabase.from('notes').select(COLS).order('updated_at', { ascending: false }).limit(500);
    if (cur.current !== n) return;
    if (e) setError('Could not load your notes. Check your connection.'); else { setError(''); setList(data.map(toApp)); }
    setReady(true);
  }, [n]);

  useEffect(() => {
    setList([]); setReady(false); setError('');
    if (!n) return;
    if (IS_DEMO) { setList(loadLocal(n)); setReady(true); return; }
    reload();
    const off = subscribeTables('mp-notes-' + n, ['notes'], reload);
    const seen = () => { if (!document.hidden) reload(); };          // catch up when the tab comes back
    document.addEventListener('visibilitychange', seen); window.addEventListener('online', reload);
    return () => { off(); document.removeEventListener('visibilitychange', seen); window.removeEventListener('online', reload); };
  }, [n, reload]);

  const keep = fn => setList(l => { const next = fn(l); if (IS_DEMO) saveLocal(n, next); return next; });

  const add = async () => {
    if (IS_DEMO) { const note = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', body: '', pinned: false, updated: Date.now() }; keep(l => [note, ...l]); return note; }
    const { data, error: e } = await supabase.from('notes').insert({ employee_id: n, title: '', body: '' }).select(COLS).single();
    if (e) throw new Error(/limit/i.test(e.message || '') ? e.message : 'Could not create the note.');
    const note = toApp(data); keep(l => [note, ...l.filter(x => x.id !== note.id)]); return note;
  };
  // patch: any of { title, body, pinned }
  const save = async (id, patch) => {
    const updated = Date.now();
    if (!IS_DEMO) {
      const row = { updated_at: new Date(updated).toISOString() };
      ['title', 'body', 'pinned'].forEach(k => { if (k in patch) row[k] = patch[k]; });
      const { error: e } = await supabase.from('notes').update(row).eq('id', id);
      if (e) throw new Error('Could not save. Check your connection.');
    }
    keep(l => l.map(x => x.id === id ? { ...x, ...patch, updated } : x));
  };
  const remove = async id => {
    if (!IS_DEMO) { const { error: e } = await supabase.from('notes').delete().eq('id', id); if (e) throw new Error('Could not delete the note.'); }
    keep(l => l.filter(x => x.id !== id));
  };
  return { list, ready, error, add, save, remove, reload };
}
