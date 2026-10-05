---
phase: 59-the-office
plan: 02
subsystem: database
tags: [supabase, migration, decisions-ledger, rls, playwright]
requires: [59-01]
provides:
  - migration 00073 widening decisions_kind_check with role_change, member_invited, member_removed (applied live)
  - scripts/apply-phase59-migration.mjs (Management-API assertions)
  - DECISION_KINDS and database.types.ts carry eighteen kinds
  - src/lib/decisions/read.ts (DECISION_GROUPS, KIND_GROUPS, KIND_WORDS, CLEARED_KINDS, PAGE_SIZE, cursorFilter)
  - live read-scope probe (worker 0, supervisor 0, admin own org, no authenticated write)
affects: [59-05, 59-10]
key-files:
  created:
    - supabase/migrations/00073_office_ledger.sql
    - scripts/apply-phase59-migration.mjs
    - src/lib/decisions/read.ts
  modified:
    - src/lib/decisions/shape.ts
    - src/types/database.types.ts
    - tests/phase56/decision-kinds-live.spec.ts
    - tests/phase56/decision-shape.spec.ts
    - tests/phase59/ledger-read.spec.ts
    - tests/phase59/ledger-rls-live.spec.ts
key-decisions:
  - "No policy added or changed (A-04): the migration is one drop-and-re-add of the kind check"
requirements-completed: []
completed: 2026-10-05
---

# Phase 59 Plan 02: Ledger kinds and read module Summary

**Migration 00073 is live: the decisions kind check accepts role_change, member_invited and member_removed with the read scope untouched, plus a tested grouping / plain-words / cursor module for the Decisions tab.**

DEC-02 is not ticked: the Decisions tab (59-10) and the writers (59-05) still own it.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | f08ddfa2 | 00073, applier, DECISION_KINDS, types, phase56 live samples |
| 2 | d76aa807 | read.ts and ledger-read spec (RED confirmed before the module existed) |
| 3 | e677955f | live RLS probe, decision-shape repoint, applier trigger-state fix |

## Live apply

- Constraint name confirmed through the Management API before writing the migration: `decisions_kind_check` (inline check from 00070). No rename needed.
- `npx supabase migration list` before the push: local and remote in sync through 00072; only 00073 pending. No repair was needed.
- `node scripts/apply-phase59-migration.mjs`: `db push` applied 00073 (no fallback). Then `--assert-only`:

```
PASS  decisions_kind_check accepts all eighteen kinds (all 18 present)
PASS  decisions carries exactly one policy: admins_can_read_decisions (SELECT, org + role scoped)
PASS  no INSERT / UPDATE / DELETE policy exists on decisions
PASS  append-only triggers decisions_no_update_delete and decisions_no_truncate exist and are enabled
PASS  NOTIFY pgrst reload schema issued
=== ALL POST-APPLY ASSERTIONS PASSED ===
```

## Verification

- `npx tsc --noEmit`: clean.
- `phase56` project: 99 passed, 12 skipped. `phase59`: 11 passed, 95 skipped (fixme / live self-skip). `phase15-stubs rls-org-scope`: 3 passed.
- `PHASE56_LIVE=1 ... decision-kinds-live`: 4 passed (all eighteen kinds land, including the three new ones).
- `PHASE59_LIVE=1 ... ledger-rls-live`: 5 passed, run once (worker 0 rows, supervisor 0 rows, admin own org only, authenticated insert refused, update / delete change nothing).

## Deviations from Plan

**1. [Rule 1 - Bug] Applier asserted the append-only triggers as `tgenabled = 'O'`**
- **Found during:** Task 3 apply. 00070 sets `enable always` on both triggers, so the live state is `A`, and the first assertion run reported a false FAIL.
- **Fix:** the assertion accepts `O` or `A`. Both triggers confirmed present and enabled. No schema change.
- **Commit:** e677955f

**2. [Rule 3 - Blocking] `tests/phase56/decision-shape.spec.ts` pinned DECISION_KINDS to the 00070 check**
- It went red once the list grew (found by running the whole phase56 project). Repointed to the check in 00073, which carries the full list. Not in the plan's file list; the inventory already lists phase56 kind pins as repoint work.
- **Commit:** e677955f

**3. [Plan note] ledger-read spec** also gained a groups/labels case and a "kind check only, no policy" case beyond the listed behaviours.

STATE.md and ROADMAP.md untouched; no push (orchestrator owns both).

## Known Stubs

`listDecisions` cases in `tests/phase59/ledger-read.spec.ts` stay `test.fixme` for 59-10.

## Threat Flags

None. The only live rows written are the phase56 samples (plain words, no email) in the eval-site org, permanent by design.

## Self-Check: PASSED

- Files exist: 00073_office_ledger.sql, apply-phase59-migration.mjs, src/lib/decisions/read.ts.
- Commits in `git log`: f08ddfa2, d76aa807, e677955f.
