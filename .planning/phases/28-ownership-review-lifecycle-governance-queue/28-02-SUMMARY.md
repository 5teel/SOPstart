---
phase: 28-ownership-review-lifecycle-governance-queue
plan: 02
subsystem: testing
tags: [governance, review-cadence, pure-functions, playwright, unit-testing]

# Dependency graph
requires:
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: "sops.owner_user_id/review_due_at/last_reviewed_at columns + sop_review_cadences/sop_review_events tables (28-01)"
provides:
  - "classifyGovernanceRow(input): GovernanceFlag[] — pure unowned/overdue/due_soon/stale_role classification (OWN-03/GQ-01/GQ-03)"
  - "resolveCadenceMonths/computeReviewDueDate — pure cadence resolution + due-date math (REV-01)"
  - "phase28-unit + phase28 Playwright projects — single registration point for all later phase28 plans' specs"
affects: [28-03, 28-04, 28-05, governance-queue-page, sop-review-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure sync classifier/cadence modules outside any 'use server' file (2026-06-27 learning) — composable by both actions and backfill scripts"
    - "phase28-unit (testDir-scoped) + phase28 (broad testMatch) Playwright project pair mirrors phase26/phase27 exactly"

key-files:
  created:
    - src/lib/governance/classify.ts
    - src/lib/governance/cadences.ts
    - src/lib/governance/__tests__/classify.test.ts
    - tests/phase28/governance-modules.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "Reworded classify.ts/cadences.ts header comments to avoid the literal string 'use server' (even in prose) — it was matched by both the grep -L acceptance check and the source-contract spec's not.toContain assertion, producing false negatives"
  - "Added tests/phase28/governance-modules.spec.ts (source-contract check on the two new modules) so the broad phase28 project is non-empty at Wave 1 — otherwise `npx playwright test --list --project=phase28` exits 1 (No tests found) until 28-03/04/05 land real specs, breaking the plan's own chained verify command"

patterns-established:
  - "Pure-helper placement discipline (classify.ts/cadences.ts) matches version-lineage.ts precedent exactly — future governance actions import from here, never redefine"

requirements-completed: [OWN-03, REV-01, GQ-01, GQ-03]

# Metrics
duration: 20min
completed: 2026-07-12
---

# Phase 28 Plan 02: Pure Governance Classifier + Cadence Modules Summary

**classifyGovernanceRow (unowned/overdue/due_soon/stale_role) and resolveCadenceMonths/computeReviewDueDate as pure, DB-free modules, unit-tested 10/10 green under a newly registered phase28-unit Playwright project.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-12T06:48:00Z
- **Completed:** 2026-07-12T07:08:11Z
- **Tasks:** 2 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `classifyGovernanceRow` implements all four D28-02/D28-05/D28-06 branches (unowned, overdue, due_soon, stale_role) with co-occurring flags supported
- `resolveCadenceMonths` resolution order verified: per-SOP override > org category > org default > 12-month fallback (D28-03/REV-01)
- `computeReviewDueDate` advances an ISO date by N months deterministically
- `phase28-unit` (testDir-scoped, static `@/` imports) and `phase28` (broad `tests/phase28/**`) Playwright projects registered — single config edit point for the rest of the phase
- 10/10 unit test cases green covering every classification branch and cadence-resolution order

## Task Commits

1. **Task 1: Pure classifier + cadence modules** - `19f11c4` (feat)
2. **Task 2: Register phase28 Playwright projects + unit spec** - `f03438f` (test)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP) follows below._

## Files Created/Modified
- `src/lib/governance/classify.ts` - `classifyGovernanceRow()`, `GovernanceFlag`, `GovernanceInput`, `DUE_SOON_WINDOW_DAYS` — pure, no server directive
- `src/lib/governance/cadences.ts` - `resolveCadenceMonths()`, `computeReviewDueDate()` — pure, no server directive
- `src/lib/governance/__tests__/classify.test.ts` - 10 static-import unit cases (phase28-unit project)
- `tests/phase28/governance-modules.spec.ts` - source-contract check keeping the broad `phase28` project non-empty until 28-03/04/05 add real specs
- `playwright.config.ts` - added `phase28-unit` (testDir `./src/lib/governance/__tests__`) and `phase28` (testMatch `tests/phase28/**`) projects, mirroring the `phase27-unit`/`phase26` shapes

