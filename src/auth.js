import { createClient } from '@supabase/supabase-js';
import { EMP, ROLEMAP } from './data.js';
import { loadStaff, saveEmployee } from './staff.js';
import { loadLeaveConfig } from './leave.js';

/* Real sign-in through Supabase Auth. With no keys in .env.local the app stays in demo mode. */
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const authEnabled = !!(url && key);
export const supabase = authEnabled ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

const friendly = m => /invalid login/i.test(m) ? 'Wrong email or password.' : /email not confirmed/i.test(m) ? 'Confirm your email first. Check your inbox.' : /rate limit|too many/i.test(m) ? 'Too many attempts. Wait a minute and try again.' : /fetch|network/i.test(m) ? 'Cannot reach the server. Check your connection.' : m;

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(friendly(error.message));
  return data.session;
}
// Self sign-up. The database only lets staff-list emails through, and the person must confirm by email.
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: window.location.origin } });
  if (error) throw new Error(/not in the staff list|database error/i.test(error.message) ? 'That email is not in the staff list. Use your work email, or ask an admin to add you.' : friendly(error.message));
  // A session here means Supabase is not asking for email confirmation. Refuse to continue.
  if (data.session) { await supabase.auth.signOut(); throw new Error('Sign-up is not set up safely yet. Tell an admin.'); }
}
export const signOutAuth = () => supabase ? supabase.auth.signOut() : Promise.resolve();
export async function sendReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
  if (error) throw new Error(friendly(error.message));
}
export async function setNewPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
}
export const currentSession = async () => { const { data } = await supabase.auth.getSession(); return data.session; };
export const onAuthChange = cb => supabase.auth.onAuthStateChange((event, session) => cb(event, session)).data.subscription;
// An invite or reset link opens the app with this in the address
export const isLinkFlow = () => authEnabled && /type=(recovery|invite)/.test(window.location.hash);

// Load the staff list from the database, match the signed-in account to a person and read their role.
const titleCase = w => w.charAt(0).toUpperCase() + w.slice(1);
export async function resolveUser(session) {
  const email = (session.user.email || '').toLowerCase();
  const { data, error } = await supabase.from('profiles').select('role, active').eq('id', session.user.id).maybeSingle();
  if (error) return { error: 'Could not load your account. Check your connection and try again.', retry: true };
  if (data && data.active === false) return { error: 'This account is turned off. Ask an admin.' };
  try { await loadStaff(); await loadLeaveConfig(); } catch (x) { return { error: x.message + ' Check your connection and try again.', retry: true }; }
  let user = EMP.find(e => e.email === email);
  if (!user) {
    // An admin who is not in the staff list yet gets a starter record so they are never locked out. Everyone else waits for an admin to add them.
    if (!data || data.role !== 'Admin') return { error: 'Your account is not in the staff list yet. Ask an admin to add you.' };
    const name = email.split('@')[0].split(/[._-]+/).filter(Boolean).map(titleCase).join(' ') || 'New member';
    try { user = await saveEmployee({ n: 0, email, name, role: 'Team member', dept: 'Studio', city: 'Chennai', mgr: 0, status: 'Full-time', join: '', dob: '', shiftStart: '09:00', shiftEnd: '18:00', access: 'Admin' }); }
    catch (x) { return { error: x.message }; }
  }
  if (user.status === 'Exited') return { error: 'This account is no longer active.' };
  const dbRole = data && data.role === 'Admin' ? 'Admin' : data && data.role === 'Project manager' ? 'Project manager' : 'Employee';
  ROLEMAP[user.n] = dbRole;
  return { user, role: dbRole === 'Admin' ? 'admin' : dbRole === 'Project manager' ? 'pm' : 'employee' };
}
