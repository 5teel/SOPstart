---
phase: 59-the-office
plan: 10
subsystem: office decisions tab / ledger read
tags: [office, decisions, ledger, keyset-paging, cleared-today, eval]
requires: [59-02, 59-09]
provides:
  - "src/actions/office.ts: listDecisions({ group, cursor }) and countClearedToday() -- admin / safety-manager guarded session-client reads"
  - "src/lib/office/format.ts: nzStartOfDayIso(now)"
  - "src/components/office/DecisionsTab.tsx: kind chips, plain-words ledger table, Show older"
  - "OfficePane decisions arm; InboxTab cleared-today line"
affects: [59-12, 59-16]
key-files:
  created:
    - src/components/office/DecisionsTab.tsx
  modified:
    - src/actions/office.ts
    - src/lib/office/format.ts
    - src/components/office/OfficePane.tsx
    - src/components/office/InboxTab.tsx
    - tests/phase59/ledger-read.spec.ts
    - tests/phase59/capability-matrix.spec.ts
    - tests/evals/office.eval.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "listDecisions returns nextCursor built from the database's own created_at text of the last returned row, so paging never loses microsecond precision (a JS Date round trip would)"
  - "ledgerReader() returns { supabase | null, error | null } rather than a union of literals -- TS normalised the union and broke 'error' in narrowing"
  - "About: a SOP subject links to its title; completion -> \"{worker}'s walk of {SOP}\"; member / worker -> person label ('someone who has left' when unresolved); everything else the code-literal summary. details is never selected"
  - "Cleared-today query is disabled for any role but admin / safety manager, so a supervisor never calls the action"
requirements-completed: []
completed: 2026-10-06
---

# Phase 59 Plan 10: Decisions tab Summary

An admin or safety manager can read the append-only ledger from the Office, newest first, 50 at a time, narrowed by plain-words kind chips; the empty inbox now says how many things were cleared today in NZ time.

Requirements DEC-02 and OFF-01 are not ticked here: the pane is mounted in 59-12 and proven by the deployed eval in 59-16.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | d8bb8573 | `listDecisions`, `countClearedToday`, `nzStartOfDayIso`, matrix row, spec cases |
| 2 | 782019ea | `DecisionsTab`, pane arm, cleared-today line, eval case |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, bundle gate green (`/page` +1 KB, `/sops/[sopId]` +1 KB, inside the ±2 KB tolerance; baseline file untouched -- the pane is not mounted yet so this is drift from earlier waves, not this plan)
- phase59 `ledger-read`, `capability-matrix`, `office-pane-structure`: 32 passed; phase56: 103 passed; phase46 `capability-matrix-doc`: 9 passed; phase15-stubs design-tokens and undefined-css-tokens: pass
- `npx playwright test --list --project=evals office` lists the new Decisions case; not run (no live probes, per instructions)

## Deviations from Plan

None of substance. Task 1 and Task 2 share `ledger-read.spec.ts`, so the whole file (including the DecisionsTab and cleared-today source-contract cases) landed in the Task 1 commit.

## Known Stubs

None.

## Threat Flags

None. T-59-39..41 mitigated as planned: guard before the session-client read, zod enum / ISO datetime / UUID with `.strict()`, `details` never selected.

## Self-Check: PASSED

- src/components/office/DecisionsTab.tsx exists; commits d8bb8573 and 782019ea exist
