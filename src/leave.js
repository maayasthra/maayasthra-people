import { supabase } from './auth.js';
import { HOL, POLICY } from './data.js';

/* Leave requests, holidays and leave rules, kept in Supabase. */
const mapReq = r => ({ id: r.id, emp: r.employee_id, type: r.type, from: r.from_date, to: r.to_date, days: Number(r.days), half: r.half, reason: r.reason || '', state: r.state });

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
      if (error) throw new Error('Could not send that request. Try again.');
    } else if (old.state !== l.state) {
      const { error } = await supabase.from('leave_requests').update({ state: l.state }).eq('id', l.id);
      if (error) throw new Error('Could not save that decision. Try again.');
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
  const { error } = await supabase.from('holidays').delete().eq('day', day);
  if (error) throw new Error('Could not remove the holiday.');
}
export async function savePolicy() {
  const { error } = await supabase.from('leave_policy').update({ allow: POLICY.allow, notice: POLICY.notice, half: POLICY.half, note: POLICY.note }).eq('id', 1);
  if (error) throw new Error('Could not save the leave rules.');
}
