# Attendance, Sheets and cover fixes — release validation

Base: bb49037131d02778e052c925800df33ac4351512. Branch: fix/attendance-sheets-cover.

## Changes

- Attendance: find open breaks anywhere in the day, reject a second active break, close legacy open entries on return/checkout, preserve away/early metadata when editing sessions, and require another admin to remove your own break.
- Sheets: literal employee text, stable employee identity, committed month revisions covering edits/deletions/directory changes, reconciliation of obsolete generated tabs, and retry-safe synchronization.
- Cover: cancel pending image preparation after user change/unmount, bind writes to expected employee in the database, and ignore older reads after a newer save.
- Tests: original midnight-sensitive away fixtures now choose times within the same day; focused regression suites exercise the audited failures.

## Validation commands

Run in an isolated environment with dummy data and no production credentials:

- `npm run test:unit`
- `npm run test:db`
- `npm run test:regressions`
- `npm run build`, and live-mode build using dummy local Supabase configuration.
- `node tests/cover-browser.mjs` needs the isolated Playwright runner's `/pwdeps/node_modules/playwright` and `/scratch` locations. It uses real React/Supabase JS/auth helpers with synthetic loopback Auth/PostgREST, not hosted Supabase.

## Rollout order

1. Review this patch and the completed staging evidence. Validate Google-to-Supabase HTTP configuration and the intended sharing/trigger setup before enabling production export.
2. Apply forward migrations 0046, 0047 and 0048 in order, after 0045, using the approved migration procedure. Do not rerun old migrations after these replacements.
3. Deploy the corresponding frontend. Migration 0048 deliberately makes the legacy one-argument cover RPC return a refresh-required message; older tabs need refresh before changing covers. Other features remain available.
4. Update Apps Script with automatic sync stopped, rebuild all generated months and verify totals before enabling automatic sync. See SETUP-SHEET.md.

Deployment authorized on 15 November after staging validation. Production migration preflight matched18 definitions and the guarded0046–48 transaction committed successfully. Final rollout evidence is retained outside the repository. Backup work remains skipped.

## Limits

Follow-up validation passed 87 checks against an isolated full local Supabase stack (real Auth, PostgREST, PostgreSQL and Realtime), including actual admin/manager/employee browser journeys and cover account switching. Nine checks passed in a disposable native Google Sheet using real Apps Script and the formula engine, including replay of an actual dummy staging export RPC response. Two Google runtime failures were fixed: merging a summary title across the frozen column, and partially unmerging old headings during rebuild. The updated unit suite passed 42/42. Follow-up direct HTTPS transport and actual one-minute Google trigger executions passed against real local Supabase through a temporary export-only proxy: baseline5hours, scheduled edit7hours, final-report deletion removed the generated month. Repeated Start created only one trigger. The temporary proxy initially rejected a valid null p_since; its test-only allowlist was corrected. The trigger and tunnel were stopped afterward. Weekday announcement popup tests simulated the weekday only; timestamps and authentication expiry stayed real. Sunday suppression was tested separately. Production schema preflight passed; production export token was unconfigured. Activation of a real employee export requires the intended production workbook. Existing historical overlapping breaks are not deduplicated: reviewing/recalculating those hours requires a separate data-repair plan. The existing large JavaScript bundle warning remains. Other source-supported audit leads outside these fixes remain in the prior NEEDS-VALIDATION report.
