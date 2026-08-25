---
phase: 46-capability-matrix
plan: 01
subsystem: testing
tags: [playwright, rls, source-contract, capability-matrix, guard-wiring]

# Dependency graph
requires: []
provides:
  - phase46 Playwright project registered (broad tests/phase46/** testMatch)
  - tests/phase46/capability-matrix-doc.spec.ts (CAP-01 source-contract gate, fixme pending 46-02)
  - tests/phase46/sop-edit-guard-wiring.spec.ts (CAP-02 guard-exists-AND-is-called gate, fixme pending 46-03)
  - tests/phase46/sop-edit-owner-access.spec.ts (CAP-02 live RLS probe set, fixme pending 46-03)
affects: [46-02, 46-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fnBody(source, exportedName) slice helper: proves a guard is CALLED inside a function's body, not merely present somewhere in the file; throws if the function anchor is renamed/removed"
    - "Live RLS probes re-read the target row with the service-role client after every write attempt (an RLS-denied PostgREST UPDATE returns success with 0 rows affected, never an error)"

key-files:
  created:
    - tests/phase46/capability-matrix-doc.spec.ts
    - tests/phase46/sop-edit-guard-wiring.spec.ts
    - tests/phase46/sop-edit-owner-access.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "All 24 tests marked test.fixme('title', callback) — the whole-test form, matching the dat01-category-column.spec.ts / phase37 Wave-0 precedent — so the guard/doc contracts are pinned as an inventory without running against not-yet-existing code (guards.ts has no requireSopEditAccess yet, CAPABILITY-MATRIX.md doesn't exist yet)"
  - "sop-edit-owner-access.spec.ts keeps the phase34-style test.skip(!LIVE_ENV_READY) both at the describe level and inside each fixme body, so the live-env gate is already in place when Plan 46-03 removes the fixme markers"

requirements-completed: [CAP-01, CAP-02]

# Metrics
duration: 25min
completed: 2026-08-25
---

# Phase 46 Plan 01: Feedback Harness (Wave 0) Summary

**Registered the phase46 Playwright project and wrote three fixme-marked specs that freeze the exact CAP-01 matrix contract and CAP-02 guard/RLS contract before any implementation exists.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-25T09:28:00Z
- **Completed:** 2026-08-25T09:53:17Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 config edit, 3 new spec files)

## Accomplishments
- `phase46` Playwright project registered with a deliberately broad `tests/phase46/**` testMatch — later plans drop specs in with zero further config edits (CLAUDE.md 2026-05-25 discoverability requirement, verified via `--list`)
- CAP-01 gate pins all 22 required capability rows (one `expect()` each), all 4 org role tokens, the `platform_admin` footnote axis, both D1 channel headings (Access/Obligation), the 3 legend markers, the CAP-02 ownership overlay tokens, and the 5 forward-reference phase markers
- CAP-02 guard-wiring gate proves the guard is CALLED at each of the 9 enumerated content-write call sites (not just present in the file) via a slice-and-throw `fnBody` helper, and proves it does NOT leak into the 4 publish/verify-adjacent functions that must stay admin-only
- CAP-02 live probe set encodes all 7 required outcomes (owner-edit x2, non-owner-worker-denied, non-owner-supervisor-denied, admin-regression, cross-org-isolation, owner-cannot-publish) against real ephemeral-org RLS, each with a service-client re-read after the write attempt

## Task Commits

1. **Task 1: Register the phase46 Playwright project and write the CAP-01 doc gate** - `a19fdab` (test)
2. **Task 2: Write the CAP-02 guard-wiring source-contract gate** - `a4409c4` (test)
3. **Task 3: Write the CAP-02 live RLS probe set (ephemeral org, positive + negative per role)** - `f867417` (test)

_No plan-metadata commit prior to this SUMMARY — this commit sequence is the plan's full task set; the SUMMARY/STATE/ROADMAP commit follows separately per the execution protocol._

## Files Created/Modified
- `playwright.config.ts` - added the `phase46` project entry (testDir `.`, testMatch `/tests\/phase46\/.*\.(spec|test)\.ts$/`)
- `tests/phase46/capability-matrix-doc.spec.ts` - CAP-01 source-contract gate over `.planning/codebase/CAPABILITY-MATRIX.md` + `CLAUDE.md` pointer
- `tests/phase46/sop-edit-guard-wiring.spec.ts` - CAP-02 guard-exists-AND-is-called gate over `src/lib/auth/guards.ts`, `src/actions/sections.ts`, `src/actions/sop-section-blocks.ts`, and the legacy PATCH route
- `tests/phase46/sop-edit-owner-access.spec.ts` - CAP-02 live RLS probe set (ephemeral org/member/SOP/section/step fixtures mirrored from `tests/phase34/observation-read-role-scope.spec.ts`)

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria verified directly:
- `npx playwright test --list --project=phase46` lists all 3 spec files, 24 tests total
- `npx playwright test --project=phase46` exits 0, all 24 tests reported as skipped/fixme (0 failures, 0 unexpected passes)
- `npx tsc --noEmit` passes clean
- `npx playwright test --project=phase15-stubs` still green (92 passed, 4 skipped) — no cross-project regression from the config edit
- Per-task greps (`capability-matrix-doc` count 9, `sop-edit-guard-wiring` count 8, `sop-edit-owner-access` count 7, `Export training records` count 1, `throw new Error` count 1, service-client re-read count 7) all match the plan's stated expectations

## Known Stubs

Every assertion in all three spec files targets code/docs that do not exist yet (`.planning/codebase/CAPABILITY-MATRIX.md`, `requireSopEditAccess` in `src/lib/auth/guards.ts`, migration `00063_sop_content_owner_edit.sql`). This is the intended Wave-0 state — each test carries a `// activated by plan 46-02` or `// activated by plan 46-03` comment naming the plan that removes its `test.fixme` marker. Not a gap; this plan's explicit deliverable is the frozen contract, not the implementation.

## Self-Check: PASSED

- FOUND: playwright.config.ts (phase46 project entry present)
- FOUND: tests/phase46/capability-matrix-doc.spec.ts
- FOUND: tests/phase46/sop-edit-guard-wiring.spec.ts
- FOUND: tests/phase46/sop-edit-owner-access.spec.ts
- FOUND: a19fdab (test(46-01): register phase46 Playwright project and CAP-01 doc gate)
- FOUND: a4409c4 (test(46-01): write the CAP-02 guard-wiring source-contract gate)
- FOUND: f867417 (test(46-01): write the CAP-02 live RLS probe set (ephemeral org))
