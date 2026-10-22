# Part 1: staff directory in the database

1. Supabase > SQL Editor > New query. Paste `supabase/migrations/0002_staff.sql` and Run.
2. Table Editor > `staff_import` > Insert > Import data from CSV. Choose `staff-import.csv`.
3. SQL Editor, run: `select public.import_staff();` It should say "8 people imported or updated".
4. Upload `maayasthra-people-live.zip` contents to Cloudflare (New deployment).
5. Sign in. The People page now shows these people from the database.

Notes
- Include every admin in the CSV with role Admin. Importing sets each person's sign-in role from the CSV.
- Phone numbers and emergency contacts are visible only to that person and admins.
- Leave, attendance, tasks and announcements are still stored in each browser (parts 2 to 4).
- You can add or edit people later in the app (People > Add employee) or re-run the import.
