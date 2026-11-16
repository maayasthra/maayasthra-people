# Send every end-of-day report to the Google Sheet

Every report an employee submits (or later edits) appears in the Google Sheet **Employee EOD Updates - (Review)** within about a minute.
Sync depends on successful Google trigger executions; large exports or service limits can delay an update.
Each month gets its own tab ("Nov 2026"), newest first, plus a **Summary** tab. The sheet only reads from Maayasthra People; it never changes anything there.

## What the sheet shows

**Each month tab**
- A title bar, then a strip with **total hours, reports, people, average hours per report, days covered** and the last sync time.
- A table with one row per project line or subtask: **Date, Employee, Department, Project, Subtask, What was done, Hours, Day total, Submitted**. A hidden Employee ID column keeps namesakes separate.
- The **Day total** and **Submitted** time are on the first row of each report, so you can see where one report ends and the next begins. Reports are shaded in turn.
- A **Total for the month** row under the table, and a filter on the header so a project manager can pick one person or project.
- Hours are always numbers (2.5 means 2 hours 30 minutes), so they add up. A project that has subtasks carries no hours itself; its subtasks do, so nothing is counted twice.

**Summary tab**
- One row per month (total hours, reports, people, average, days) with a link to that month's tab.
- Hours by employee and month, with totals.
- Every number is a formula that reads the month tabs.

Everything is set in **Inter**. The tabs are rewritten on every sync, so don't type in them. To add your own notes or charts, use a new tab.

## One-time setup (about 10 minutes)

### Part 1: in Supabase

1. Apply the approved database migrations through `0047_eod_export_integrity.sql` in order (including `0045` and its prerequisites). Validate in staging first; do not enable this script against the old `0045` export alone.
2. **Make a secret token.** Use your password manager to generate a random string of at least 32 characters. Keep it to yourself: don't paste it into chat or email. It is the only thing that lets the sheet read reports.
3. **Save the token's fingerprint.** In a new query, replace `PASTE-YOUR-TOKEN` with your token and Run:

   ```sql
   insert into public.eod_export_config (id, token_hash)
   values (1, encode(sha256(convert_to('PASTE-YOUR-TOKEN', 'UTF8')), 'hex'))
   on conflict (id) do update set token_hash = excluded.token_hash, updated_at = now();
   ```

   Only a fingerprint is stored, so the database never keeps the token itself. Then clear that query from the editor's history.
4. **Find two details** in Supabase under **Project Settings, API**: the **Project URL** (like `https://abcd1234.supabase.co`) and the **anon public** key. Use the public one, never the one marked secret.

### Part 2: in the Google Sheet (signed in as the sheet's owner)

1. Open the sheet. **Extensions, Apps Script.**
2. Delete the sample code. Open `integrations/google-sheet/Code.gs` from this project, copy everything, paste it in, and press **Save**.
3. Optional but tidy: in Apps Script **Project Settings**, set the time zone to **(GMT+05:30) India Standard Time**.
4. Go back to the sheet and **reload the page**. A new menu **EOD sync** appears.
5. **EOD sync, Connect to Maayasthra People.** Google asks you to allow the script (choose your account, Advanced, Go to project, Allow). Then enter the three things when asked: the Project URL, the anon public key, and your token. They are saved in the script's private settings, not in any cell.
6. **EOD sync, Rebuild all months.** The month tabs and the Summary appear.
7. **EOD sync, Start automatic sync (every minute).** From now on new reports arrive on their own.

## Day to day

- Nothing to do. A report submitted at 6:02 PM is in the sheet by about 6:03 PM. If someone edits a report, its rows are rewritten.
- **Rebuild all months** is safe to run any time (for example if you change the layout).
- If the sheet stops updating, open **Extensions, Apps Script, Executions** to see the error. The usual cause is that Google needs you to approve the script again.
- To share with project managers, share the sheet with **Viewer** access. It contains what people reported, so keep sharing to the people who need it.

## Changing or removing access

- **New token:** repeat Part 1 step 3 with a new token, then **EOD sync, Connect** with the new token.
- **Switch the sheet off:** in Supabase run `delete from public.eod_export_config;`. The sheet can no longer read anything.
- **Stop syncing but keep the data:** **EOD sync, Stop automatic sync.**

## Good to know

- Times are India time.
- Only reports that have been submitted appear. Reports for months with no submissions have no tab.
- The sheet uses Google's built-in `COUNTUNIQUE` and `SUMIFS`, so keep it in Google Sheets rather than exporting to Excel.


## Updating an existing export to the integrity fixes

Keep automatic sync stopped while updating. Apply the approved migrations through **0047** first, replace Apps Script with this version, and run **Rebuild all months** before restarting automatic sync. The script refuses an older server response without month revisions or employee IDs. No export token is changed by the migration.

Month revisions are committed in the same transaction as report edits/deletions. A successful run remembers the revisions fetched **before** it reads the reports; concurrent commits are picked up by a later sync. A failed run does not advance that snapshot. Deleting a month's final report removes its generated tab; other personal tabs are retained. Only tabs recorded in the script's `MONTHS` manifest are treated as owned. Keep personal notes on separate, differently named tabs.

Employee-authored names, descriptions and project text are written as literal text; only formulas built by this script are evaluated. Validate leading-equals sample text and duplicate names in a disposable Google Sheet before enabling the production integration. Local adapters test the write calls but cannot replace Google's interpreter and permission checks.
