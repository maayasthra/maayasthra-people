# Developer handover: unpushed work (14 November 2026)

Everything below is **local only**: not in `main` yet, and the three migrations have **not been run** in Supabase. It is written for a developer who will review the **backend** for bugs before it goes live.

Repo: `maayasthra/maayasthra-people` (`main` deploys to people.maayasthra.com on Cloudflare, Supabase for Postgres/Auth/Realtime).
Unpushed commits: `b41096b` through `6f80858` (12 commits, listed at the end). Based on `main` at `ec90493`, which already includes Arjun's migrations `0035` to `0041`.
Test commands: `npm run test:db` (PGlite plus a PostgREST-like shim, `tests/integration.mjs`), `npm run test:unit`, `npm run build`.

## Migrations to review and run, in this order

`0043_away_time.sql`, `0044_home_cover.sql`, `0045_eod_sheet_export.sql`, `0049_payslip_requests.sql`, then `0050_payslip_download_cleanup.sql`. All three are written to be re-runnable (`if not exists`, `drop ... if exists`).

### 0043 `away_time` (largest change)
A person who is checked in can step away (power cut, stepped out, break...) and come back. Away time is not counted as worked. If they could not press anything (a power cut), they can add the time afterwards for today or yesterday. A reason for leaving early can be noted.
- `attendance_days` gets `away jsonb` (array, max 20 entries: `{from, to, why, note, later}`) and `early jsonb` (`{why, note, at}`).
- Trigger `close_open_away` (before insert or update): when a day's last session is closed, an open away period (`to = null`) is closed at that moment.
- RPCs, all `security definer` with `search_path = public`: `go_away`, `come_back`, `add_away(p_day, p_from, p_to, p_why, p_note)`, `set_early_reason`, `admin_remove_away`.
- Rules enforced: reason must be from a fixed list; note at most 200 characters; `add_away` only for today or yesterday, not in the future, 12 hours at most, inside the India day, requires a session that day, no overlap with other away periods (an open one counts until now).
- **Check:**
  - Interaction with `check_in` and `check_out` (`0038`, and the EOD rule in `0027`) and with `admin_set_day`, which replaces `sessions` only, so away entries can end up outside the new sessions.
  - An open away on an earlier day that was never checked out: the database keeps `to = null`; only the client (`loadAttendance`) closes it for display.
  - Worked hours are calculated **in the client only** (`src/attendance.js`: sessions minus away overlap plus lunch credit). No server-side hours figure exists to disagree with.
  - Client sync (`persistAtt` in `src/attendanceDb.js`) picks the RPC by comparing array lengths and the last entry. Two devices acting at once could be mis-detected.
  - `go_away` does not stop task timers on the server; the client does. Time added afterwards does not adjust task timers.
  - Day-boundary maths in `add_away`: `p_day::timestamp at time zone 'Asia/Kolkata'`.

### 0044 `home_cover`
Each person can set their own cover picture for the top of Home. Only they see it.
- Table `employee_covers(employee_id pk, image text, updated_at)`. Select policy: own row only. RPC `set_my_cover(p_image)` for any active staff member.
- Image is a base64 data URL, at most 700,000 characters, must start with `data:image/`. The app rejects files over 2 MB and shrinks to roughly 100 to 300 KB first.
- The migration starts with `drop function/table ... app_cover` because an earlier unpushed draft had one shared cover; this is harmless if that was never run.
- **Check:** images in a text column (consider Supabase Storage if usage grows); no realtime on this table; the size check lives in a column constraint and in the RPC.

