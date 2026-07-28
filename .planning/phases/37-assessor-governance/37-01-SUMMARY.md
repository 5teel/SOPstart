---
phase: 37-assessor-governance
plan: 01
subsystem: testing
tags: [playwright, zod, supabase-migration, rls, validators]

# Dependency graph
requires:
  - phase: 34-supervisor-observations
    provides: sop_observations table + insert_recorder RLS policy (migration 00052)
  - phase: 36-refresher-cadence-version-currency
    provides: playwright.config.ts phase36 project idiom (broad testMatch precedent)
provides:
  - phase37 Playwright project (broad tests/phase37/** testMatch) with all 6 Wave-0 specs discoverable
  - CMP-04 north-star guard live from Wave 0 -- no worker-reachable file contains assessor-gate vocabulary
  - Migration 00056 file (not yet pushed) with override audit columns, CHECK constraints, and the insert-policy override-role backstop
  - overrideReason field on RecordObservationSchema and SignOffSchema (layer 1 of 3)
affects: [37-02, 37-03, 37-04, 37-05, 37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-file fs.existsSync + test.skip guard with per-token expect().not.toContain() assertions -- names the exact leaked token on failure, simpler than the phase35/36 GATE_PATTERN regex idiom since ASR-01 forbids specific vocabulary rather than any comparison/if-branch on a field name"
    - "Migration adds a single narrow SQL-expressible backstop (plain supervisor cannot self-stamp is_assessor_override) while explicitly declining to re-implement the full assessor predicate in SQL -- avoids a second source of truth for lineage-aware logic that belongs in src/lib/competency/assessor.ts (37-02)"

key-files:
  created:
    - tests/phase37/no-competency-gate-worker.spec.ts
    - tests/phase37/override-audit-schema.spec.ts
    - tests/phase37/assessor-gate.spec.ts
    - tests/phase37/assessor-ui-observation.spec.ts
    - tests/phase37/assessor-ui-signoff.spec.ts
    - tests/phase37/bootstrap-override-runtime.spec.ts
    - supabase/migrations/00056_assessor_governance.sql
  modified:
    - playwright.config.ts
    - src/types/database.types.ts
    - src/lib/validators/observations.ts
    - src/lib/validators/completions.ts

key-decisions:
  - "overrideReason uses z.string().trim().min(10).max(500).optional() on both schemas -- matches the existing signOffCompletion rejection-reason floor exactly (one reason-quality bar, not two)"
  - "No isOverride/bypassGate boolean added to either schema -- override status is derived server-side (37-03/37-04) from the recomputed predicate + caller role, never trusted from the client (T-37-01-01 mitigation)"
  - "sop_observations not added to database.types.ts -- table is deliberately accessed via (supabase as any) casts per existing departments.ts/org-model.ts/approvals.ts precedent; only completion_sign_offs and worker_notifications were hand-extended"

patterns-established:
  - "phase37 Playwright project registered with the now-standard broad tests/phase37/** testMatch (mirrors phase26/28/29/30/32/33/34/35/36) -- later plans in this phase drop specs in with zero config edits"

requirements-completed: [ASR-01]

# Metrics
duration: ~25min
completed: 2026-07-28
---

# Phase 37 Plan 01: Assessor Governance Harness Summary

**Registered the phase37 Nyquist Playwright project with 6 specs (2 live, 4 test.fixme), wrote migration 00056 as a file (override audit columns + CHECK constraints + insert-policy override-role backstop, unpushed), hand-extended database.types.ts, and added a Zod-validated overrideReason field to both write schemas.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 10 (7 created, 3 modified: playwright.config.ts, database.types.ts, plus the 2 validator files also counted as created content additions)

## Accomplishments
- `phase37` Playwright project discoverable (`npx playwright test --list --project=phase37` lists all 6 spec files, 62 total test cases)
- CMP-04 north star locked and passing from Wave 0: none of the six worker-reachable files (ReadTab, worker SOP detail page, worker SOP library page, SopLibraryCard, CompetencySection, classify.ts) contain any of the six assessor-governance vocabulary tokens
- Migration 00056 written (not pushed to live DB — that's a [BLOCKING] task in 37-03): 5 additive columns, 2 named CHECK constraints, `sop_observations_insert_recorder` re-created with the T-37-01-02 override-role backstop, zero `create table` statements (D-07 satisfied via stamped columns)
- `completion_sign_offs` and `worker_notifications` typed for the new columns in `database.types.ts`
- `overrideReason` validated (10-500 char, trimmed, optional) on both `RecordObservationSchema` and `SignOffSchema`; zero client-supplied override-flag fields anywhere

## Task Commits

1. **Task 1: Register the phase37 Playwright project and create all six Wave-0 specs** - `6358aa2` (feat)
2. **Task 2: Migration 00056 — override audit columns, CHECK constraints, insert-policy override clause, notification subject column** - `c45faf0` (feat)
3. **Task 3: overrideReason on both write schemas** - `4b02560` (feat)

## Files Created/Modified
- `playwright.config.ts` - Added `phase37` project (broad `tests/phase37/**` testMatch, mirrors phase36 idiom)
- `tests/phase37/no-competency-gate-worker.spec.ts` - CMP-04 north star: 6 forbidden tokens × 6 target files, per-file `fs.existsSync` guard, live from Wave 0
- `tests/phase37/override-audit-schema.spec.ts` - Migration/types/validator schema-contract assertions, live at end of this plan
- `tests/phase37/assessor-gate.spec.ts` - 5 `test.fixme` runtime stubs for the `recordObservation` predicate gate (flips live 37-03)
- `tests/phase37/assessor-ui-observation.spec.ts` - 6 `test.fixme` runtime stubs for the record-modal UI (flips live 37-05)
- `tests/phase37/assessor-ui-signoff.spec.ts` - 4 `test.fixme` runtime stubs for the sign-off UI (flips live 37-04)
- `tests/phase37/bootstrap-override-runtime.spec.ts` - 2 `test.fixme` runtime stubs for the zero-assessor-org bootstrap probe (flips live 37-06)
- `supabase/migrations/00056_assessor_governance.sql` - Override audit columns on `sop_observations`/`completion_sign_offs`, `worker_notifications.subject_user_id`, re-created `sop_observations_insert_recorder` policy
- `src/types/database.types.ts` - Hand-extended `completion_sign_offs` (Row/Insert/Update) and `worker_notifications` (Row/Insert/Update) for the new columns
- `src/lib/validators/observations.ts` - `overrideReason` added to `RecordObservationSchema`
- `src/lib/validators/completions.ts` - `overrideReason` added to `SignOffSchema`

## Decisions Made
- `overrideReason` mirrors the existing 10-char rejection-reason floor in `signOffCompletion` exactly — same threshold, one quality bar for the whole sign-off surface
- No client-supplied override boolean anywhere (mirrors D-10's server-resolved `sop_version` pattern) — override status is always recomputed server-side in 37-03/37-04
- `sop_observations` deliberately NOT added to `database.types.ts` per the plan's explicit instruction — that table stays on the `(supabase as any)` cast precedent to avoid forcing unrelated edits across `observations.ts`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration 00056 exists only as a file; it is NOT pushed to the live database (that push is an explicit [BLOCKING] task in plan 37-03, per this plan's `<objective>`).

## Next Phase Readiness

- `phase37` harness and CMP-04 north-star guard are live; every subsequent Phase 37 plan can drop specs into `tests/phase37/` with zero config edits and flip the relevant `test.fixme` stub live
- Migration 00056 is ready to push in 37-03 alongside the `isSignedOffAssessor` predicate and `recordObservation` gate wiring
- `overrideReason` is available on both write schemas for 37-03 (observations) and 37-04 (sign-offs) to consume
- No blockers

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*
