# Two-way worklog prototype

This optional integration is under staging validation. It is separate from the existing read-only export. Do not install it in an existing worklog workbook.

## What it does

- `Worklogs` and `People` show the server's current records for the selected month and allowed employees.
- The **Worklog sync** menu creates drafts in `Changes`. Review a draft and set its state to `READY` before sending it.
- Create appends a project worklog. Update edits a selected project or subtask. Delete explicitly removes the selected worklog; deleting a project includes its subtasks, and deleting its last subtask also removes the empty project.
- Removing a row from a Sheet does not delete anything in the database.
- Scheduled sync sends only `READY` drafts and refreshes the server view. It preserves draft rows.

## Safety rules

The backend requires a separate, expiring write token owned by an active administrator and an explicit employee allowlist. The read-only export token cannot write. Migration 0049 provisions no token and enables no connection by default.

Writes are restricted to today and the preceding seven days, using the app's India date. Employee hours must be positive and daily totals cannot exceed 24 hours. Manager and administrator worklogs use zero hours.

Each draft carries the report revision it was created from. A conflicting app or Sheet edit stops the draft instead of overwriting newer data. Refresh and create a new draft after a conflict. A request receipt prevents a lost-response retry from applying twice. Accepted changes record before/after data in a private audit table.

Conflict detection covers the whole daily report. Two drafts for the same employee and day from the same revision will not both apply: send one, refresh, then prepare the next. Sending a batch is not an all-or-nothing transaction; each draft displays its own result. Network failures remain pending for an exact retry; do not create a replacement draft until the original result is reconciled.

Use a private administrator-only workbook. Anyone who can edit its bound Apps Script can access its integration credentials and act within that token's employee scope. Hidden columns and Sheet warning protections are usability features, not authorization boundaries.

## Staging installation

1. Apply migration 0049 to an isolated database containing newly created synthetic employees only.
2. Provision a random dedicated token, store only its SHA-256 hash in `eod_sheet_config`, assign a synthetic active Admin owner, set a short expiry and allowlist only the synthetic employee IDs. Keep the raw token out of source control and logs.
3. Create a new empty Google Sheet. Install `integrations/google-sheet/TwoWay.gs` alone in its bound Apps Script project.
4. Use **Connect this NEW workbook** with the staging URL, public anon key and dedicated write token. Never supply a service-role key.
5. Test create, update, explicit delete, conflicts, retries and scheduled sync against disposable worklogs. Stop scheduled sync and revoke the test token when testing ends.

Production installation is a separate rollout. This feature branch does not authorize changing an existing workbook, production database or production deployment.

This first version creates flat project worklogs; it can edit or delete existing subtasks. It does not create new nested subtasks. It is intended for a small administrator-managed team: the backend serializes worklog writes and bounds snapshots to 1,000 reports and 4 MiB of report JSON. Review capacity and audit retention before a larger rollout.
