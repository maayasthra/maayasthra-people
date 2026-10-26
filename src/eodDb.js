import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';
import { dayKey } from './attendance.js';

/* End-of-day reports. One per person per day: rows of { project, task, desc, hours, subs: [{ title, desc, hours }] }.
   In demo mode they live in this browser only. */
const KEY = 'mp-eod';
const readDemo = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (x) { return []; } };
const writeDemo = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (x) {} };

export const hoursOf = row => row.subs && row.subs.length ? row.subs.reduce((t, s) => t + (Number(s.hours) || 0), 0) : Number(row.hours) || 0;
export const totalOf = rows => rows.reduce((t, r) => t + hoursOf(r), 0);
export const fmtH = h => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') + 'm' : ''); };

const toApp = r => ({ emp: r.employee_id, day: r.day, rows: r.rows || [], total: Number(r.total_hours) || 0, at: r.updated_at ? new Date(r.updated_at).getTime() : 0 });

// Reports from `from` to `to` (ISO days). People only receive their own; admins and project managers receive everyone's.
export async function loadEods(from, to) {
  if (IS_DEMO) return readDemo().filter(r => r.day >= from && r.day <= to);
  const out = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('eod_reports').select('*').gte('day', from).lte('day', to).order('day').order('employee_id').range(start, start + 999);
    if (error) throw new Error('Could not load the reports.');
    out.push(...data.map(toApp)); if (data.length < 1000) break;
  }
  return out;
}

export async function submitEod(rows, emp) {
  const clean = rows.map(r => ({
    project: String(r.project || '').trim(), task: r.task || null, desc: String(r.desc || '').trim(), hours: Number(r.hours) || 0,
    subs: (r.subs || []).map(s => ({ title: String(s.title || '').trim(), desc: String(s.desc || '').trim(), hours: Number(s.hours) || 0 }))
  }));
  if (IS_DEMO) {
    const day = dayKey(), l = readDemo().filter(r => !(r.emp === emp && r.day === day));
    writeDemo([...l, { emp, day, rows: clean, total: totalOf(clean), at: Date.now() }]); return;
  }
  const { error } = await supabase.rpc('submit_eod', { p_rows: clean });
  if (error) throw new Error(/^(Line \d+|Add at least|That (adds|report)|Not allowed)/.test(error.message) ? error.message : 'Could not save your report. Check your connection and try again.');
}
