import { supabase } from './auth.js';
import { readAll } from './readAll.js';
import { BY } from './data.js';
import { dayKey } from './attendance.js';

/* The Kanban board and announcements, kept in Supabase and shared by everyone. */
const toTask = r => ({
  id: r.id, title: r.title, client: r.client || '', cols: r.cols || [], prev: r.prev && r.prev.length ? r.prev : undefined, prio: r.prio,
  due: r.due || '', labels: r.labels || [], by: r.by_emp || 0, done: r.done, desc: r.descr || '', subs: r.subs || [], comments: r.comments || [],
  time: r.time_log || [], created: Date.parse(r.created_at) || Date.now(), retainer: !!r.retainer || (r.cols || []).includes('retainer'), rcolor: r.retainer_color || ''
});
const toRow = t => ({
  title: t.title, client: t.client || '', cols: t.cols, prev: t.prev && t.prev.length ? t.prev : null, prio: t.prio, due: t.due || null,
  labels: t.labels || [], done: !!t.done, descr: t.desc || '', subs: t.subs || [], comments: t.comments || [], retainer: !!t.retainer, retainer_color: t.retainer && t.rcolor ? t.rcolor : null
});

export async function loadBoard() {
  await supabase.rpc('close_stale_timers_all').then(() => {}, () => {}); // timers left from an earlier day end at that day's shift end
  const rows = await readAll(() => supabase.from('tasks').select('*').order('created_at').order('id'), 'Could not load the board.');
  const archives = await readAll(() => supabase.from('task_time_archive').select('task_id, sessions').order('id'), 'Could not load timer history.');
  const history = new Map();
  archives.forEach(r => history.set(r.task_id, [...(history.get(r.task_id) || []), ...r.sessions]));
  rows.forEach(r => {
    if (!history.has(r.id)) return;
    // Archiving may commit between the task and archive reads. Prefer the
    // archived (closed) copy when the same session appears in both responses.
    const archived = history.get(r.id), ids = new Set(archived.map(s => s.id));
    r.time_log = [...archived, ...(r.time_log || []).filter(s => !ids.has(s.id))];
  });
  const b = await supabase.from('task_board').select('*').eq('id', 1).maybeSingle();
  if (b.error) throw new Error('Could not load the board.');
  const ord = (b.data && b.data.ord) || [], at = new Map(ord.map((id, i) => [id, i]));
  const tasks = rows.map(toTask).sort((x, y) => (at.has(x.id) ? at.get(x.id) : 1e9) - (at.has(y.id) ? at.get(y.id) : 1e9) || x.created - y.created);
  const lay = await supabase.from('board_layout').select('*').eq('id', 1).maybeSingle();
  if (lay.error) throw new Error('Could not load the board.');
  return { tasks, custom: (b.data && b.data.columns) || [], layout: { order: (lay.data && lay.data.col_order) || [], hidden: (lay.data && lay.data.hidden) || [] } };
}


const FIELDS = { title: 'title', client: 'client', cols: 'cols', prev: 'prev', prio: 'prio', due: 'due', labels: 'labels', done: 'done', desc: 'descr', retainer: 'retainer', rcolor: 'retainer_color' };
const fieldValue = (t, k) => k === 'prev' ? (t.prev && t.prev.length ? t.prev : null) : k === 'due' ? (t.due || null) : k === 'done' ? !!t.done : k === 'retainer' ? !!t.retainer : k === 'rcolor' ? (t.retainer && t.rcolor ? t.rcolor : null) : k === 'labels' ? (t.labels || []) : (t[k] == null ? '' : t[k]);
const changedFields = (a, b) => { const patch = {}; for (const k in FIELDS) if (JSON.stringify(fieldValue(a, k)) !== JSON.stringify(fieldValue(b, k))) patch[FIELDS[k]] = fieldValue(b, k); return patch; };
const listChanges = (a, b) => {
  const am = new Map(a.map(x => [x.id, x])), bm = new Map(b.map(x => [x.id, x])), out = [];
  b.forEach(x => { if (!am.has(x.id)) out.push(['add', x]); else if (JSON.stringify(am.get(x.id)) !== JSON.stringify(x)) out.push(['set', x]); });
  a.forEach(x => { if (!bm.has(x.id)) out.push(['remove', x]); });
  return out;
};

