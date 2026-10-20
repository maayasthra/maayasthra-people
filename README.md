# Maayasthra People

Internal people directory: profiles, celebrations, calendar, leave requests and admin settings.

## Run locally
```
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
```
Needs Node 20+. The build output is plain static files, so any host can serve it.

## Status
- Front end: complete prototype, split into `src/data.js` (sample data and date helpers), `src/main.jsx` (screens) and `src/styles.css`.
- Data is still sample data held in memory. Nothing persists yet.
- Sign-in is a demo check (password `maayasthra`). Real login comes with the backend step.

## Next steps
1. Choose the backend once the existing hosting is confirmed (Supabase/Postgres, or a Node API on the current host).
2. Replace `src/data.js` with a data layer that reads and writes the database.
3. Load the real employee roster.
4. Add real work-email sign-in for all employees.
5. Deploy to a free host and point `people.maayasthra.com` at it.
6. Write HANDOVER.md for the owner.
