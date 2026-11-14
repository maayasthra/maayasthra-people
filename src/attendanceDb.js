import { supabase } from './auth.js';
import { readAll } from './readAll.js';
import { BY } from './data.js';
import { dayKey, addDays, toTs } from './attendance.js';

/* Check-ins kept in Supabase. The app still reads att = { [employeeNumber]: { [day]: { sessions, edited? } } }. */

export async function loadAttendance(days = 120) {
  const from = addDays(dayKey(), -days), today = dayKey(), att = {};
  const data = await readAll(() => supabase.from('attendance_days').select('*').gte('day', from).order('day').order('employee_id'), 'Could not load attendance.');
    data.forEach(r => {
      const e = BY[r.employee_id]; let sessions = r.sessions || [];
      // A check-in left open on an earlier day counts until that person's shift end.
      if (r.day < today && sessions.length && sessions[sessions.length - 1].out == null) {
        const last = sessions[sessions.length - 1], end = e ? toTs(r.day, e.shiftEnd) : last.in;
        sessions = sessions.map((s, i) => i === sessions.length - 1 ? { ...s, out: Math.max(end, last.in) } : s);
      }
      const away = (r.away || []).map(a => a.to == null && r.day < today && sessions.length ? { ...a, to: Math.max(sessions[sessions.length - 1].out || a.from, a.from) } : a);
      const rec = { sessions, away };
      if (r.early) rec.early = r.early;
      if (r.edited_by) rec.edited = { by: (BY[r.edited_by] || {}).name || 'An admin', at: Date.parse(r.edited_at) || 0 };
      (att[r.employee_id] = att[r.employee_id] || {})[r.day] = rec;
    });
  return att;
}

// Put freshly loaded days on top of what is in memory.
export const mergeAtt = (prev, fresh) => {
  const out = { ...prev };
  Object.keys(fresh).forEach(n => { out[n] = { ...(out[n] || {}), ...fresh[n] }; });
  return out;
};

const KNOWN = /Choose a reason|already away|not away|too long|Too many|no check-in|not valid|has not happened|overlaps|12 hours|today or yesterday|EOD report|out of date|working hours have ended|already checked in|not checked in|not valid|another admin|cannot be before|future day/i;
const fail = (error, fallback) => { throw new Error(KNOWN.test(error.message) ? error.message : fallback); };

// Reconcile a lost acknowledgement against the durable state, including the
// original session prefix so a different shift cannot be mistaken for this one.
const sameSessions = (a, b) => a.length === b.length && a.every((x, i) => ['in', 'out', 'loc'].every(k => x[k] === b[i][k]));
async function savedSessions(n, iso) {
  const r = await supabase.from('attendance_days').select('sessions').eq('employee_id', Number(n)).eq('day', iso).maybeSingle();
  return !r.error && r.data ? r.data.sessions : null;
}

// The screens change att in memory. This works out what happened and saves it.
export async function persistAtt(prev, next) {
  for (const n of Object.keys(next)) {
    for (const iso of Object.keys(next[n])) {
      const nv = next[n][iso], ov = prev[n] && prev[n][iso];
      if (nv === ov) continue;
      const os = ov ? ov.sessions : [], ns = nv.sessions;
      // Away time (step away, come back, add later, admin remove) and the leaving-early reason. Checking out closes an open away period by itself.
      const oa = (ov && ov.away) || [], na = nv.away || [], checkingOut = os.length > 0 && ns.length === os.length && os[os.length - 1].out == null && ns[ns.length - 1].out != null;
      if (!checkingOut && JSON.stringify(oa) !== JSON.stringify(na)) {
        let r = null;
        if (na.length === oa.length + 1) { const a = na[na.length - 1]; r = a.to == null ? await supabase.rpc('go_away', { p_why: a.why, p_note: a.note || null }) : await supabase.rpc('add_away', { p_day: iso, p_from: a.from, p_to: a.to, p_why: a.why, p_note: a.note || null }); }
        else if (na.length === oa.length && oa.some(a => a.to == null && na.some(b => b.from === a.from && b.to != null))) r = await supabase.rpc('come_back');
        else if (na.length === oa.length - 1) { const gone = oa.find(a => !na.some(b => b.from === a.from)); if (gone) r = await supabase.rpc('admin_remove_away', { p_employee: Number(n), p_day: iso, p_from: gone.from }); }
        if (r && r.error) fail(r.error, 'Could not save that. Try again.');
      }
      if (nv.early && (!ov || !ov.early || JSON.stringify(ov.early) !== JSON.stringify(nv.early))) {
        const { error } = await supabase.rpc('set_early_reason', { p_why: nv.early.why, p_note: nv.early.note || null });
        if (error) fail(error, 'Could not save that reason. Try again.');
      }
      if (nv.edited && (!ov || ov.edited !== nv.edited)) {
        const { error } = await supabase.rpc('admin_set_day', { p_employee: Number(n), p_day: iso, p_sessions: ns });
        if (error) fail(error, 'Could not save those hours. Try again.');
      } else if (ns.length === os.length + 1) {
        const { error } = await supabase.rpc('check_in', { p_loc: ns[ns.length - 1].loc || 'office' });
        if (error) {
          const stored = await savedSessions(n, iso), last = stored?.[stored.length - 1];
          if (!(stored && stored.length === ns.length && sameSessions(stored.slice(0,-1), os) && last.out == null && last.loc === (ns[ns.length-1].loc || 'office'))) fail(error, 'Could not check you in. Try again.');
        }
      } else if (ns.length && ns.length === os.length && os[os.length - 1].out == null && ns[ns.length - 1].out != null) {
        const { error } = await supabase.rpc('check_out', { p_at: ns[ns.length - 1].out });
        if (error) {
          const stored = await savedSessions(n, iso);
          if (!stored || !sameSessions(stored, ns)) fail(error, 'Could not check you out. Try again.');
        }
      }
    }
  }
}
