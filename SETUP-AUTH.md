# Turning on real sign-in

The app runs in **demo mode** until it has two keys. Demo mode uses a shared demo password and
is for design review only. Do not put real people's data in it.

## 1. Create the Supabase project (about 10 minutes)
Use a **company email**, not a personal one, so the owner can take over later.

1. Sign up at supabase.com and create a project (free plan). Pick the region closest to India.
2. Open **SQL Editor > New query**, paste the contents of `supabase/migrations/0001_auth.sql`, and run it.
3. **Authentication > Providers > Email**: keep it on. Turn **off** "Allow new users to sign up"
   (under Authentication > Sign In / Providers) so only people you invite can get in.
4. **Authentication > URL Configuration**: set *Site URL* to the app address
   (for now `http://localhost:5173`, later `https://people.maayasthra.com`) and add the same
   address under *Redirect URLs*. Password-reset and invite links return there.
5. **Authentication > Users > Invite user**: invite each person by their work email.
   They get an email, choose a password, and land in the app.
6. After the first admin has accepted the invite, run this once in the SQL Editor:
   `update public.profiles set role = 'Admin' where email = 'meera.iyer@maayasthra.com';`

## 2. Give the app its two keys
1. **Project Settings > API**: copy the *Project URL* and the *anon public* key.
2. Copy `.env.example` to `.env.local` and paste them in.
3. Restart `npm run dev`. The demo accounts disappear and real sign-in takes over.

**Never** paste the `service_role` key into this project or into a chat. It bypasses all security.

## What works now
- Email and password sign-in, sign-out, and staying signed in after a refresh.
- Forgot password by email, and choosing a password from an invite or reset link.
- Admin or Employee role from the `profiles` table.
- Anyone whose email is not in the staff directory is turned away.

## Not done yet (next steps)
- Employees, leave, attendance and tasks are still sample data held in the browser.
  They move into Postgres tables next, with row level security so the roles are enforced
  on the server and not only on screen.
- Inviting people from inside the app (needs a small server function, since invites use the secret key).
- The staff directory is still the sample list. Real emails must match it until it moves to the database.
