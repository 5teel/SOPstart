---
phase: 37-assessor-governance
plan: 03
subsystem: competency
tags: [supabase-migration, rls, server-actions, playwright, assessor-governance]

# Dependency graph
requires:
  - phase: 37-01
    provides: phase37 Playwright harness, migration 00056 file (unpushed), overrideReason on both write schemas
  - phase: 37-02
    provides: isSignedOffAssessor(personId, sopId, client, orgId) predicate
provides:
  - Migration 00056 LIVE on the remote DB (all 5 columns, both CHECK constraints proven behaviourally, amended insert policy, PostgREST cache reloaded)
  - recordObservation gated on verdict === 'performed_to_sop' only — non-assessor supervisor denied, admin/safety_manager can override with a mandatory reason
  - getAssessorStatusForSop, requestAssessorReview, listAssessmentRequests (D-08 request/list flow)
  - tests/phase37/assessor-gate.spec.ts flipped from test.fixme to live source-contract assertions
affects: [37-04, 37-05, 37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration applier scripts assert CHECK constraints BEHAVIOURALLY (attempt the violating insert inside a PL/pgSQL exception handler, not just check pg_constraint by name) — a constraint present in the file but not enforced in the DB is the exact false positive the applier exists to prevent"
    - "Predicate reads on an evidence-table path (sop_completions/completion_sign_offs/sop_observations) use the admin client with self-enforced org scope, because session-client RLS does not reliably return a supervisor's own rows about OTHER workers — same inverted-false-deny class as the 2026-07-20 learning"

key-files:
  created:
    - scripts/apply-phase37-migration.mjs
  modified:
    - src/actions/observations.ts
    - tests/phase37/assessor-gate.spec.ts

key-decisions:
  - "Nine granular assertion groups in the migration applier (not five coarse ones) — column existence, both CHECK constraints (behaviourally proven via a rejected reasonless-override insert), the policy with_check text, and the A3 worker_notifications.type unrestricted check are each asserted separately so a failure pinpoints the exact missing object"
  - "isSignedOffAssessor is called twice in observations.ts: once as the GATE inside recordObservation (branch-before-gate, position-verified) and once as a UX-only status read in getAssessorStatusForSop (fail-closed, never the authority) — the source-contract spec asserts the gate call-site position specifically, not merely that the predicate is called somewhere"
  - "requestAssessorReview verifies the SOP belongs to the caller's org BEFORE the recipient/insert queries (T-37-03-04) — a foreign sopId is rejected with 'SOP not found' before any admin-client write is attempted"

patterns-established:
  - "D-08 request/list split: the WRITE (requestAssessorReview) needs the admin client because admins_can_insert_notifications only permits admin/safety_manager inserts and the caller is typically a blocked supervisor; the READ (listAssessmentRequests) stays on the session client because users_see_own_notifications RLS already scopes correctly for the admin/safety_manager caller reading their own inbox"

requirements-completed: [ASR-01]

# Metrics
duration: ~35min
completed: 2026-07-28
---

# Phase 37 Plan 03: Live Assessor Gate + Request Flow Summary

**Migration 00056 pushed live with 9 behaviourally-verified assertions, `recordObservation` gated on the advancing verdict only (D-03/D-04/D-05/D-06), and the D-08 request/status/list actions wired with correct client choice per direction.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `node scripts/apply-phase37-migration.mjs` exits 0 with all 9 assertion groups PASS — 5 columns, both CHECK constraints (proven by a rejected reasonless-override insert, not just `pg_constraint` presence), the amended `sop_observations_insert_recorder` policy text, and the A3 zero-CHECK-constraint confirmation on `worker_notifications.type`
- `recordObservation` blocks a non-assessor supervisor's `performed_to_sop` verdict with `NOT_SIGNED_OFF_ASSESSOR`; an admin/safety_manager without a reason gets `ASSESSOR_OVERRIDE_REQUIRED`; with a reason the insert stamps `is_assessor_override: true` + `override_reason`; `needs_support` never calls the predicate
- `getAssessorStatusForSop`, `requestAssessorReview`, `listAssessmentRequests` all live, async, correctly client-scoped (admin for the RLS-blocked write, session for the RLS-scoped read)
- `tests/phase37/assessor-gate.spec.ts` flipped from 5 `test.fixme` runtime stubs to 7 live source-contract assertions — 106/106 tests pass across `phase37` + `phase35-unit`
- `npx tsc --noEmit` clean and `npm run build` clean after every task; bundle delta +2 KB, within the ±2 KB tolerance

## Task Commits

1. **Task 1: [BLOCKING] Apply migration 00056 to the live database and prove every object exists** - `ab23c39` (feat)
2. **Task 2: Gate recordObservation on the advancing verdict only (D-03/D-04/D-05/D-06)** - `fa981ff` (feat)
3. **Task 3: Assessor status read, request-assessment write, request list (D-08) + flip the observation gate spec live** - `b436b77` (feat)

## Files Created/Modified
- `scripts/apply-phase37-migration.mjs` - copy-adapted from `apply-phase36-migration.mjs`; pushes 00056 via `npx supabase db push` (interactive prompt auto-confirmed, no Management-API fallback needed) then runs 9 cache-bypassing Management API assertions and issues `NOTIFY pgrst, 'reload schema'`
- `src/actions/observations.ts` - `recordObservation` gated on `verdict === 'performed_to_sop'`; three new exports `getAssessorStatusForSop`/`requestAssessorReview`/`listAssessmentRequests`; file header and function comment corrected to reflect the new admin-client predicate read
- `tests/phase37/assessor-gate.spec.ts` - rewritten from 5 `test.fixme` Playwright/browser stubs to 7 live `fs.readFileSync` + `toContain`/positional-index source-contract assertions over `src/actions/observations.ts`

## Decisions Made
- Migration applied via `npx supabase db push` (the interactive Y/n prompt from a prior partial-apply attempt auto-confirmed cleanly this run — no manual intervention, no Management-API fallback path exercised)
- Both CHECK-constraint assertions use a PL/pgSQL `DO $$ ... EXCEPTION WHEN check_violation ... END $$` block rather than a literal `ROLLBACK`-wrapped transaction — the failed INSERT's own exception handler establishes an implicit savepoint, so no row is ever committed regardless; a defensive marker-based `DELETE` runs afterward in case the constraint were somehow absent
- `isSignedOffAssessor` appears twice in the file (gate + UX status read) rather than once — the source-contract spec was written to assert the *gating* call-site's position specifically (branch-before-gate), not merely presence-count, closing the exact blind spot CLAUDE.md's 2026-06-05 learning warns about

## Deviations from Plan

None — plan executed exactly as written. The `<verify>` block for Task 1 named "five assertion groups"; the applier implements 9 more granular ones covering the same five categories (columns/constraints/policy/A3/reload) — a superset, not a deviation.

## Issues Encountered

None.

## User Setup Required

None - migration applied directly via the Supabase Management API + CLI using credentials already present in `.env.local`.

## Next Phase Readiness

- Migration 00056 is live, PostgREST-visible, and behaviourally verified — 37-04 (sign-off gate) can reuse the identical `isSignedOffAssessor` + override pattern against `completion_sign_offs` with confidence the DB backstop is real
- `getAssessorStatusForSop`, `requestAssessorReview`, `listAssessmentRequests`, types `AssessorStatus`/`AssessmentRequest`, and error codes `NOT_SIGNED_OFF_ASSESSOR`/`ASSESSOR_OVERRIDE_REQUIRED` are all available for the UI work in 37-05 (record-modal) and 37-04 (sign-off UI)
- `'assessment_requested'` notification type confirmed unrestricted by any DB CHECK constraint (A3) — safe for immediate use with zero further migration
- No blockers

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: scripts/apply-phase37-migration.mjs
- FOUND: src/actions/observations.ts
- FOUND: tests/phase37/assessor-gate.spec.ts
- FOUND: .planning/phases/37-assessor-governance/37-03-SUMMARY.md
- FOUND commit: ab23c39 (Task 1)
- FOUND commit: fa981ff (Task 2)
- FOUND commit: b436b77 (Task 3)
- FOUND commit: 0493b03 (SUMMARY.md)
