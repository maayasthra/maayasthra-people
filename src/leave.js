import { supabase } from './auth.js';
import { HOL, POLICY, BY } from './data.js';

/* Leave requests, holidays and leave rules, kept in Supabase. */
// Messages from the database's own leave rules are clear enough to show as they are.
const RULE = /start date|weekends or holidays|half day|does not match|short note|notice|already have leave|not enough|Half days/i;
const mapReq = r => ({ id: r.id, emp: r.employee_id, type: r.type, from: r.from_date, to: r.to_date, days: Number(r.days), half: r.half, reason: r.reason || '', state: r.state, by: r.decided_by ? ((BY[r.decided_by] || {}).name || 'An admin') : '', byId: r.decided_by || 0, at: r.decided_at ? Date.parse(r.decided_at) : 0 });

// Holidays and rules go into the shared HOL and POLICY objects the screens already read.
export async function loadLeaveConfig() {
  const [h, p] = await Promise.all([supabase.from('holidays').select('day, name'), supabase.from('leave_policy').select('*').eq('id', 1).maybeSingle()]);
  if (h.error || p.error) throw new Error('Could not load holidays and leave rules.');
  Object.keys(HOL).forEach(k => delete HOL[k]);
  h.data.forEach(r => { HOL[r.day] = r.name; });
  if (p.data) Object.assign(POLICY, { allow: p.data.allow, notice: p.data.notice, half: p.data.half, note: p.data.note });
}

// Own requests (everyone's for admins), plus who else is away. Away rows carry no reason.
export async function loadLeaves() {
  const [a, b] = await Promise.all([
    supabase.from('leave_requests').select('*').neq('state', 'cancelled').order('from_date', { ascending: false }),
    supabase.from('leave_away').select('*')
  ]);
  if (a.error || b.error) throw new Error('Could not load leave.');
  const reqs = a.data.map(mapReq), have = new Set(reqs.map(l => l.id));
  const away = b.data.filter(r => !have.has(r.id)).map(r => mapReq({ ...r, reason: '', state: 'approved' }));
  return [...reqs, ...away];
}

// The screens change the list in memory. This works out what changed and saves it.
export async function persistLeaves(prev, next) {
  const before = new Map(prev.map(l => [l.id, l])), after = new Map(next.map(l => [l.id, l]));
  for (const l of next) {
    const old = before.get(l.id);
    if (!old) {
      const { error } = await supabase.from('leave_requests').insert({ employee_id: l.emp, type: l.type, from_date: l.from, to_date: l.to, days: l.days, half: !!l.half, reason: l.reason || '' });
      if (error) throw new Error(RULE.test(error.message) ? error.message : 'Could not send that request. Try again.');
    } else if (old.state !== l.state) {
      const { data, error } = await supabase.from('leave_requests').update({ state: l.state }).eq('id', l.id).select('id');
      if (error) throw new Error('Could not save that decision. Try again.');
      if (!data.length) throw new Error('You cannot decide this request.');
    }
  }
  for (const l of prev) {
    if (after.has(l.id)) continue;
    const { error } = await supabase.rpc('cancel_leave', { p_id: l.id });
    if (error) throw new Error('Could not cancel that request. Try again.');
  }
}

export async function saveHoliday(day, name) {
  const { error } = await supabase.from('holidays').upsert({ day, name });
  if (error) throw new Error('Could not save the holiday.');
}
export async function deleteHoliday(day) {
  const { data, error } = await supabase.from('holidays').delete().eq('day', day).select('day');
  if (error || !data.length) throw new Error('Could not remove the holiday.');
}
export async function savePolicy() {
  const { data, error } = await supabase.from('leave_policy').update({ allow: POLICY.allow, notice: POLICY.notice, half: POLICY.half, note: POLICY.note }).eq('id', 1).select('id');
  if (error || !data.length) throw new Error('Could not save the leave rules. Only admins can change them.');
}
