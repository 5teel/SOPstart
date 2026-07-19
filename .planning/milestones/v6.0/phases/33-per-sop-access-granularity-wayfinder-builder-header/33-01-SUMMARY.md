---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 01
subsystem: testing
tags: [playwright, nyquist-harness, source-contract, test-registration]

# Dependency graph
requires:
  - phase: 32-visual-org-model-library-permissions
    provides: WiringPatchBay, SelectionStrip, grants.ts, resolve-access.ts, ephemeral-org live-Supabase test fixture pattern (grants-org-isolation.spec.ts)
provides:
  - phase33 Playwright project registered in playwright.config.ts (single registration point for all later phase-33 plans)
  - 6 Wave-0 stub specs, one per SC-1..SC-6, each naming its real target artifact and owning-plan flip point
  - resolve-sop-access.test.ts Wave-0 unit stub (auto-registered under phase32-unit, no config edit)
  - deferred-items.md logging one pre-existing out-of-scope red test
affects: [33-02, 33-03, 33-04, 33-05, 33-06, 33-07, 33-08, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nyquist Wave-0 harness: register the project + drop test.fixme stubs naming real target paths before any production code, so --list proves discoverability before any plan touches the config again (CLAUDE.md 2026-05-25)"
    - "Unit stub for a not-yet-existing pure module must NOT statically import it — a missing-module resolution error breaks --list discovery for the whole project; document the target path/shape in comments only until the flip plan lands"

key-files:
  created:
    - tests/phase33/teams-ladder.spec.ts
    - tests/phase33/sop-drilldown.spec.ts
    - tests/phase33/sop-grant-schema.spec.ts
    - tests/phase33/sop-grant-materialization.spec.ts
    - tests/phase33/plain-language-access.spec.ts
    - tests/phase33/wayfinder-header.spec.ts
    - src/lib/org-model/__tests__/resolve-sop-access.test.ts
    - .planning/phases/33-per-sop-access-granularity-wayfinder-builder-header/deferred-items.md
  modified:
    - playwright.config.ts

key-decisions:
  - "sop-grant-materialization.spec.ts stays test.fixme at Wave 0 (schema/materialization code doesn't exist yet) but carries the explicit [2026-06-15]-mandated marker that it MUST flip to a real live-Supabase insert in 33-05, not remain a permanent fixme — mirrors the exact Wave-0 wording phase32's grants-org-isolation.spec.ts used before its own 32-05 flip"
  - "resolve-sop-access.test.ts avoids a static `@/lib/org-model/resolve-sop-access` import since that module doesn't exist until 33-05 — a missing-module error at that import would break --list discovery for the entire phase32-unit project, not just this file"

patterns-established:
  - "Single-registration-point Nyquist project: phase33 mirrors phase32's testDir '.', testMatch tests/phase33/** broad regex so every later plan drops specs with zero config edits"

requirements-completed: [SC-1, SC-2, SC-3, SC-4, SC-5, SC-6]

# Metrics
duration: 25min
completed: 2026-07-19
---

# Phase 33 Plan 01: Wave 0 Nyquist Harness Summary

**Registered the `phase33` Playwright project and dropped one test.fixme stub per SC-1..SC-6 (plus a behavioral unit stub for the narrowing-override helper) so every later Phase 33 plan flips a pre-registered, pre-discoverable spec instead of touching `playwright.config.ts`.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-19T02:22Z (approx)
- **Completed:** 2026-07-19T02:47:24Z
- **Tasks:** 2
- **Files modified:** 8 (1 modified, 7 created)

## Accomplishments
- `phase33` project registered in `playwright.config.ts`, verified via `npx playwright test --list --project=phase33` (6/6 discovered, matches the plan's zero-discovered-is-FAIL gate)
- 6 stub specs created — `teams-ladder` (SC-1), `sop-drilldown` (SC-2), `sop-grant-schema` (SC-3), `sop-grant-materialization` (SC-4), `plain-language-access` (SC-5), `wayfinder-header` (SC-6) — each names the real artifact path it will assert on and its owning-plan flip point (33-04..33-09)
- `resolve-sop-access.test.ts` unit stub created, auto-discovered by the existing `phase32-unit` project with zero config edit (`npx playwright test --list --project=phase32-unit` confirms it's the 12th of 3-file/12-test set)
- Both projects run green at phase head: `phase33` = 6 skipped (fixme); `phase32-unit` = 11 passed, 1 skipped
- Full `npx tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the phase33 Playwright project** - `b041725` (test)
2. **Task 2: Create 6 stub specs + the override-rule unit stub** - `66f080c` (test)

_No TDD tasks in this plan; both tasks are test-infrastructure-only (`type="auto"`, no `tdd="true"`)._

## Files Created/Modified
- `playwright.config.ts` - added `phase33` project block (broad `tests/phase33/**` testMatch), mirrors the `phase32` block verbatim; no existing project block touched
- `tests/phase33/teams-ladder.spec.ts` - SC-1 stub, flips live in 33-06
- `tests/phase33/sop-drilldown.spec.ts` - SC-2 stub, flips live in 33-08
- `tests/phase33/sop-grant-schema.spec.ts` - SC-3 stub, flips live in 33-05
- `tests/phase33/sop-grant-materialization.spec.ts` - SC-4 stub, [2026-06-15]-mandated real-runtime marker, flips live in 33-05, extended in 33-07
- `tests/phase33/plain-language-access.spec.ts` - SC-5 stub, flips live in 33-09
- `tests/phase33/wayfinder-header.spec.ts` - SC-6 stub, flips live in 33-04
- `src/lib/org-model/__tests__/resolve-sop-access.test.ts` - behavioral unit stub for the pure override-rule helper (trigger on any direct SOP grant, last-person-removed re-follow, org/area SOP-target inheritance), auto-registers under `phase32-unit`
- `.planning/phases/33-per-sop-access-granularity-wayfinder-builder-header/deferred-items.md` - logs one out-of-scope pre-existing red test found during the full-suite sanity run

## Decisions Made
- Followed the phase32 Wave-0 precedent exactly (verified against phase32's actual Wave-0 commit `256fa0e`, before its specs were flipped live in 32-05/32-07/32-08/32-09) rather than copying the now-flipped-live phase32 spec files, since those show the POST-flip shape, not the Wave-0 stub shape this plan needed to produce.
- `resolve-sop-access.test.ts` deliberately does not import `@/lib/org-model/resolve-sop-access` (that module is built in 33-05) — a static import of a non-existent module would throw a module-resolution error the instant Playwright's TS compiler loads the file, which would break `--list` discovery for the entire `phase32-unit` project (not just this one test), a strictly worse failure mode than a single test.fixme.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The first `playwright.config.ts` edit attempt via the `Edit` tool failed because the file is CRLF-encoded (repo has no `.gitattributes`, per the CLAUDE.md [2026-07-18] learning) and the `Edit` tool's `old_string` match used `\n`. Resolved by building the new project block as a CRLF-encoded snippet and splicing it in with `perl -0777` in raw byte mode (preserving CRLF, avoiding the "Wide character in print" mangling my first Unicode-em-dash attempt hit). Not a plan deviation — same net result (a clean, minimal `git diff --stat` of `+21` lines, verified before committing).
- Full-suite sanity run (`--project=phase32 --project=phase32-unit --project=phase33`) surfaced one pre-existing red test in `tests/phase32/grants-org-isolation.spec.ts` (an `\n`-literal source-contract match against `src/actions/grants.ts` broken by CRLF, per the same [2026-07-18] learning class). Confirmed pre-existing against base commit `2ddcaad` (fails identically with zero 33-01 changes applied) and out of the 33-01 `files_modified` scope — logged to `deferred-items.md`, not fixed here (SCOPE BOUNDARY rule).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `phase33` project + all 7 stub files are registered, discoverable, and green — every subsequent Phase 33 plan (33-02..33-09) can flip its owning stub(s) live without ever touching `playwright.config.ts` again.
- The pre-existing `grants-org-isolation.spec.ts` CRLF mismatch (see Issues Encountered) will land in scope naturally at 33-05, which extends `src/actions/grants.ts` with the `sopId` target arm — recommend repointing that spec's literal match in the same commit.

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk; all 3 task/plan commit hashes (`b041725`, `66f080c`, `42755f6`) confirmed in `git log`.
