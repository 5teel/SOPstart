---
phase: 43-dead-surface-removal-route-truth
plan: 04
subsystem: routing
tags: [nextjs, redirects, route-truth, dead-code-removal, journeys, playwright]

# Dependency graph
requires:
  - phase: 43-dead-surface-removal-route-truth
    provides: "43-01's route-truth.spec.ts fixme scaffold and no-dead-internal-hrefs.spec.ts guard; 43-02/43-03's completed D-03/D-04/D-05 work (unrelated surfaces, no overlap)"
provides:
  - "Two page-level redirect shims (/admin/governance, /admin/sops) deleted; bookmark compatibility moved to two static next.config.ts redirects next to the existing review redirect"
  - "journeys.ts and CAPABILITY-MATRIX.md updated to reflect the deletion (D-01/D-06)"
  - "Ten pre-existing specs across phase28/29/30/41/54 repointed off the deleted files onto next.config.ts / the /governance page / the middleware"
  - "route-truth.spec.ts's four fixme tests flipped live (5/5 passing)"
affects: [43-05-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legacy page-level redirect shim -> static next.config.ts redirects() entry, when the shim's only job was guard-then-redirect and the destination already re-guards itself"
    - "Source-contract specs that read a shim file for its guard/redirect shape are repointed to read next.config.ts (for the redirect) and the destination page (for the guard) once the shim is deleted, in the same commit as the deletion"

key-files:
  created:
    - .planning/phases/43-dead-surface-removal-route-truth/43-04-SUMMARY.md
  modified:
    - next.config.ts
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase43/route-truth.spec.ts
    - tests/phase28/governance-queue.spec.ts
    - tests/phase29/approval-chain-editor.spec.ts
    - tests/phase30/admin-nav.spec.ts
    - tests/phase30/create-entry.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/phase41/merged-surface.spec.ts
    - tests/phase41/nav-and-shim.spec.ts
    - tests/phase41/reference-sweep.spec.ts
    - tests/phase41/spec-repoint-inventory.spec.ts
    - tests/phase54/deletion-sweep.spec.ts

key-decisions:
  - "Followed 43-CONTEXT.md D-01 verbatim: page-level shims deleted, next.config.ts redirects() carries the two new static entries (non-permanent, fixed destinations, T-43-02 open-redirect hygiene)"
  - "Every spec that previously read a shim file now reads either next.config.ts (redirect shape) or the destination page (guard shape) — no spec was left reading a path that no longer exists"

patterns-established:
  - "Pattern: when a page-level redirect shim is deleted in favour of a config-level redirect, repoint every consuming spec in the same commit as the deletion (CLAUDE.md 2026-07-13/2026-08-04) rather than leaving them stale-red or silently vacuous"

requirements-completed: [DED-03, DED-04]

duration: ~50min
completed: 2026-09-30
---

# Phase 43 Plan 04: Dead-Surface Removal & Route Truth Summary

**Deleted the two page-level `/admin/governance` and `/admin/sops` redirect shims, moved bookmark compatibility into two static `next.config.ts` redirects, and repointed all ten specs (across four earlier phases) that read the deleted files — route-truth, dead-link guard, and every repointed spec pass green with `tsc`/`eslint`/`npm run build` all clean and the bundle baseline untouched.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-30
- **Tasks:** 3/3 completed
- **Files modified:** 14 (13 source/spec files + this summary)

## Accomplishments
- `src/app/(protected)/admin/governance/page.tsx` and `src/app/(protected)/admin/sops/page.tsx` deleted; `next.config.ts` gained two static redirects (`/admin/governance` → `/governance`, `/admin/sops` → `/sops`, both non-permanent, fixed same-origin destinations) alongside the existing `/admin/sops/:sopId/review` redirect.
- `journeys.ts` no longer maps either deleted page; `CAPABILITY-MATRIX.md` records the Phase 43 deletion and that each destination now guards itself.
- `tests/phase43/route-truth.spec.ts`'s four fixme tests flipped live — 5/5 passing (confirmed shim deletion, absence of `/admin/governance` references in `src/`, both redirects present with same-origin destinations, journeys.ts correctness).
- Ten pre-existing specs across phase28/29/30/41/54 repointed off the deleted files (see Files Created/Modified) — every one now reads `next.config.ts` and/or the real destination page instead of a file that no longer exists.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete both shims, add the config redirects, update journeys + matrix (D-01)** - `fa85691` (feat)
2. **Task 2: Repoint the phase28 / 29 / 30 specs that read the shim files (D-01)** - `6f15253` (test)
3. **Task 3: Repoint the phase41 / 54 sweeps and shim specs to the post-deletion state (D-01)** - `e9f087f` (test)

_Plan-metadata commit follows this summary._

## Files Created/Modified
- `next.config.ts` - Two new redirects() entries for the legacy shim URLs, with an extended JSDoc explaining the T-43-02 open-redirect hygiene rationale
- `src/lib/journeys/journeys.ts` - Removed the `legacy` and `legacy-admin-sops` governance-queue steps; reworded the `activity` step detail
- `.planning/codebase/CAPABILITY-MATRIX.md` - Updated the Phase 41/54 note to record the Phase 43 deletion and self-guarding destinations
- `tests/phase43/route-truth.spec.ts` - Four fixme tests flipped to live tests
- `tests/phase28/governance-queue.spec.ts` - SHIM/FOLDED_PAGE reads replaced with next.config.ts assertions; journeys test asserts absence
- `tests/phase29/approval-chain-editor.spec.ts` - GOVERNANCE_SHIM read replaced with a /governance page read
- `tests/phase30/admin-nav.spec.ts` - ADMIN_PAGES drops the deleted admin/sops entry; unused GOVERNANCE_SHIM/SOPS_PAGE and shim-only assertions removed
- `tests/phase30/create-entry.spec.ts` - ADMIN_SOPS_SHIM removed; dedupe check scoped to /sops only
- `tests/phase30/governance-fold.spec.ts` - Shim test repointed to next.config.ts + /governance's own guard
- `tests/phase41/merged-surface.spec.ts` - Unused LIBRARY_TABLE removed; shim describe replaced with next.config.ts + middleware assertion
- `tests/phase41/nav-and-shim.spec.ts` - Shim describe replaced with a static-redirect + open-redirect-hygiene check; dead "no longer imports" test removed
- `tests/phase41/reference-sweep.spec.ts` - PERMITTED_FILES/EXPECTED_PERMITTED_COUNT removed; sweep now unconditional across all of src/
- `tests/phase41/spec-repoint-inventory.spec.ts` - ALLOWLIST emptied; header rewritten
- `tests/phase54/deletion-sweep.spec.ts` - PERMITTED_ATTENTION_FILES drops the deleted shim; EXPECTED_ATTENTION_COUNT 3 → 2

## Decisions Made
- Followed 43-CONTEXT.md D-01 exactly: no new judgment calls beyond the plan's own action text.
- Where a spec's const (e.g. `ADMIN_SOPS_SHIM`, `GOVERNANCE_SHIM`, `LIBRARY_TABLE` in merged-surface.spec.ts, `SOPS_PAGE` in admin-nav.spec.ts) became unused after the repoint, it was deleted outright (D-02: touched files end with zero unused-vars) rather than left dangling.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria in the plan's three tasks were verified directly (test pass counts, grep counts, eslint output, tsc, npm run build) and matched expectations on the first pass.

## Verification Evidence

- `npx playwright test --project=phase43 tests/phase43/route-truth.spec.ts` → 5 passed
- `npx playwright test --project=phase15-stubs tests/lint/no-dead-internal-hrefs.spec.ts` → 4 passed
- `npx playwright test tests/phase28/governance-queue.spec.ts tests/phase29/approval-chain-editor.spec.ts tests/phase30/admin-nav.spec.ts tests/phase30/create-entry.spec.ts tests/phase30/governance-fold.spec.ts` → 39 passed
- `npx playwright test tests/phase41/merged-surface.spec.ts tests/phase41/nav-and-shim.spec.ts tests/phase41/reference-sweep.spec.ts tests/phase41/spec-repoint-inventory.spec.ts tests/phase54/deletion-sweep.spec.ts` → 31 passed
- `npx playwright test --project=phase43` → 16 passed, 0 skipped
- `npx tsc --noEmit` → clean (stale `.next/types` referencing the deleted pages cleared with a `.next/types` + `.next/cache/webpack` removal before the final clean run — expected staleness from a prior build, not a real error)
- `npx eslint <all touched spec files + next.config.ts + journeys.ts>` → clean, zero no-unused-vars
- `npm run build` → clean; bundle gate green (`/sops/[sopId]/page` Δ-3KB, `/sops/page` Δ-4KB, both reported OK by the gate); `git diff --exit-code .bundle-baseline.json` → exit 0 (untouched)
- Acceptance grep checks (`source: '/admin/governance',` / `source: '/admin/sops',` / `source: '/admin/sops/:sopId/review',` counts = 1 each; `route: '/admin/(governance|sops)'` in journeys.ts = 0; `deleted in Phase 43` in CAPABILITY-MATRIX.md = 1; `PERMITTED_FILES` in reference-sweep.spec.ts = 0; `const ALLOWLIST: string[] = []` = 1; `EXPECTED_ATTENTION_COUNT = 2` = 1) — all confirmed.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- 43-05 (verification) can run the deployed eval (`tests/evals/dead-surface.eval.ts`, tests D1/D2) against production once this plan's commits are pushed — no changes needed to the eval itself.
- No blockers.

---
*Phase: 43-dead-surface-removal-route-truth*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 14 files verified present on disk; all 3 task commit hashes (`fa85691`, `6f15253`, `e9f087f`) verified in `git log`; both shim page files confirmed deleted.
