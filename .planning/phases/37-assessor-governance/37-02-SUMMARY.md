---
phase: 37-assessor-governance
plan: 02
subsystem: competency
tags: [supabase, typescript, playwright, competency, assessor-governance]

# Dependency graph
requires:
  - phase: 35-competency-classifier-training-matrix
    provides: classifyCompetency (the state ladder + D-02 needs_support reset)
  - phase: 36-refresher-cadence-version-currency
    provides: resolveLineage (version-lineage evidence widening, CMP-03)
provides:
  - isSignedOffAssessor(personId, sopId, client, orgId) — the sole derived assessor predicate (D-01)
  - behavioural unit test coverage proving D-01, D-02 (both reset orderings), CMP-03 lineage widening, and both deny-by-default paths
affects: [37-assessor-governance remaining plans (bootstrap override + gated write paths)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Assessor governance is 100% derived — no designation table; a single predicate composes the Phase 35 classifier + Phase 36 lineage resolver"
    - "Plain (non-'use server') module for any function taking a caller-supplied DB client + orgId, to avoid a parameter-trusting free POST endpoint"
    - "Fail-closed authorization predicate: any missing/errored evidence read yields false, never true"

key-files:
  created:
    - src/lib/competency/assessor.ts
    - src/lib/competency/__tests__/assessor.test.ts
  modified: []

key-decisions:
  - "isSignedOffAssessor makes exactly one competency decision (the final === 'competent_signed_off' comparison) — no re-implemented ladder/reset/lineage logic"
  - "No department parameter or filter anywhere in the predicate — D-02 makes assessorship org-wide"
  - "Every evidence query self-enforces organisation_id scope since the caller passes a service-role client that bypasses RLS"

patterns-established:
  - "Behavioural unit tests for a client-taking module use a chainable stub Supabase client (select/eq/in/or/order no-ops + thenable + maybeSingle), exercising the real composed modules (resolveLineage, classifyCompetency) rather than mocking them"

requirements-completed: [ASR-01]

# Metrics
duration: 15min
completed: 2026-07-28
---

# Phase 37 Plan 02: Assessor Predicate Summary

**`isSignedOffAssessor` — the single derived predicate composing Phase 35's classifier and Phase 36's lineage resolver, with 8 behavioural unit tests proving D-01/D-02/CMP-03 semantics survive unforked.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `src/lib/competency/assessor.ts` exports `isSignedOffAssessor(personId, sopId, client, orgId)`, org-scoped, fail-closed, zero forked ladder logic
- 8 behavioural unit tests in the existing `phase35-unit` Playwright project, all green, exercising the real `resolveLineage` + `classifyCompetency` against a stub Supabase client

## Task Commits

Each task was committed atomically:

1. **Task 1: src/lib/competency/assessor.ts — isSignedOffAssessor** - `bc11dc0` (feat)
2. **Task 2: Behavioural unit tests for the predicate in the phase35-unit project** - `906bd58` (test)

## Files Created/Modified
- `src/lib/competency/assessor.ts` - the sole assessor predicate: fetches the target SOP (org-scoped), widens evidence via `resolveLineage`, fetches completions/sign-offs/observations (all org-scoped), reduces to `CompetencyEvidence`, and returns `classifyCompetency(evidence).state === 'competent_signed_off'`
- `src/lib/competency/__tests__/assessor.test.ts` - 8 tests: signed-off-true, completion-only-false, observation-only-false, D-02 reset both orderings, CMP-03 lineage widening, missing-SOP-false, null-org-false

## Decisions Made
- No new decisions beyond what the plan specified — followed the plan's exact query order, evidence-reduction expressions (copied from `getTrainingRecordForPerson`), and error-handling contract (any query error → `false`).

## Deviations from Plan

None — plan executed exactly as written, with one micro-adjustment made during execution: the header comment in `assessor.ts` initially quoted the literal string `'use server'` in prose (to explain what the module deliberately is NOT), which self-tripped the plan's own `grep -c "'use server'" == 0` acceptance criterion. Reworded the comment to describe the concept without the literal quoted token — same information, criterion now passes cleanly. Not a Rule 1-4 deviation (no behavior change), just wording to satisfy the plan's own grep-based acceptance check.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `isSignedOffAssessor` is ready for import into the two gated write paths (bootstrap override + observation-recording action) that later plans in this phase will wire up.
- All acceptance criteria greps verified: zero `'use server'`, exactly one `classifyCompetency(` call, exactly one `resolveLineage(` call, exactly one `competent_signed_off` comparison, zero department references, 3+ `organisation_id` scoping clauses, exactly one export.
- `npx tsc --noEmit` clean; `npx playwright test --project=phase35-unit` green (54/54, including the 8 new tests).

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: src/lib/competency/assessor.ts
- FOUND: src/lib/competency/__tests__/assessor.test.ts
- FOUND: .planning/phases/37-assessor-governance/37-02-SUMMARY.md
- FOUND commit: bc11dc0 (Task 1)
- FOUND commit: 906bd58 (Task 2)
- FOUND commit: 89e239b (SUMMARY.md)
