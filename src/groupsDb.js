import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';

/* Board groups: { id, name, color, icon, members: [column keys], position }. Only admins change them. */
const KEY = 'mp-groups';
const demoRead = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (x) { return []; } };
const demoWrite = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (x) {} };
const toApp = r => ({ id: r.id, name: r.name || '', color: r.color || '#8E8E93', icon: r.icon || '', members: r.members || [], position: r.position || 0 });

export async function loadGroups() {
  if (IS_DEMO) return demoRead();
  const { data, error } = await supabase.from('board_groups').select('*').order('position').order('id');
  if (error) throw new Error('Could not load the board groups.');
  return data.map(toApp);
}

// Write what changed between two lists
export async function saveGroups(prev, next) {
  if (IS_DEMO) { demoWrite(next); return; }
  const gone = prev.filter(p => !next.some(n => n.id === p.id)).map(p => p.id);
  if (gone.length) { const { error } = await supabase.from('board_groups').delete().in('id', gone); if (error) throw new Error('Could not save the groups.'); }
  const rows = next.map((g, i) => ({ id: g.id, name: g.name, color: g.color, icon: g.icon, members: g.members, position: i }))
    .filter(r => { const p = prev.find(x => x.id === r.id); return !p || p.name !== r.name || p.color !== r.color || p.icon !== r.icon || p.position !== r.position || JSON.stringify(p.members) !== JSON.stringify(r.members); });
  if (rows.length) { const { error } = await supabase.from('board_groups').upsert(rows); if (error) throw new Error('Could not save the groups.'); }
}
