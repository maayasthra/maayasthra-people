# Attendance, Sheets and cover fixes — not deployed

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

## Future rollout order — requires separate deployment authorization

1. Review this patch and verify against an isolated full Supabase environment. Validate literal text, duplicate names, deletion/retry behavior and sharing in a disposable Google Sheet before enabling production export.
2. Apply forward migrations 0046, 0047 and 0048 in order, after 0045, using the approved migration procedure. Do not rerun old migrations after these replacements.
3. Deploy the corresponding frontend. Migration 0048 deliberately makes the legacy one-argument cover RPC return a refresh-required message; older tabs need refresh before changing covers. Other features remain available.
4. Update Apps Script with automatic sync stopped, rebuild all generated months and verify totals before enabling automatic sync. See SETUP-SHEET.md.

No production deployment, configuration update or data repair was performed. Backup work was explicitly skipped.

## Limits

PGlite tests exercise PostgreSQL behavior with an identity shim; browser smoke tests are demo-mode, while cover browser tests use a synthetic local Auth service. Google service mocks cannot certify real formula rendering or sharing. Existing historical overlapping breaks are not deduplicated: reviewing/recalculating those hours requires a separate data-repair plan. The existing large JavaScript bundle warning remains. Other source-supported audit leads outside these fixes remain in the prior NEEDS-VALIDATION report.
