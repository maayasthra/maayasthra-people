import { supabase } from './auth.js';
import { EMP, BY, ROLEMAP, DEPTS } from './data.js';

/* The staff directory, kept in Supabase. Row n in the app is the database id. */
const toApp = (r, p) => ({
  n: r.id, empId: r.emp_code, email: r.email, name: r.name, g: 'f', role: r.job_title, dept: r.department, city: r.city,
  join: r.join_date || '', dob: r.birth_date || '', status: r.status, mgr: r.manager_id || 0,
  shiftStart: r.shift_start.slice(0, 5), shiftEnd: r.shift_end.slice(0, 5), bio: r.bio, photo: r.photo,
  phone: p ? p.phone : '', emergency: p ? p.emergency_name : '', emergencyPhone: p ? p.emergency_phone : ''
});
const toRow = e => ({
  email: e.email, name: e.name, job_title: e.role, department: e.dept, city: e.city, join_date: e.join || null, birth_date: e.dob || null,
  status: e.status, role: e.access, manager_id: e.mgr || null, shift_start: e.shiftStart, shift_end: e.shiftEnd
});

// Replace the in-memory directory with what the database holds. Private details come back only for the rows this person may see.
export async function loadStaff() {
  const [a, b] = await Promise.all([
    supabase.from('employees').select('*').order('id'),
    supabase.from('employee_private').select('*')
  ]);
  if (a.error) throw new Error('Could not load the staff list.');
  if (b.error) throw new Error('Could not load the staff list.');
  const priv = {}; (b.data || []).forEach(p => { priv[p.employee_id] = p; });
  EMP.splice(0, EMP.length, ...a.data.map(r => toApp(r, priv[r.id])));
  Object.keys(BY).forEach(k => delete BY[k]); Object.keys(ROLEMAP).forEach(k => delete ROLEMAP[k]);
  a.data.forEach((r, i) => { BY[r.id] = EMP[i]; ROLEMAP[r.id] = r.role; });
  DEPTS.splice(0, DEPTS.length, ...[...new Set(EMP.map(e => e.dept).filter(Boolean))].sort());
}

const upsertPrivate = async (id, e, base) => {
  // Only the contact fields that changed are written, so a private-details list that failed to load can never blank them
  const f = { phone: ['phone', 'phone'], emergency_name: ['emergency', 'emergency'], emergency_phone: ['emergencyPhone', 'emergencyPhone'] };
  const row = { employee_id: id };
  Object.entries(f).forEach(([col, [k]]) => { if (!base || (e[k] || '') !== (base[k] || '')) row[col] = e[k] || ''; });
  const { error } = await supabase.from('employee_private').upsert(row);
  if (error) throw new Error('Could not save contact details.');
};
const NOT_ALLOWED = 'Only admins can change that.';
const nice = m => /duplicate key/i.test(m) ? 'That work email is already in the staff list.' : /at least one admin/i.test(m) ? 'There must be at least one admin.' : 'Could not save. Check your connection and try again.';

// Admin: add or change a person. Returns the saved record.
// When editing, pass the record the form was opened with: only the fields that were actually changed are written,
// so someone else's change to a different field (a new photo, a status) is not undone by a stale form.
export async function saveEmployee(e, base) {
  let id = e.n;
  if (id) {
    const next = { ...toRow(e), bio: e.bio || '', photo: e.photo || '' };
    const was = base ? { ...toRow(base), bio: base.bio || '', photo: base.photo || '' } : null;
    const patch = was ? Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== was[k])) : next;
    if (Object.keys(patch).length) {
      const { data, error } = await supabase.from('employees').update(patch).eq('id', id).select('id');
      if (error) throw new Error(nice(error.message));
      if (!data.length) throw new Error(NOT_ALLOWED);
    }
    const pk = ['phone', 'emergency', 'emergencyPhone'];
    if (base && !pk.some(k => (e[k] || '') !== (base[k] || ''))) { await loadStaff(); return BY[id]; }
  } else {
    const { data, error } = await supabase.from('employees').insert({ ...toRow(e), bio: e.bio || '', photo: e.photo || '' }).select('id').single();
    if (error) throw new Error(nice(error.message));
    id = data.id;
  }
  await upsertPrivate(id, e, base);
  await loadStaff();
  return BY[id];
}

// Anyone: change only their own contact details, about line and photo.
export async function saveMyProfile(e) {
  const { error } = await supabase.rpc('update_my_profile', { p_phone: e.phone || '', p_bio: e.bio || '', p_photo: e.photo || '', p_emergency_name: e.emergency || '', p_emergency_phone: e.emergencyPhone || '' });
  if (error) throw new Error('Could not save. Check your connection and try again.');
  await loadStaff();
}

// Admin: change someone's app access. A database trigger copies it to their sign-in account.
export async function saveRole(id, role) {
  const { data, error } = await supabase.from('employees').update({ role }).eq('id', id).select('id');
  if (!error && !data.length) throw new Error(NOT_ALLOWED);
  if (error) throw new Error(/at least one admin/i.test(error.message) ? 'There must be at least one admin.' : 'Could not change the role. Try again.');
  await loadStaff();
}

// Admin: when each person last signed in, when their account was created, and whether they have signed up yet.
export async function loadMembers() {
  const { data, error } = await supabase.rpc('admin_members');
  if (error) throw new Error('Could not load the members list.');
  const out = {};
  data.forEach(r => { out[r.employee_id] = { last: r.last_sign_in ? Date.parse(r.last_sign_in) : 0, created: r.account_created ? Date.parse(r.account_created) : 0, signedUp: !!r.signed_up }; });
  return out;
}
