import { supabase } from './auth.js';
import { BY } from './data.js';
import { dayKey } from './attendance.js';

/* The Kanban board and announcements, kept in Supabase and shared by everyone. */
const PAGE = 1000;
const toTask = r => ({
  id: r.id, title: r.title, client: r.client || '', cols: r.cols || [], prev: r.prev && r.prev.length ? r.prev : undefined, prio: r.prio,
  due: r.due || '', labels: r.labels || [], by: r.by_emp || 0, done: r.done, desc: r.descr || '', subs: r.subs || [], comments: r.comments || [],
  time: r.time_log || [], created: Date.parse(r.created_at) || Date.now()
});
const toRow = t => ({
  title: t.title, client: t.client || '', cols: t.cols, prev: t.prev && t.prev.length ? t.prev : null, prio: t.prio, due: t.due || null,
  labels: t.labels || [], done: !!t.done, descr: t.desc || '', subs: t.subs || [], comments: t.comments || []
});

export async function loadBoard() {
  await supabase.rpc('close_stale_timers_all').then(() => {}, () => {}); // timers left from an earlier day end at that day's shift end
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at').order('id').range(start, start + PAGE - 1);
    if (error) throw new Error('Could not load the board.');
    rows.push(...data); if (data.length < PAGE) break;
  }
  const b = await supabase.from('task_board').select('*').eq('id', 1).maybeSingle();
  if (b.error) throw new Error('Could not load the board.');
  const ord = (b.data && b.data.ord) || [], at = new Map(ord.map((id, i) => [id, i]));
  const tasks = rows.map(toTask).sort((x, y) => (at.has(x.id) ? at.get(x.id) : 1e9) - (at.has(y.id) ? at.get(y.id) : 1e9) || x.created - y.created);
  const lay = await supabase.from('board_layout').select('*').eq('id', 1).maybeSingle();
  if (lay.error) throw new Error('Could not load the board.');
  return { tasks, custom: (b.data && b.data.columns) || [], layout: { order: (lay.data && lay.data.col_order) || [], hidden: (lay.data && lay.data.hidden) || [] } };
}


const FIELDS = { title: 'title', client: 'client', cols: 'cols', prev: 'prev', prio: 'prio', due: 'due', labels: 'labels', done: 'done', desc: 'descr' };
const fieldValue = (t, k) => k === 'prev' ? (t.prev && t.prev.length ? t.prev : null) : k === 'due' ? (t.due || null) : k === 'done' ? !!t.done : k === 'labels' ? (t.labels || []) : (t[k] == null ? '' : t[k]);
const changedFields = (a, b) => { const patch = {}; for (const k in FIELDS) if (JSON.stringify(fieldValue(a, k)) !== JSON.stringify(fieldValue(b, k))) patch[FIELDS[k]] = fieldValue(b, k); return patch; };
const listChanges = (a, b) => {
  const am = new Map(a.map(x => [x.id, x])), bm = new Map(b.map(x => [x.id, x])), out = [];
  b.forEach(x => { if (!am.has(x.id)) out.push(['add', x]); else if (JSON.stringify(am.get(x.id)) !== JSON.stringify(x)) out.push(['set', x]); });
  a.forEach(x => { if (!bm.has(x.id)) out.push(['remove', x]); });
  return out;
};

const denied = 'You can only change cards you created or are on.';
// The screens change the board in memory. This works out what changed and saves it.
export async function persistBoard(prev, next, opts = {}) {
  const before = new Map(prev.tasks.map(t => [t.id, t])), after = new Map(next.tasks.map(t => [t.id, t]));
  const added = next.tasks.filter(t => !before.has(t.id));
  if (added.length) {
    const { error } = await supabase.from('tasks').insert(added.map(t => ({ id: t.id, by_emp: t.by, created_at: new Date(t.created).toISOString(), ...toRow(t) })));
    if (error) throw new Error('Could not save the new card. Try again.');
    // A card started right after it was created
    for (const t of added) if ((t.time || []).some(x => x.end == null)) { const r = await supabase.rpc('task_timer', { p_task: t.id, p_action: 'start' }); if (r.error) throw new Error('Could not save the timer. Try again.'); }
  }
  for (const t of next.tasks) {
    const old = before.get(t.id);
    if (!old || old === t) continue;
    // Only the fields that changed are sent, so two people editing different parts of a card never undo each other.
    const patch = changedFields(old, t);
    if (Object.keys(patch).length) {
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', t.id).select('id');
      if (error) throw new Error(/assign cards/i.test(error.message) ? 'Only admins and project managers can give a card to someone else.' : 'Could not save that change. Try again.');
      if (!data.length) throw new Error(denied);
    }
    // Timers: the server stamps the start and stop times
    const wasOpen = (old.time || []).filter(s => s.end == null), nowOpen = (t.time || []).filter(s => s.end == null);
    const stopped = wasOpen.filter(s => !nowOpen.some(x => x.id === s.id)), started = nowOpen.filter(s => !(old.time || []).some(x => x.id === s.id));
    const calls = [];
    if (stopped.length && t.done && !old.done) calls.push({ p_action: 'stop_all' });
    else [...new Set(stopped.map(s => s.emp))].forEach(emp => calls.push(emp === opts.me ? { p_action: 'stop' } : { p_action: 'stop', p_emp: emp }));
    if (started.length) calls.push({ p_action: 'start' });
    for (const c of calls) {
      const { error } = await supabase.rpc('task_timer', { p_task: t.id, ...c });
      if (error) throw new Error(/only change/i.test(error.message) ? denied : 'Could not save the timer. Try again.');
    }
    // Subtasks and comments are changed one item at a time on the server.
    for (const kind of ['subs', 'comments']) {
      for (const [op, item] of listChanges(old[kind] || [], t[kind] || [])) {
        const { error } = await supabase.rpc('patch_task_list', { p_task: t.id, p_kind: kind, p_op: op, p_item: item });
        if (error) throw new Error(/only change|only remove/i.test(error.message) ? denied : 'Could not save that change. Try again.');
      }
    }
  }
  const ids = next.tasks.map(t => t.id), same = ids.length === prev.tasks.length && prev.tasks.every((t, i) => t.id === ids[i]);
  const cust = JSON.stringify(next.custom) !== JSON.stringify(prev.custom);
  if ((!same || cust) && opts.mgr !== false) {
    const patch = {}; if (!same) patch.ord = ids; if (cust) patch.columns = next.custom;
    const { data, error } = await supabase.from('task_board').update(patch).eq('id', 1).select('id');
    if (error || !data.length) throw new Error('Could not save the board layout. Try again.');
  }
  // Column order and hidden columns: admins only
  const nextLayout = next.layout || prev.layout;
  if (opts.mgr !== false && nextLayout && JSON.stringify(nextLayout) !== JSON.stringify(prev.layout)) {
    const { data, error } = await supabase.from('board_layout').update({ col_order: nextLayout.order, hidden: nextLayout.hidden }).eq('id', 1).select('id');
    if (error || !data.length) throw new Error('Only admins can change which columns show, or their order.');
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
    const { data, error } = await supabase.from('announcements').delete().in('id', gone).select('id');
    if (error || data.length < gone.length) throw new Error('Could not remove that announcement. Only admins can.');
  }
}

// Other people's changes arrive as they happen.
export function subscribeTables(name, tables, onChange) {
  const ch = supabase.channel(name);
  tables.forEach(table => ch.on('postgres_changes', { event: '*', schema: 'public', table }, onChange));
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}
export const subscribeBoard = onChange => subscribeTables('mp-board', ['tasks', 'task_board', 'announcements', 'board_layout'], onChange);
