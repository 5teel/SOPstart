---
phase: 32-visual-org-model-library-permissions
plan: 01
subsystem: testing
tags: [playwright, nyquist-harness, test-infrastructure]

# Dependency graph
requires: []
provides:
  - phase32 Playwright project registered in playwright.config.ts (broad tests/phase32/** testMatch)
  - 8 stub specs (test.fixme) — one per SC-1..SC-6 plus 2 project-learning-mandated runtime guards
affects: [32-04, 32-05, 32-06, 32-07, 32-08, 32-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single registration point per phase (mirrors phase26/28/29/30) — later plans drop specs into tests/phase32/ with no further config edit"
    - "Wave-0 stubs name the real artifact path + owning-plan flip point in a header comment, so the flip is a one-line diff (fixme removal) later"
    - "grants-org-isolation + person-grant-rls carry explicit [2026-06-15] non-permanent-fixme markers per the Phase 25 junction-write cross-tenant learning"

key-files:
  created:
    - tests/phase32/org-chart-build.spec.ts
    - tests/phase32/resolve-access.spec.ts
    - tests/phase32/wiring-at-scale.spec.ts
    - tests/phase32/library-filter-deeplink.spec.ts
    - tests/phase32/wire-up-mode.spec.ts
    - tests/phase32/banner-slot-stability.spec.ts
    - tests/phase32/grants-org-isolation.spec.ts
    - tests/phase32/person-grant-rls.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "Project named `phase32` (not `phase32-stubs`) per plan's explicit instruction — matches the phase26/28/29/30 bare-name convention, overriding 32-VALIDATION.md's `phase32-stubs` naming"
  - "resolve-access.spec.ts flip point mapped to 32-04 (owning plan for resolve-access.ts) even though no later plan's files_modified lists this exact spec path — 32-04 instead adds a dedicated real unit test at src/lib/org-model/__tests__/resolve-access.test.ts; this stub stays a source-contract placeholder"
  - "org-chart-build.spec.ts flip point mapped to 32-07 (not 32-06) — 32-06 builds the chart canvas component only, 32-07's files_modified explicitly lists this spec path and wires /admin/team"

patterns-established:
  - "Wave-0 test.fixme body pattern: async ({ page }) => { void page; expect(true).toBe(true) } with real-path-constant + flip-plan documented in a leading comment block — mirrors tests/phase28/governance-actions.spec.ts fixme shape"

requirements-completed: [SC-1, SC-2, SC-3, SC-4, SC-5, SC-6]

# Metrics
duration: 15min
completed: 2026-07-18
---

# Phase 32 Plan 01: Wave 0 Nyquist Harness Summary

**Registered the `phase32` Playwright project (broad `tests/phase32/**` testMatch) and created 8 test.fixme stub specs — one per success criterion (SC-1..SC-6) plus the two project-learning-mandated runtime guards (grants org-isolation, person-grant RLS) — establishing the single registration point before any Phase 32 code exists.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-18T06:59:59Z
- **Completed:** 2026-07-18T07:19:10Z
- **Tasks:** 2
- **Files modified:** 9 (1 config + 8 new spec files)

## Accomplishments
- `phase32` project registered in `playwright.config.ts`, discoverable via `npx playwright test --list --project=phase32` (8/8 specs found)
- 8 stub spec files created under `tests/phase32/`, each naming the real artifact path(s) it will assert on and its owning-plan flip point
- `npx playwright test --project=phase32` exits green (all 8 fixme/skipped, zero red at phase head)

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the phase32 Playwright project** - `ede77fe` (feat)
2. **Task 2: Create 8 stub specs (one per SC + 2 guards)** - `256fa0e` (test)

## Files Created/Modified
- `playwright.config.ts` - Added `phase32` project block (testDir '.', testMatch `/tests\/phase32\/.*\.(spec|test)\.ts$/`, chromium)
- `tests/phase32/org-chart-build.spec.ts` - SC-1 stub (org chart + Columns toggle + vacancy chips), flips live 32-07
- `tests/phase32/resolve-access.spec.ts` - SC-2 stub (5-level union resolver), flips live 32-04
- `tests/phase32/wiring-at-scale.spec.ts` - SC-3 stub (WiringPatchBay at 15×20 scale), flips live 32-08
- `tests/phase32/library-filter-deeplink.spec.ts` - SC-4 stub (viz-as-filter deep-link), flips live 32-09
- `tests/phase32/wire-up-mode.spec.ts` - SC-5 stub (connect mode + blast radius), flips live 32-08
- `tests/phase32/banner-slot-stability.spec.ts` - SC-6 stub (fixed 48px slot, pixel-identical reflow check), flips live 32-08
- `tests/phase32/grants-org-isolation.spec.ts` - cross-tenant write guard, flips to REAL runtime insert in 32-05 (not permanent fixme, [2026-06-15])
- `tests/phase32/person-grant-rls.spec.ts` - D-13 RLS-arm guard, flips to REAL runtime read in 32-05 (not permanent fixme, [2026-06-15])

## Decisions Made
- Named the project `phase32` (bare, no `-stubs` suffix) per the plan's explicit acceptance criterion, which supersedes the naming in 32-VALIDATION.md.
- Mapped `resolve-access.spec.ts`'s flip point to 32-04 even though 32-04's `files_modified` doesn't list that exact path — 32-04 instead creates a proper behavioral unit test (`src/lib/org-model/__tests__/resolve-access.test.ts`) per the [2026-06-24] Playwright dynamic-import learning; this `tests/phase32/` file remains a lightweight source-contract placeholder pointing at the real resolver.
- Mapped `org-chart-build.spec.ts`'s flip point to 32-07 (the plan whose `files_modified` explicitly lists this path and wires `/admin/team`), not 32-06 (which only builds the underlying canvas component).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The `phase32` Playwright project is live and will pick up every future `tests/phase32/*.spec.ts` file with no further config edits.
- 32-02 (migrations) and 32-04 (org-model data layer) can proceed; their stubs' real-path comments are already in place to guide the flip.
- 32-05 must remember to flip `grants-org-isolation.spec.ts` and `person-grant-rls.spec.ts` from `test.fixme` to REAL live-Supabase runtime tests — these are explicitly NOT meant to stay as permanent stubs.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

All created files and both task commits (`ede77fe`, `256fa0e`) verified present.
