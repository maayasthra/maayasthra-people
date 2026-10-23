import { supabase } from './auth.js';
import { BY } from './data.js';
import { dayKey } from './attendance.js';

/* The Kanban board and announcements, kept in Supabase and shared by everyone. */
const PAGE = 1000;
const toTask = r => ({
  id: r.id, title: r.title, client: r.client || '', cols: r.cols || [], prev: r.prev && r.prev.length ? r.prev : undefined, prio: r.prio,
  due: r.due || '', labels: r.labels || [], by: r.by_emp || 0, done: r.done, desc: r.descr || '', subs: r.subs || [], comments: r.comments || [],
  created: Date.parse(r.created_at) || Date.now()
});
const toRow = t => ({
  title: t.title, client: t.client || '', cols: t.cols, prev: t.prev && t.prev.length ? t.prev : null, prio: t.prio, due: t.due || null,
  labels: t.labels || [], done: !!t.done, descr: t.desc || '', subs: t.subs || [], comments: t.comments || []
});

export async function loadBoard() {
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at').range(start, start + PAGE - 1);
    if (error) throw new Error('Could not load the board.');
    rows.push(...data); if (data.length < PAGE) break;
  }
  const b = await supabase.from('task_board').select('*').eq('id', 1).maybeSingle();
  if (b.error) throw new Error('Could not load the board.');
  const ord = (b.data && b.data.ord) || [], at = new Map(ord.map((id, i) => [id, i]));
  const tasks = rows.map(toTask).sort((x, y) => (at.has(x.id) ? at.get(x.id) : 1e9) - (at.has(y.id) ? at.get(y.id) : 1e9) || x.created - y.created);
  return { tasks, custom: (b.data && b.data.columns) || [] };
}

const denied = 'You can only change cards you created or are on.';
// The screens change the board in memory. This works out what changed and saves it.
export async function persistBoard(prev, next) {
  const before = new Map(prev.tasks.map(t => [t.id, t])), after = new Map(next.tasks.map(t => [t.id, t]));
  const added = next.tasks.filter(t => !before.has(t.id));
  if (added.length) {
    const { error } = await supabase.from('tasks').insert(added.map(t => ({ id: t.id, by_emp: t.by, created_at: new Date(t.created).toISOString(), ...toRow(t) })));
    if (error) throw new Error('Could not save the new card. Try again.');
  }
  for (const t of next.tasks) {
    const old = before.get(t.id);
    if (!old || old === t) continue;
    const { data, error } = await supabase.from('tasks').update(toRow(t)).eq('id', t.id).select('id');
    if (error) throw new Error('Could not save that change. Try again.');
    if (!data.length) throw new Error(denied);
  }
  const ids = next.tasks.map(t => t.id), same = ids.length === prev.tasks.length && prev.tasks.every((t, i) => t.id === ids[i]);
  const cust = JSON.stringify(next.custom) !== JSON.stringify(prev.custom);
  if (!same || cust) {
    const patch = {}; if (!same) patch.ord = ids; if (cust) patch.columns = next.custom;
    const { error } = await supabase.from('task_board').update(patch).eq('id', 1);
    if (error) throw new Error('Could not save the board layout. Try again.');
  }
  const gone = prev.tasks.filter(t => !after.has(t.id)).map(t => t.id);
  if (gone.length) {
    const { data, error } = await supabase.from('tasks').delete().in('id', gone).select('id');
    if (error) throw new Error('Could not delete that card. Try again.');
    if (data.length < gone.length) throw new Error(denied);
  }
}

export async function loadAnnouncements() {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Could not load announcements.');
  return data.map(r => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, date: dayKey(Date.parse(r.created_at)), by: (BY[r.by_emp] || {}).name || 'People and Ops' }));
}
export async function persistAnnouncements(prev, next, me) {
  const before = new Set(prev.map(a => a.id)), after = new Set(next.map(a => a.id));
  for (const a of next) if (!before.has(a.id)) {
    const { error } = await supabase.from('announcements').insert({ kind: a.kind, title: a.title, body: a.body || '', by_emp: me });
    if (error) throw new Error('Could not post that announcement. Try again.');
  }
  const gone = prev.filter(a => !after.has(a.id)).map(a => a.id);
  if (gone.length) {
    const { error } = await supabase.from('announcements').delete().in('id', gone);
    if (error) throw new Error('Could not remove that announcement. Try again.');
  }
}

// Other people's changes arrive as they happen.
export function subscribeBoard(onChange) {
  const ch = supabase.channel('mp-board');
  ['tasks', 'task_board', 'announcements'].forEach(table => ch.on('postgres_changes', { event: '*', schema: 'public', table }, onChange));
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}