const denied = 'You can only change cards you created or are on.';
const creationAttempts = new Map(), listAttempts = new Map();
// The screens change the board in memory. This works out what changed and saves it.
export async function persistBoard(prev, next, opts = {}) {
  const before = new Map(prev.tasks.map(t => [t.id, t])), after = new Map(next.tasks.map(t => [t.id, t]));
  // Advance the acknowledged baseline after each successful request. A retry
  // diffs the latest edits against this baseline, including after partial saves.
  let progress = prev;
  const acknowledge = patch => { progress = { ...progress, ...patch }; opts.onProgress?.(progress); };
  const taskPatch = (id, patch) => acknowledge({ tasks: progress.tasks.map(t => t.id === id ? { ...t, ...patch } : t) });
  const run = async fn => {
    if (opts.isActive && !opts.isActive()) throw new Error('The account changed before saving finished.');
    await fn();
  };
  // An insert may have committed without an acknowledgement before the user
  // removed the new card locally. Include that identity in the deletion diff.
  for (const [key, original] of creationAttempts) {
    if (original.by !== opts.me || before.has(original.id) || after.has(original.id)) continue;
    await run(async () => {
      const saved = await supabase.from('tasks').select('id, by_emp').eq('id', original.id).maybeSingle();
      if (saved.error) throw new Error('Could not confirm the removed card. Try again.');
      if (saved.data && saved.data.by_emp === original.by) {
        const { error } = await supabase.rpc('delete_tasks', { p_ids: [original.id] });
        if (error) throw new Error('Could not delete that card. Try again.');
      }
      creationAttempts.delete(key);
    });
  }
  const added = next.tasks.filter(t => !before.has(t.id));
  for (const t of added) await run(async () => {
    const key = t.by + ':' + t.id;
    if (!creationAttempts.has(key)) creationAttempts.set(key, structuredClone({ ...t, time: [] }));
    const original = creationAttempts.get(key);
    const row = { id: t.id, by_emp: t.by, created_at: new Date(t.created).toISOString(), ...toRow(t) };
    const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error('Could not save the new card. Try again.');
    const saved = await supabase.from('tasks').select('*').eq('id',t.id).single();
    if (saved.error || saved.data.by_emp !== t.by) throw new Error('Could not confirm the new card. Refresh and try again.');
    // Checkpoint this writer's original intent. A later failure must not make
    // another writer's changes look like local edits that should be reversed.
    acknowledge({ tasks: [...progress.tasks, original] });
    before.set(t.id, original); // Only retry this user's newer edits, not other people's intervening changes.
    creationAttempts.delete(key);
  });
  for (const t of next.tasks) {
    const old = before.get(t.id);
    if (!old || (old === t && !['subs', 'comments'].some(kind => listAttempts.has(JSON.stringify([opts.me, t.id, kind]))))) continue;
    const patch = changedFields(old, t);
    if (Object.keys(patch).length) await run(async () => {
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', t.id).select('id');
      if (error) throw new Error(/assign cards/i.test(error.message) ? 'Only admins and project managers can give a card to someone else.' : 'Could not save that change. Try again.');
      if (!data.length) throw new Error(denied);
      taskPatch(t.id, Object.fromEntries(Object.entries(FIELDS).filter(([, col]) => col in patch).map(([key]) => [key, t[key]])));
    });
    const wasOpen = (old.time || []).filter(s => s.end == null), nowOpen = (t.time || []).filter(s => s.end == null);
    const stopped = wasOpen.filter(s => !nowOpen.some(x => x.id === s.id)), started = nowOpen.filter(s => !(old.time || []).some(x => x.id === s.id));
    const calls = [];
    if (stopped.length && t.done && !old.done) calls.push({ p_action: 'stop_all' });
    else [...new Set(stopped.map(s => s.emp))].forEach(emp => calls.push(emp === opts.me ? { p_action: 'stop' } : { p_action: 'stop', p_emp: emp }));
    if (started.length) calls.push({ p_action: 'start' });
    for (const c of calls) await run(async () => {
      const { error } = await supabase.rpc('task_timer', { p_task: t.id, ...c });
      if (error) throw new Error(/only change/i.test(error.message) ? denied : 'Could not save the timer. Try again.');
      const time = progress.tasks.find(x => x.id === t.id).time || [];
      taskPatch(t.id, { time: c.p_action === 'start' ? [...time, ...started] : time.map(s => {
        const end = stopped.find(x => x.id === s.id);
        return end && (c.p_action === 'stop_all' || s.emp === (c.p_emp ?? opts.me)) ? (t.time || []).find(x => x.id === s.id) || s : s;
      }) });
    });
    for (const kind of ['subs', 'comments']) {
      const key = JSON.stringify([opts.me, t.id, kind]);
      let baseline = old[kind] || [];
      const pending = listAttempts.get(key);
      if (pending) await run(async () => {
        // Read back an uncertain add before diffing newer edits or removals.
        // Keep our original intent as the baseline, not another editor's values.
        const { data, error } = await supabase.from('tasks').select(kind).eq('id', t.id).single();
        if (error) throw new Error('Could not confirm the last change. Try again.');
        if (data[kind].some(x => x.id === pending.id) && !baseline.some(x => x.id === pending.id)) {
          baseline = [...baseline, pending];
          taskPatch(t.id, { [kind]: baseline });
        }
        listAttempts.delete(key);
      });
      for (const [op, item] of listChanges(baseline, t[kind] || [])) await run(async () => {
        if (op === 'add') listAttempts.set(key, structuredClone(item));
        const { error } = await supabase.rpc('patch_task_list', { p_task: t.id, p_kind: kind, p_op: op, p_item: item });
        if (error) {
          // A database rejection is definite; only an uncertain transport failure
          // needs readback reconciliation on the next attempt.
          if (error.code) listAttempts.delete(key);
          throw new Error(/only change|only remove/i.test(error.message) ? denied : 'Could not save that change. Try again.');
        }
        if (op === 'add') listAttempts.delete(key);
        const list = progress.tasks.find(x => x.id === t.id)[kind] || [];
        taskPatch(t.id, { [kind]: op === 'add' ? [...list, item] : op === 'set' ? list.map(x => x.id === item.id ? item : x) : list.filter(x => x.id !== item.id) });
      });
    }
    // Reorder IDs only; the server preserves other users' content and additions.
    if (JSON.stringify((old.subs || []).map(s => s.id)) !== JSON.stringify((t.subs || []).map(s => s.id))) await run(async () => {
      const { error } = await supabase.rpc('reorder_task_subs', { p_task: t.id, p_ids: (t.subs || []).map(s => String(s.id)) });
      if (error) throw new Error('Could not save the subtask order. Try again.');
      taskPatch(t.id, { subs: t.subs || [] });
    });
  }
  const ids = next.tasks.map(t => t.id), same = ids.length === prev.tasks.length && prev.tasks.every((t, i) => t.id === ids[i]);
  const cust = JSON.stringify(next.custom) !== JSON.stringify(prev.custom);
  if ((!same || cust) && opts.mgr !== false) await run(async () => {
    const patch = {}; if (!same) patch.ord = ids; if (cust) patch.columns = next.custom;
    const { data, error } = await supabase.from('task_board').update(patch).eq('id', 1).select('id');
    if (error || !data.length) throw new Error('Could not save the board layout. Try again.');
    const at = new Map(ids.map((id, i) => [id, i]));
    acknowledge({ tasks: [...progress.tasks].sort((a, b) => (at.get(a.id) ?? ids.length) - (at.get(b.id) ?? ids.length)), custom: cust ? next.custom : progress.custom });
  });
  const nextLayout = next.layout || prev.layout;
  if (opts.mgr !== false && nextLayout && JSON.stringify(nextLayout) !== JSON.stringify(prev.layout)) await run(async () => {
    const { data, error } = await supabase.from('board_layout').update({ col_order: nextLayout.order, hidden: nextLayout.hidden }).eq('id', 1).select('id');
    if (error || !data.length) throw new Error('Only admins and project managers can change which columns show, or their order.');
    acknowledge({ layout: nextLayout });
  });
  const gone = prev.tasks.filter(t => !after.has(t.id)).map(t => t.id);
  if (gone.length) await run(async () => {
    const { error } = await supabase.rpc('delete_tasks', { p_ids: gone });
    if (error) throw new Error(/Only admins/.test(error.message) ? denied : 'Could not delete that card. Try again.');
    acknowledge({ tasks: progress.tasks.filter(t => !gone.includes(t.id)) });
  });
}

export async function loadAnnouncements() {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Could not load announcements.');
  return data.map(r => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, date: dayKey(Date.parse(r.created_at)), by: (BY[r.by_emp] || {}).name || 'People and Ops', byId: r.by_emp || 0 }));
}
export async function persistAnnouncements(prev, next, me) {
  const before = new Set(prev.map(a => a.id)), after = new Set(next.map(a => a.id));
  for (const a of next) if (!before.has(a.id)) {
    const { error } = await supabase.from('announcements').upsert({ kind: a.kind, title: a.title, body: a.body || '', by_emp: me, client_key: String(a.id) }, { onConflict: 'by_emp,client_key', ignoreDuplicates: true });
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
