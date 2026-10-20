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
- Front end: working prototype. Code lives in `src/data.js` (sample data, leave policy, roles, date helpers), `src/ui.jsx` (shared pieces) and `src/screens/` (one file per screen).
- Home differs by role: employees see presence, balances, announcements, who is away and their team; HR and Admin see headcount, approvals, probation reviews and quick actions; managers also see their team's approvals.
- Also in: org chart, add and edit employees, photo and contact self-service, half-day leave, notice and note rules, leave CSV export, light and dark themes.
- Data is sample data held in memory. Nothing persists yet, and sign-in is a demo check (password `maayasthra`).

## Maayasthra Task
The People and Task buttons (top left) switch between Maayasthra People and Maayasthra Task. Task has one General Kanban board with a column per person, two pinned columns (Priority Tasks, Retainer Tasks) and a Completed Tasks column at the end, plus My Tasks and an admin Team view. Code is in `src/task/` and `src/tasks.js`. Tasks and projects are sample data saved in the browser (localStorage) until the database exists.

## Next steps
1. Choose the backend once the existing hosting is confirmed (Supabase/Postgres, or a Node API on the current host).
2. Replace the in-memory store in `src/data.js` with a data layer that reads and writes the database.
3. Load the real employee roster, holidays and leave policy.
4. Add real work-email sign-in for all employees.
5. Deploy to a free host and point `people.maayasthra.com` at it.
6. Write HANDOVER.md for the owner.