## Decisions Made
- Reworded module header comments to avoid the literal substring `'use server'` — the comments explaining "this file does NOT use `'use server'`" were themselves matched by the plan's own `grep -L "use server"` acceptance check and by a `not.toContain("'use server'")` spec assertion, both looking for absence of the string anywhere in the file. Switched to "no server-action directive" phrasing; behavior/intent unchanged.
- Added a minimal source-contract spec (`tests/phase28/governance-modules.spec.ts`) to the broad `phase28` project. Playwright exits 1 with "No tests found" when a project's `testMatch` matches zero files — since `tests/phase28/` didn't exist yet (28-03/04/05 own the real specs), the plan's chained verify command (`... && npx playwright test --list --project=phase28 ... && ...`) would have failed on a technicality unrelated to this plan's actual deliverables. This keeps the acceptance criterion ("exits 0 (project registered even before stub specs exist)") literally true.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `grep -L`/spec assertion false-negative on comment text**
- **Found during:** Task 2 (running the full verify chain)
- **Issue:** `classify.ts`/`cadences.ts` header comments explained "No `'use server'` directive" — the literal quoted string matched both the plan's `grep -L "use server"` acceptance check (which lists files with NO match) and this plan's own `governance-modules.spec.ts` `not.toContain("'use server'")` assertion, both failing even though neither file actually carries the directive.
- **Fix:** Reworded comments to "no server-action directive" — no functional change, both checks pass.
- **Files modified:** `src/lib/governance/classify.ts`, `src/lib/governance/cadences.ts`
- **Verification:** `grep -L "use server" src/lib/governance/classify.ts src/lib/governance/cadences.ts` now lists both files; `npx playwright test --project=phase28` green.
- **Committed in:** `f03438f` (Task 2 commit)

**2. [Rule 3 - Blocking] Broad `phase28` project had zero matching spec files**
- **Found during:** Task 2 (running the plan's chained verify command)
- **Issue:** `npx playwright test --list --project=phase28` exited 1 ("No tests found") since `tests/phase28/` didn't exist yet — this plan only creates the harness, not the phase's runtime/integration specs (those belong to 28-03/04/05 per the plan's own file-ownership split).
- **Fix:** Added `tests/phase28/governance-modules.spec.ts`, a small source-contract check on the two new pure modules — legitimate coverage, not a placeholder no-op, and keeps the project non-empty for later plans to extend.
- **Files modified:** `tests/phase28/governance-modules.spec.ts` (new)
- **Verification:** `npx playwright test --list --project=phase28` and `npx playwright test --project=phase28` both exit 0 / green.
- **Committed in:** `f03438f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking verification issues, no scope creep beyond making the plan's own verify commands pass)
**Impact on plan:** Both fixes were required for the plan's own stated verification commands to succeed; no architectural changes, no unrequested features.

## Issues Encountered
None beyond the two auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `classifyGovernanceRow`/`resolveCadenceMonths`/`computeReviewDueDate` are ready for 28-03 (`src/actions/governance.ts`) and the `/admin/governance` queue query to import directly — no further schema or pure-logic work needed for OWN-03/REV-01/GQ-01/GQ-03.
- `phase28`/`phase28-unit` Playwright projects are the single registration point for the rest of the phase; 28-03/04/05 drop specs into `tests/phase28/` with zero further config edits.
- No blockers.

---
*Phase: 28-ownership-review-lifecycle-governance-queue*
*Completed: 2026-07-12*

## Self-Check: PASSED

All created files verified present; task commit hashes (`19f11c4`, `f03438f`) verified in git log.
