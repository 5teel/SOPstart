---
phase: 02-document-intake
plan: "00"
subsystem: testing
tags: [playwright, test-stubs, fixme, phase2, document-intake]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Playwright test infrastructure, test.fixme pattern, playwright.config.ts

provides:
  - Playwright test stubs for all 7 Phase 2 requirements (PARSE-01 through PARSE-07)
  - sop-upload.test.ts — 6 fixme stubs covering PARSE-01 and PARSE-02
  - sop-parsing.test.ts — 5 fixme stubs covering PARSE-03 and PARSE-04
  - sop-review.test.ts — 8 fixme stubs covering PARSE-05, PARSE-06, and PARSE-07
  - phase2-stubs Playwright project entry for test discovery

affects:
  - 02-01-upload
  - 02-02-parsing
  - 02-03-review

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "test.fixme pattern for stub inventory: all stubs skipped but discovered, zero CI failures"
    - "Named Playwright projects per phase for selective test targeting"

key-files:
  created:
    - tests/sop-upload.test.ts
    - tests/sop-parsing.test.ts
    - tests/sop-review.test.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "Added phase2-stubs project to playwright.config.ts: new test files were not matched by the existing integration/e2e projects — without this addition the stubs would not be discovered by the test runner"

patterns-established:
  - "Phase Wave 0 pattern: create test stubs before implementation so executors have a clear requirement target per plan"
  - "Playwright project per phase-group: add a named project matching sop-* files so phase stubs run as a unit"

requirements-completed:
  - PARSE-01
  - PARSE-02
  - PARSE-03
  - PARSE-04
  - PARSE-05
  - PARSE-06
  - PARSE-07

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 2 Plan 00: Document Intake Test Stubs Summary

**19 Playwright test.fixme stubs across 3 files covering all PARSE-01 through PARSE-07 requirements, zero test suite failures**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T05:06:11Z
- **Completed:** 2026-03-24T05:07:50Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Created 3 test stub files covering all 7 Phase 2 requirements
- 19 total test.fixme stubs providing a concrete implementation target per requirement
- Updated playwright.config.ts with a phase2-stubs project so all new stubs are discovered and run
- Full test suite runs 36 tests, 36 skipped, 0 failures

## Task Commits

1. **Task 1: Create test stub files for all Phase 2 requirements** - `960085f` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `tests/sop-upload.test.ts` — 6 fixme stubs for PARSE-01 (docx upload, drag-and-drop, batch, rejection) and PARSE-02 (PDF upload)
- `tests/sop-parsing.test.ts` — 5 fixme stubs for PARSE-03 (auto-parse, section flexibility, realtime status, error handling) and PARSE-04 (image extraction)
- `tests/sop-review.test.ts` — 8 fixme stubs for PARSE-05 (side-by-side review, re-parse), PARSE-06 (inline edit, approval reset), PARSE-07 (draft state, publish gate, publish, delete)
- `playwright.config.ts` — Added `phase2-stubs` project with `testMatch: /sop-upload|sop-parsing|sop-review/`

## Decisions Made

- Added `phase2-stubs` project to playwright.config.ts because the new test files were not matched by the existing `integration` or `e2e` projects (which use specific regex patterns). Without the addition, `npx playwright test` would not discover the files and the verification command would return "No tests found". This is a necessary configuration change to maintain the Wave 0 invariant that all stubs run as part of the test suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added phase2-stubs Playwright project for test discovery**
- **Found during:** Task 1 (verification step)
- **Issue:** New test files did not match any existing Playwright project regex (`/rls-isolation|auth-flows/` or `/offline-indicator/`), causing `npx playwright test` to report "No tests found"
- **Fix:** Added a `phase2-stubs` project entry with `testMatch: /sop-upload|sop-parsing|sop-review/` to playwright.config.ts
- **Files modified:** playwright.config.ts
- **Verification:** Full suite ran 36 tests, 36 skipped, 0 failures
- **Committed in:** `960085f` (included in task commit)

---

**Total deviations:** 1 auto-fixed (missing critical — test discovery config)
**Impact on plan:** Essential for the verification invariant. No scope creep.

## Issues Encountered

None — single fix required for Playwright project configuration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 PARSE requirement stubs exist and are discoverable
- Executors for plans 02-01 through 02-03 have a clear test target: implement code until the fixme stubs in their respective file can be un-fixme'd and pass
- No blockers for Phase 2 plan execution

---
*Phase: 02-document-intake*
*Completed: 2026-03-24*
