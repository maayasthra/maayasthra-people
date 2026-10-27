import { supabase } from './auth.js';
import { BY } from './data.js';
import { dayKey, addDays, toTs } from './attendance.js';

/* Check-ins kept in Supabase. The app still reads att = { [employeeNumber]: { [day]: { sessions, edited? } } }. */
const PAGE = 1000;

export async function loadAttendance(days = 120) {
  const from = addDays(dayKey(), -days), today = dayKey(), att = {};
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase.from('attendance_days').select('*').gte('day', from).order('day').order('employee_id').range(start, start + PAGE - 1);
    if (error) throw new Error('Could not load attendance.');
    data.forEach(r => {
      const e = BY[r.employee_id]; let sessions = r.sessions || [];
      // A check-in left open on an earlier day counts until that person's shift end.
      if (r.day < today && sessions.length && sessions[sessions.length - 1].out == null) {
        const last = sessions[sessions.length - 1], end = e ? toTs(r.day, e.shiftEnd) : last.in;
        sessions = sessions.map((s, i) => i === sessions.length - 1 ? { ...s, out: Math.max(end, last.in) } : s);
      }
      const rec = { sessions };
      if (r.edited_by) rec.edited = { by: (BY[r.edited_by] || {}).name || 'An admin', at: Date.parse(r.edited_at) || 0 };
      (att[r.employee_id] = att[r.employee_id] || {})[r.day] = rec;
    });
    if (data.length < PAGE) break;
  }
  return att;
}

// Put freshly loaded days on top of what is in memory.
export const mergeAtt = (prev, fresh) => {
  const out = { ...prev };
  Object.keys(fresh).forEach(n => { out[n] = { ...(out[n] || {}), ...fresh[n] }; });
  return out;
};

const KNOWN = /EOD report|out of date|working hours have ended|already checked in|not checked in|not valid|another admin|cannot be before|future day/i;
const fail = (error, fallback) => { throw new Error(KNOWN.test(error.message) ? error.message : fallback); };

// The screens change att in memory. This works out what happened and saves it.
export async function persistAtt(prev, next) {
  for (const n of Object.keys(next)) {
    for (const iso of Object.keys(next[n])) {
      const nv = next[n][iso], ov = prev[n] && prev[n][iso];
      if (nv === ov) continue;
      const os = ov ? ov.sessions : [], ns = nv.sessions;
      if (nv.edited && (!ov || ov.edited !== nv.edited)) {
        const { error } = await supabase.rpc('admin_set_day', { p_employee: Number(n), p_day: iso, p_sessions: ns });
        if (error) fail(error, 'Could not save those hours. Try again.');
      } else if (ns.length === os.length + 1) {
        const { error } = await supabase.rpc('check_in', { p_loc: ns[ns.length - 1].loc || 'office' });
        if (error) fail(error, 'Could not check you in. Try again.');
      } else if (ns.length && ns.length === os.length && os[os.length - 1].out == null && ns[ns.length - 1].out != null) {
        const { error } = await supabase.rpc('check_out', { p_at: ns[ns.length - 1].out });
        if (error) fail(error, 'Could not check you out. Try again.');
      }
    }
  }
}
