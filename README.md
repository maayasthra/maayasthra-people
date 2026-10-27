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

## Database (Supabase)

Run these in the Supabase SQL Editor, in order. Each file can be run again safely.

| File | What it sets up |
|---|---|
| `0001_auth.sql` | Sign-in accounts, roles |
| `0002_staff.sql` | Staff directory, private contact details, CSV import |
| `0003_signup_guard.sql` | Only people in the staff list can sign up |
| `0004_leave.sql` | Leave requests, holidays, leave rules |
| `0005_attendance.sql` | Check-ins (server-timed) |
| `0006_tasks.sql` | Kanban board and announcements |
| `0007_live_updates.sql` | Live updates for check-ins and leave |
| `0008_leave_types.sql` | Leave types: Sick, Casual, Emergency |
| `0009_integrity.sql` | Rules the database itself enforces (leave overlap, balance, notice, last admin, safe comments) |
| `0010_profile_and_leave.sql` | Employee IDs read M-<number>, admins can decide their own leave, staff changes arrive live |
| `0011_board_layout.sql` | Board column order and hidden columns, shared, admin-only |
| `0012_task_timer.sql` | Task timers (server-stamped) for My Tasks and Project hours |
| `0013_project_manager.sql` | Project manager role; employees see only their own tasks; only admins and project managers assign and remove tasks; one running timer per person |
| `0014_checkout_stops_timers.sql` | Checking out ends the person's task timers; a timer left running overnight is closed at that day's shift end |
| `0015_review_fixes.sql` | Closes a card-assignment loophole, stricter leave decisions (no double-booking, cancelled stays cancelled), server-clocked check-out, India-date cancellation |
| `0016_stale_timers.sql` | A timer left running overnight ends at that day's shift end whenever anyone opens the board or presses a timer; timers stop when someone is marked Exited |
| `0017_no_auto_checkout.sql` | No automatic check-out at shift end; check-in is allowed at any hour |
| `0018_eod_reports.sql` | EOD reports table, `submit_eod`, and check-out refuses until today's report is sent |
| `0019_refuse_stale_checkout.sql` | An out-of-date page cannot check anyone out at the shift end |
| `0020_members.sql` | `admin_members()`: last sign-in and account date for the admin Members page |
| `0021_many_doing.sql` | Several cards can be Doing at once |
| `0022_board_groups.sql` | Board groups (name, colour, emoji, columns), written by admins only |
| `0023_announcement_reads.sql` | Which announcements each person has read (they pop up until closed) |
| `0024_ack_tracking.sql` | Admins can see who has acknowledged each announcement |

## Tests

`npm run test:db` runs the real application code against a real Postgres (in memory) with every migration applied.
It checks who can see and change what, the leave rules, check-ins, and people editing the same card at once.
Run it after any change to `supabase/migrations` or to the files in `src/` that talk to the database.
