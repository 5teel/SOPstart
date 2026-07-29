---
phase: 40-shared-creation-foundation
plan: 01
subsystem: testing
tags: [playwright, nyquist-harness, publish-gate, source-contract]

# Dependency graph
requires: []
provides:
  - phase40 Playwright project registration (single testMatch entry point for the whole phase)
  - Seven tests/phase40/*.spec.ts files: one LIVE guard (spine-freeze) + six test.fixme stubs with real assertion bodies waiting for their activating plans
affects: [40-02, 40-03, 40-04, 40-05, 40-06, 40-07, 40-08, 40-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-wide Playwright project with a deliberately broad testMatch (tests/phaseNN/**) so no later plan needs a config edit (mirrors phase26/28/29/30/32/33/34/35/36/37)"
    - "test.fixme per-test (not test.describe.fixme) so each stub carries a real, individually-activatable assertion body rather than a placeholder"
    - "Every source-contract spec normalizes CRLF via .replace(/\\r\\n/g, '\\n') before matching literals (CLAUDE.md 2026-07-18 worktree learning)"

key-files:
  created:
    - tests/phase40/spine-freeze.spec.ts
    - tests/phase40/dup01-file-intake.spec.ts
    - tests/phase40/dup02-metadata-picker.spec.ts
    - tests/phase40/dup03-job-progress.spec.ts
    - tests/phase40/dup04-page-shell.spec.ts
    - tests/phase40/dat01-category-column.spec.ts
    - tests/phase40/dat01-migration.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "Used test.fixme(name, fn) per assertion (not test.describe.fixme wrapping live test() blocks) so each fixme stub can be individually un-fixme'd by a later plan without restructuring the file"
  - "spine-freeze.spec.ts slices assertPublishGates' body to the next top-level export before checking for unverified_blocks/status: 400, so the assertion is scoped to the actual guard body rather than the whole file"

patterns-established:
  - "Pattern: category_tag sweep uses a negative-lookahead regex (/category_tag(?!s)/) to exclude the unrelated blocks.category_tags array column — a scope note directly from the plan text"

requirements-completed: [DUP-01, DUP-02, DUP-03, DUP-04, DAT-01]

duration: 20min
completed: 2026-07-29
---

# Phase 40 Plan 01: Shared Creation Foundation — Nyquist Harness Summary

**Registered the `phase40` Playwright project and landed a live regression guard on the frozen publish spine (`assertPublishGates`), plus six `test.fixme` stubs with real assertion bodies for every remaining Phase 40 requirement.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-29T07:00Z
- **Tasks:** 2/2 completed
- **Files modified:** 8 (1 modified, 7 created)

## Accomplishments
- `phase40` Playwright project registered in `playwright.config.ts` with `testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/` — no later plan in this phase needs a config edit
- `spine-freeze.spec.ts` is LIVE from this plan onward: pins `assertPublishGates` export, the `unverified_blocks` + `status: 400` gate body, and the publish route's call site — protects the frozen parse→AI-review→verify→publish spine before Plan 40-05 edits `publish-core.ts`
- Six `test.fixme` spec files (24 individually-fixme'd tests) with real, executable assertion bodies encoding every D-* decision from CONTEXT.md for DUP-01..04 and DAT-01, ready to be un-fixme'd by their respective later plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the phase40 Playwright project** - `ec61fc9` (feat)
2. **Task 2: Create the seven wave-0 spec files** - `9ba8a78` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `playwright.config.ts` - Appended `phase40` project entry after `phase37`, matching its shape exactly
- `tests/phase40/spine-freeze.spec.ts` - LIVE guard on `assertPublishGates` (frozen publish spine)
- `tests/phase40/dup01-file-intake.spec.ts` - fixme, activates 40-02/40-07 (shared `@/lib/upload/file-intake`)
- `tests/phase40/dup02-metadata-picker.spec.ts` - fixme, activates 40-08 (shared `SopMetadataFields`)
- `tests/phase40/dup03-job-progress.spec.ts` - fixme, activates 40-03 (shared `ParseJobStatus` + `job-stages.ts`)
- `tests/phase40/dup04-page-shell.spec.ts` - fixme, activates 40-09 (shared `AdminPageShell`)
- `tests/phase40/dat01-category-column.spec.ts` - fixme, activates 40-04/40-05 (`sops.category_slug` read/write sites)
- `tests/phase40/dat01-migration.spec.ts` - fixme, activates 40-04/40-06 (migration 00058 + applier/backfill/verify scripts)

## Decisions Made
- Used per-test `test.fixme(name, fn)` instead of `test.describe.fixme(...)` wrapping live `test()` calls — this lets a later plan un-fixme one assertion at a time if a stub's body needs adjustment before the whole file goes live, and keeps `--list` output showing individually-named (not blanket-grouped) pending tests.
- `spine-freeze.spec.ts` locates `assertPublishGates`'s body by slicing from its declaration to the next top-level `\nexport `, so the `unverified_blocks`/`status: 400` assertion is scoped to the actual gate function rather than merely "somewhere in the file" (avoids a false pass if those literals ever appear elsewhere, e.g. in `performPublish`'s error propagation).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `phase40` project is the single registration point for the rest of the phase — Plans 40-02 through 40-09 drop specs into `tests/phase40/` with zero config edits.
- The publish spine has a live regression net before any plan touches `publish-core.ts`.
- Ready for 40-02 (file-intake extraction) and other Wave-1+ plans in this phase.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
