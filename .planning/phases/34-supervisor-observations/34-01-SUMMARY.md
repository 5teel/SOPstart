---
phase: 34-supervisor-observations
plan: 01
subsystem: testing
tags: [playwright, nyquist, source-contract, rls, tdd-harness]

# Dependency graph
requires: []
provides:
  - phase34 Playwright project registered in playwright.config.ts (broad testMatch tests/phase34/**)
  - 5 Wave-0 stub specs, one per phase requirement + success criterion 4, each naming its live-flip plan
affects: [34-02, 34-03, 34-04, 34-08, 34-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fs.existsSync-guarded source-contract stubs (green when production file absent)"
    - "test.fixme runtime block per spec for live-app/RLS assertions"

key-files:
  created:
    - tests/phase34/record-observation.spec.ts
    - tests/phase34/observation-immutability.spec.ts
    - tests/phase34/worker-observation-visibility.spec.ts
    - tests/phase34/sop-version-stamp.spec.ts
    - tests/phase34/observation-cross-org-isolation.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "Mirrored phase33's project block shape verbatim (testDir '.', broad testMatch) so later Phase 34 plans drop specs in with no config edit"
  - "Guarded every source-contract assertion with fs.existsSync so all 5 specs pass green now, before any production code exists"

patterns-established:
  - "Source-contract guard checks target file existence first (test.skip if absent), then asserts literal strings once present — mirrors phase22 intent-classifier stub idiom"

requirements-completed: [OBS-01, OBS-02, OBS-03]

# Metrics
duration: 12min
completed: 2026-07-20
---

# Phase 34 Plan 01: Nyquist Wave-0 Harness Summary

**Registered the `phase34` Playwright project and 5 stub specs gating OBS-01/02/03 + success criterion 4, all green-when-absent via `fs.existsSync` guards.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T00:00:00Z
- **Completed:** 2026-07-20T00:12:00Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments
- `phase34` Playwright project registered in `playwright.config.ts`, mirroring the phase26/28/29/30/32/33 broad-testMatch convention (`tests/phase34/**`)
- 5 stub specs created — one per phase requirement (OBS-01, OBS-01 append-only, OBS-02, OBS-03) plus the mandatory cross-org isolation proof (success criterion 4)
- All 17 individual test cases pass green (source-contract assertions `test.skip` while target files don't exist yet; runtime assertions are `test.fixme`) — zero failures, exit code 0
- Each spec's header comment names the downstream plan that flips it live (34-03 or 34-04 or 34-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the phase34 Playwright project** - `692a460` (test)
2. **Task 2: Create the 5 Wave-0 stub specs** - `ac250d1` (test)

_No TDD tasks in this plan — both are `type="auto"` infra/harness tasks._

## Files Created/Modified
- `playwright.config.ts` - Added `phase34` project entry (testDir `.`, testMatch `/tests\/phase34\/.*\.(spec|test)\.ts$/`, chromium)
- `tests/phase34/record-observation.spec.ts` - OBS-01 stub: `recordObservation` export, role-array gate, session-client-only insert guard; flips live in 34-04
- `tests/phase34/observation-immutability.spec.ts` - OBS-01 append-only stub: `sop_observations_insert_recorder` policy presence, absence of `for update`/`for delete`; flips live in 34-03
- `tests/phase34/worker-observation-visibility.spec.ts` - OBS-02 stub: profile page observations section reference, `listObservationsForWorker` export; flips live in 34-08
- `tests/phase34/sop-version-stamp.spec.ts` - OBS-03/D-10 stub: server-resolved `sops.version` read + `sop_version: sop.version` insert; flips live in 34-04
- `tests/phase34/observation-cross-org-isolation.spec.ts` - Success criterion 4 stub: `sop_observations_read_org` org-OR-self scope, rejects widened `= any(...)` form; flips live in 34-03

## Decisions Made
- Named the future migration file `supabase/migrations/00052_supervisor_observations.sql` in all stub guards (next sequential migration number after `00051_sops_all_departments_pre_override.sql`) — 34-02 must use this exact filename or the stubs will not flip live automatically.
- Used `test.skip(true, reason)` inside each `fs.existsSync`-guarded assertion (mirrors the phase22 `intent-classifier.spec.ts` idiom cited in the plan's `read_first`) rather than wrapping the whole `test()` body in an `if` with no skip signal — keeps `--list` output informative about which spec is waiting on which plan.
- `worker-observation-visibility.spec.ts`'s profile-page guard checks for the literal substring `'Observation'` before asserting the component-name regex, since the exact component name (`ObservationsSection` per 34-PATTERNS.md) isn't binding until 34-08 actually writes it — avoids a hard-coded string that could mismatch a reasonable naming variant.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npx playwright test --list --project=phase34` lists all 5 spec files (17 individual tests) — verified.
- `npx playwright test --project=phase34` exits 0 (all skipped/fixme, zero failures) — verified.
- Plan 34-02 (migration) can proceed immediately; its file must be named `00052_supervisor_observations.sql` to match the stub guards created here.
- Plans 34-03/34-04/34-08 each flip exactly one or two of these specs from skip/fixme to live per their `<read_first>` cross-references — no further Wave-0 harness work needed.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*
