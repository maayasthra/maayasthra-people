# Maayasthra People

Internal people directory: profiles, celebrations, calendar, leave requests and admin settings.

## Run locally
```
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
```
Needs Node 20+. The build output is plain static files, so any host can serve it.

## Architecture and modes

The live app is a React/Vite frontend backed by Supabase Auth, Postgres, RLS, RPCs and Realtime. It includes the staff directory, private contacts, attendance, leave, announcements, shared task boards, timers and EOD reports. `src/*Db.js`, `src/staff.js`, and `src/leave.js` contain data access; database rules live in `supabase/migrations/`.

Without both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the app uses local demo data. Use a disposable staging project for integration testing. Never put a service-role key in frontend environment variables. Do not use `dev:live` or production credentials for local regression checks.

## Change and recovery procedure

1. Establish a backup and verify restoration into an isolated project before database changes. Confirm external recovery coverage if the plan has no managed backups.
2. Compare the installed schema, functions and grants with migration history. A dashboard showing no migrations does not prove the schema is empty; SQL may have been applied manually.
3. Test pending migrations against an isolated database with dummy accounts and the existing schema baseline. Do not rerun the entire historical migration list over a live database.
4. Run unit tests, database tests and a production build in a safe environment, then exercise the affected UI against staging.
5. Review the diff and staging results before approving a production release. Keep the previous frontend artifact and a database recovery plan.

Migration `0035_subtask_order.sql` adds the reorder RPC used by the matching frontend. Validate and apply it in staging before testing subtask reordering. Migration `0036_inactive_rpc_access.sql` also denies task/timer and profile RPC mutations from deactivated accounts with an existing session. Migration `0037_security_integrity.sql` enforces subtask/comment/column/EOD JSON shapes, comment authorship and staff identity revocation. All three passed isolated staging and remain unapplied to production. The read-only production check on 2026-11-13 also found the pre-0034 EOD history policy; reconcile and include `0034_eod_own_history.sql` in the reviewed release plan. The new shape constraints deliberately fail if existing malformed records are found; do not discard or silently rewrite live records to make them pass.

## Database (Supabase)

For a new isolated database, apply the files in order. For an existing database, reconcile its baseline and apply only reviewed pending migrations. Historical migrations can overwrite newer function definitions.

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
| `0025_eod_managers_only.sql` | Employees can no longer read EOD report history (only today’s own, to edit it) |
| `0026_eod_pm_no_hours.sql` | Admins and project managers send EOD reports without hours (description only) |
| `0027_checkout_no_eod_for_managers.sql` | Admins and project managers check out without an EOD report |
| `0028_emergency_relationship.sql` | Emergency contact gets its own relationship field |
| `0029_notifications_and_user_state.sql` | The notification bell, the tour flag and the tasks already announced are kept per person in the database |
| `0030_user_prefs.sql` | Board column open/closed state and filters are remembered per person |
| `0031_retainer_flag.sql` | Retainer tasks stay marked (blue tint) wherever they are moved |
| `0032_eod_missed_day.sql` | Send an end-of-day report for a missed day (up to 7 days back, once); used by the Home alert |
| `0033_retainer_color.sql` | Each retainer card can have its own tint colour; duplicates keep it. Only admins and project managers can change it |
| `0034_eod_own_history.sql` | Everyone can read back their own past day reports (My Tasks > Submitted work); only admins and project managers see other people's |

| `0035_subtask_order.sql` | Authorized subtask reordering that preserves concurrent additions and stored content |
| `0036_inactive_rpc_access.sql` | Active membership checks for task/timer and both profile RPC overloads |
| `0037_security_integrity.sql` | JSON contracts, immutable author-bound comments and revocation of former staff identities |
| `0038_concurrent_workflows.sql` | Serialize check-ins and leave allocation; keep missed-day EOD reports write-once |
| `0039_timer_archive_and_groups.sql` | Retain closed timer history in read-only archive batches and validate group members |
| `0040_retry_identity.sql` | Stable creation keys, repeat-safe task list additions and authorized deletion |
| `0041_reporting_cycles.sql` | Serialize reporting-line writes and reject self/indirect manager cycles |

## Tests

`npm run test:unit` checks save serialization, failure recovery, departure flushing and account disposal with dummy in-memory state.

`npm run test:db` runs the real application code against a real Postgres (in memory) with every migration applied.
It checks who can see and change what, the leave rules, check-ins, and people editing the same card at once.
Run it after any change to `supabase/migrations` or to the files in `src/` that talk to the database.

## Design

The visual rules (colours, type, spacing, components) are in [DESIGN.md](DESIGN.md). Styling lives in `src/styles.css` and `src/untitled.css`; new work uses the tokens in `untitled.css`.

## Concurrency, pagination and timer history

Check-in and leave allocation serialize on the employee row. Restoring declined leave to pending/approved consumes the configured allowance again; there is no implicit admin allowance override. Past-day EOD conflicts reject the second submission, while today's report remains editable.

`readAll` loads leave/away data, announcement receipts, tasks and archived timer history with stable ordering, advancing by the actual server page size. A later-page error fails the load instead of returning an incomplete balance or report.

At 500 hot timer entries, `task_timer` archives closed sessions transactionally before starting the next timer. Open sessions remain on the task. `loadBoard` merges archived history so total and date-range reports retain every session. Archives inherit task read permissions and are not writable through the client API. Do not deploy the frontend before migration 0039, or revert to a frontend that ignores archived history after archival has started.

Before an approved release, verify backup/restore and the installed baseline, recheck existing JSON compatibility (including `board_groups.members`), and review migrations 0034–0041 as the observed pending set. Migration 0039 intentionally fails atomically if existing group member data is malformed. The audit test suites use isolated synthetic data. Migrations 0034–0041 and the matching frontend were released on 13 November 2026; reconcile the installed baseline before future migrations.

Lost-response recovery uses stable creation keys for employees, announcements and leave; task inserts ignore existing identities and reconcile newer local edits. Identical missed-day reports and matching attendance states can confirm a previously committed write. Different saved reports remain immutable. Retry identity is retained during the active edit session; this is not an offline queue that survives closing the browser.

The directory/private contacts, attendance, EOD, holidays and groups use the shared paged reader. Manager selection excludes subordinates; the database rejects reporting cycles and the org chart keeps people with legacy invalid relationships visible for review. Preflight existing reporting relationships before release; 0041 prevents new cycles but does not silently rewrite old staff relationships.

Task-list and timer RPCs recheck authorization after acquiring the task row lock, so assignment changes while a request waits take effect before its mutation. Uncertain list additions reconcile before newer edits/removals; discarded uncertain card creations are checked and removed safely. Timer-history loading deduplicates sessions that move into the archive during a read. Partial employee creation retains its core-field baseline until contacts and readback succeed.

Directory refreshes reject superseded responses before publishing shared state, preventing a delayed admin contact read from replacing a newer restricted account's directory.

## Production builds

Cloudflare Workers Builds watches `main`, runs `npm run build`, then `npx wrangler deploy`. Verify the Git-triggered build succeeds for the pushed commit and that the resulting Worker version serves traffic. A successful manual retry alone does not verify automatic builds.
