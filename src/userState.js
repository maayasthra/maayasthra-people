import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';

/* Small per-person settings kept in the database so they follow someone to a new device:
   whether the tour was seen, and which tasks they have already been told about. In demo mode they stay in this browser. */
const LOCAL = n => 'mp-state-' + n;
const readLocal = n => { try { return JSON.parse(localStorage.getItem(LOCAL(n)) || 'null'); } catch (x) { return null; } };
const writeLocal = (n, v) => { try { localStorage.setItem(LOCAL(n), JSON.stringify(v)); } catch (x) { /* ignore */ } };

// { tourDone: bool, seenTasks: string[] | null, prefs: { collapsed?, view? } }
export async function loadUserState(n) {
  if (IS_DEMO) { const l = readLocal(n) || {}; return { tourDone: !!l.tourDone, seenTasks: Array.isArray(l.seenTasks) ? l.seenTasks : null, prefs: l.prefs && typeof l.prefs === 'object' ? l.prefs : {} }; }
  const { data, error } = await supabase.from('user_state').select('tour_done, seen_tasks, prefs').maybeSingle();
  if (error) throw new Error('state');
  return { tourDone: !!(data && data.tour_done), seenTasks: data && Array.isArray(data.seen_tasks) ? data.seen_tasks : null, prefs: data && data.prefs && typeof data.prefs === 'object' ? data.prefs : {} };
}

// patch: { tourDone?, seenTasks?, prefs? }
export async function saveUserState(n, patch) {
  if (IS_DEMO) { writeLocal(n, { ...(readLocal(n) || {}), ...patch }); return; }
  const row = { employee_id: n, updated_at: new Date().toISOString() };
  if ('tourDone' in patch) row.tour_done = !!patch.tourDone;
  if ('seenTasks' in patch) row.seen_tasks = patch.seenTasks;
  if ('prefs' in patch) row.prefs = patch.prefs;
  const { error } = await supabase.from('user_state').upsert(row, { onConflict: 'employee_id' });
  if (error) throw new Error('state');
}
