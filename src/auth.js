import { createClient } from '@supabase/supabase-js';
import { EMP, ROLEMAP, addEmployee } from './data.js';

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

// Match the signed-in account to a person in the directory and read their role.
// Anyone invited in Supabase can sign in. If they are not in the staff list yet,
// a basic record is created for them until the real staff list is in the database.
const titleCase = w => w.charAt(0).toUpperCase() + w.slice(1);
export async function resolveUser(session) {
  const email = (session.user.email || '').toLowerCase();
  const { data, error } = await supabase.from('profiles').select('role, active').eq('id', session.user.id).maybeSingle();
  if (error) return { error: 'Could not load your account. Try again.' };
  if (data && data.active === false) return { error: 'This account is turned off. Ask an admin.' };
  let user = EMP.find(e => e.email === email);
  if (!user) {
    if (!data) return { error: 'Your account is not set up yet. Ask an admin.' };
    const name = email.split('@')[0].split(/[._-]+/).filter(Boolean).map(titleCase).join(' ') || 'New member';
    user = addEmployee({ name, role: 'Team member', dept: 'Studio', city: 'Chennai', mgr: 0, status: 'Full-time', join: new Date().toISOString().slice(0, 10), dob: '1990-06-15', g: 'f' });
    user.email = email;
  }
  if (user.status === 'Exited') return { error: 'This account is no longer active.' };
  const admin = !!data && data.role === 'Admin';
  ROLEMAP[user.n] = admin ? 'Admin' : 'Employee';
  if (admin) user.shiftStart = '09:00';
  return { user, role: admin ? 'admin' : 'employee' };
}
