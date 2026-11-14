# Send every end-of-day report to the Google Sheet

Every report an employee submits (or later edits) appears in the Google Sheet **Employee EOD Updates - (Review)** within about a minute.
Each month gets its own tab ("Nov 2026"), newest first, plus a **Summary** tab. The sheet only reads from Maayasthra People; it never changes anything there.

## What the sheet shows

**Each month tab**
- A title bar, then a strip with **total hours, reports, people, average hours per report, days covered** and the last sync time.
- A table with one row per project line or subtask: **Date, Employee, Department, Project, Subtask, What was done, Hours, Day total, Submitted**.
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

1. **SQL Editor, New query.** Paste the whole of `supabase/migrations/0045_eod_sheet_export.sql` and Run. (Run `0044` first if you haven't.)
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