### 0049 `payslip_requests` and 0050 `payslip_download_cleanup`
Employees and project managers request a payslip for a past month; an admin delivers a PDF or image (up to 2 MB) under Requests > Payslips.
- Tables `payslip_requests` (the history) and `payslip_files` (the bytes, `bytea`). RLS: a person reads their own requests, admins read all; `payslip_files` has RLS on and no policies, so only the functions below can touch it.
- RPCs (`security definer`): `request_payslip` (finished months only, 12 back, not before joining, one live request per month), `cancel_payslip_request`, `decline_payslip`, `deliver_payslip` (admin; checks type, 2 MB and the file's first bytes), `get_payslip_file` (owner or admin), `confirm_payslip_downloaded` (owner only).
- **0050:** once the employee downloads, the browser calls `confirm_payslip_downloaded`, which **deletes the file row** and sets status `downloaded`; only the text history stays. The delete is triggered by the client after the download starts, so a failed save is possible; the fix is to request the month again.
- **Check:** files stored as `bytea` in Postgres; a delivered file that is never downloaded stays until it is (there is no expiry job yet); all admins can read all payslips; the `payslip` kind was added to the notifications check constraint; the download-then-delete step is client-driven and not atomic with the browser saving the file.

### 0045 `eod_sheet_export` (read-only export for a Google Sheet)
Lets a Google Sheet ("Employee EOD Updates - (Review)") list every end-of-day report, one tab per month.
- Table `eod_export_config(id = 1, token_hash)`: RLS on, no policies, all privileges revoked, so the app cannot read it.
- Functions `eod_export_ok`, `eod_export_months`, `eod_export_changes(p_token, p_since)`, `eod_export_month(p_token, p_month)`: `security definer`, executable by **anon**, gated by a secret token. The token is stored as a sha256 hash and set by hand in the SQL editor (steps in `SETUP-SHEET.md`).
- **Check:**
  - Anyone holding the token can read employee names, departments and report text through the public anon key. There is no rate limiting and the hash comparison is not constant-time.
  - `eod_export_changes` finds months by `updated_at > since`. A **deleted** report (or a deleted employee, which cascades) does not touch `updated_at`, so its rows stay in the sheet until that month is rebuilt.
  - Flattening: a project with subtasks has `hours = null` on its own row, so sums never double count. `day_total` is set only on the first line of each report.
  - Large months: the month function builds one JSON value (not paged).
- The Google side is `integrations/google-sheet/Code.gs` (Apps Script, polls every minute and rewrites changed months). It is tested only against a stand-in for Google's services; it has **not run on real Google**.

## Frontend changes in the same unpushed work (for context)

- **Away time:** Away menu in the timer (icons, one sound per kind of away), "I'm back", "Add time I was away", the leaving-early prompt, away entries on the Hours page, Who is in and the attendance CSV export.
- **Home:** per-person cover picture (the "Change cover" button shows on hover), sidebar grouped into Company, Time and leave, and Admin sections, clearer title/description/details text in announcements.
- **Other:** icon on the "Send and check out" button, tiles aligned on phones.
- **Added then removed the same day:** task-time prefill in the EOD dialog and hours charts on the EOD page (`4cc1e7a`, removed in `6f80858`). No database change was involved.

## What was tested, and what was not

- `npm run test:db`: ALL CHECKS PASSED, including new checks for `0043` (17), `0044` (8) and `0045` (14).
- `npm run test:unit`: 27 passing, 19 of them for the Google Sheet script.
- Browser checks were done in demo mode (localStorage), not against the real Supabase.
- **Not tested:** real Supabase/PostgREST and real RLS (the harness is PGlite with a shim), realtime across devices, Safari and Firefox, the Google Sheet on real Google, load or large data, and running the three migrations on the live database.

## Suggested bug-hunting list

1. Run `0043` to `0045` on a copy of the live database; run each twice to confirm they are re-runnable.
2. Call each new RPC as anon, employee, project manager and admin; confirm nothing is reachable that should not be (`0045` especially).
3. Concurrency: two devices stepping away or coming back at once.
4. Day boundaries around midnight India time for `add_away`, `set_early_reason` and the export month filter.
5. Deletions and edits: a report deleted, an employee exited, sessions edited by an admin after away time was recorded.
6. Limits: 20 away entries, a 700,000-character cover, a very large month export (3,000+ lines).
7. Read the diff of `src/attendanceDb.js` (`persistAtt`) for the away and early-reason sync logic.

## The unpushed commits

`b41096b` Sidebar sections · `bcbc324` Away time (0043) · `9fc3786` and `4fc57c4` Home cover (0044) · `067978e` Announcement text levels · `5c8874d` Away sounds, Change cover on hover · `78e306e` Away reason icons · `c39db48` Send and check out icon · `4cc1e7a` Task-time prefill and charts (later removed) · `807f18b` Tiles on phones · `33400ed` Google Sheet export (0045) · `6f80858` Removal of the prefill and charts.
