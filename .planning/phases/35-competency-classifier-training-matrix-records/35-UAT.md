---
status: complete
phase: 35-competency-classifier-training-matrix-records
source: [35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md]
started: 2026-07-25T00:00:00Z
updated: 2026-07-26T00:00:00Z
---

## Current Test

All 8 tests complete — 8/8 passed.

## Tests

### 1. Training matrix view appears on the team page
expected: On /admin/team a third "Matrix" view mode exists. It shows people × required SOPs grouped by department, a coloured state pill per cell (Not started / Read only / Supervised / Competent), and roll-up counts per row and column.
result: PASS (2026-07-26) — after running scripts/uat-seed-competency.mjs, all 6 personas rendered expected states on the first SOP column incl. both review-fix floors (Dean = Read only + Needs support, Tom = Not started + Needs support). Row roll-ups (x/4 competent · needs-support counts) and column roll-ups (x/6 signed off · needs-support counts) present. Note: initial view was empty because seed hadn't been applied — not a defect.

### 2. Matrix filters cut the grid
expected: In the Matrix view you can filter by department, by a single worker, and by a single SOP. Each filter narrows the grid immediately, and switching filters quickly never shows a stale mix of results.
result: PASS (2026-07-26) — filters cut the grid correctly, no stale results. Enhancement idea captured: axis-swap toggle (workers as columns / SOPs as rows) → .planning/todos/pending/2026-07-26-matrix-axis-swap.md

### 3. Clicking a cell opens that person's training record at the right SOP
expected: Clicking a coloured cell opens the person's panel with their training record focused on the SOP you clicked — showing the evidence behind the state (completions, sign-offs, observations) for that SOP.
result: PASS (2026-07-26) — cell click deep-links to the person panel focused on the clicked SOP with underlying evidence visible.

### 4. Per-worker training record shows grouped evidence
expected: Opening any person from the team page shows a "Training record" section in their panel: their required SOPs grouped with the evidence per SOP, plus any SOPs they completed that are no longer required. Purely informational — nothing is locked or blocked.
result: PASS (2026-07-26) — Dean Harris's record shows grouped evidence per required SOP, informational only. Note: seed workers were initially invisible in Chart/Columns (those views render from roles + role_members, not member_departments); seed script extended with a "UAT Operator" role placement + evidence re-run guard.

### 5. CSV export from the matrix
expected: The Matrix view has an Export CSV button. Clicking it downloads a CSV that opens in Excel with one row per person × SOP (worker name/email, SOP, state, dates). Filters applied to the matrix carry into the export. A "To" date includes that whole day. No cell turns into a formula or link when opened in Excel.
result: PASS (2026-07-26) — export opens clean in Excel, filters carry into the export, To-date whole-day inclusive, no formula/link cells.

### 6. CSV export from a person's training record
expected: A person's training record section also has an Export CSV button. It downloads that worker's rows only, same columns as the matrix export.
result: PASS (2026-07-26) — per-person export contains only that worker's rows, same columns as the matrix export.

### 7. Worker sees their own competency on their profile
expected: Log in as a plain worker and open your Profile page. A "My competency" style section lists your required SOPs each with your own state pill. It is information only — no lock icons, no disabled buttons, no "you can't do this yet" wording anywhere. You can still open and walk through any SOP exactly as before.
result: PASS (2026-07-26) — section ships under the heading "Your training" (CMP-01's "My competency" was spec language, not the label). Pills render per required SOP, no gating UI/copy. UAT feedback fixed in-flight: SOP titles were not clickable → linked to /sops/[sopId] in b642247, confirmed live.

### 8. Live per-role security probes (automated, needs live session)
expected: The four staged RLS probes in tests/phase35/competency-rls-probe.spec.ts run green against live sopstart.com Supabase: supervisor same-org matrix read returns rows; a plain worker calling the matrix action is denied; an admin cannot read another org's rows; a worker sees only their own states, never a peer's.
result: PASS (2026-07-26) — WR-07 closed: tripwire stub bodies replaced with real assertions and activated. Server actions can't run outside Next.js request scope (32-05 learning), so probes exercise the RLS branches directly with magic-link-minted sessions on ephemeral orgs (per the 2026-07-20 per-branch mandate), with the action-level RECORDER_ROLES gate + admin-client compensation pinned by inline source contracts. All 4 probes + full phase35 project (70 tests) green against live Supabase.

## Summary

total: 8
passed: 8
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
