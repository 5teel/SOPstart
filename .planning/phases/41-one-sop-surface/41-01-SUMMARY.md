---
phase: 41-one-sop-surface
plan: 01
subsystem: testing
tags: [nextjs, playwright, bundle-gate, ci, source-contract-tests]

# Dependency graph
requires:
  - phase: 15-desktop-walkthrough-and-sub-trades
    provides: scripts/check-bundle-size.ts single-route SB-LINE-06 gate pattern this plan generalises
provides:
  - GATED_ROUTES array shared shape in scripts/check-bundle-size.ts and scripts/capture-bundle-baseline.ts
  - .bundle-baseline.json with a captured, real /sops/page baseline (940 KB)
  - phase41 Playwright project + 5 stub specs (1 live, 4 fixme) covering SUR-01..06
  - tests/lint/no-static-admin-lens-import.spec.ts, mutation-proven in both directions
affects: [41-05-merged-surface, 41-06-nav-and-shim, 41-07-reference-sweep, 41-08-spec-repoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-array bundle gate: GATED_ROUTES[{route, rscManifestPath, pageBundlePath, forbiddenMarkers}] looped in both check-bundle-size.ts and capture-bundle-baseline.ts, replacing the Phase-15 single-route hardcode"
    - "Marker self-validation: every forbidden-marker string literal is asserted present SOMEWHERE in the full build output, so a renamed/typo'd literal fails loudly instead of passing the absence check vacuously"
    - "String-literal forbidden markers (not identifiers) for the /sops/page admin-lens leak checks, since production minification renames identifiers but preserves string literals"

key-files:
  created:
    - tests/phase41/bundle-gate.spec.ts
    - tests/phase41/merged-surface.spec.ts
    - tests/phase41/nav-and-shim.spec.ts
    - tests/phase41/reference-sweep.spec.ts
    - tests/phase41/spec-repoint-inventory.spec.ts
    - tests/lint/no-static-admin-lens-import.spec.ts
  modified:
    - scripts/check-bundle-size.ts
    - scripts/capture-bundle-baseline.ts
    - .bundle-baseline.json
    - playwright.config.ts

key-decisions:
  - "Rendering model locked (D-03, stated in the plan objective before any surface work): /sops stays a client component; the three admin views become next/dynamic({ ssr: false }) client lenses gated by useIsAdmin() and fed by self-guarding server actions."
  - "Re-captured /sops/[sopId]/page baseline is 1048 KB, not the previously-recorded 1059 KB — the existing gate only fails on growth (never flags a decrease), so an 11 KB improvement across phases 16-40 went unrecorded. This is a legitimate re-baseline, not a regression; no src/ file was touched to produce it."
  - "/sops/page baseline captured at 940 KB from the pre-merge tree, before any admin-lens code exists on that route."

requirements-completed: [SUR-05]

# Metrics
duration: 55min
completed: 2026-09-13
---

# Phase 41 Plan 01: Wave-0 Harness Summary

**Generalised the SB-LINE-06 bundle gate from one route to a two-route array with marker self-validation, captured a real 940 KB `/sops/page` baseline, registered the `phase41` Playwright project with 5 SUR-01..06 stub specs, and shipped a mutation-proven static-import leak guard for the three admin lens components — zero `src/` files touched.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-12T23:44:42Z
- **Completed:** 2026-09-13T00:40:00Z (approx)
- **Tasks:** 3
- **Files modified:** 10 (4 modified, 6 created)

## Accomplishments
- `scripts/check-bundle-size.ts` and `scripts/capture-bundle-baseline.ts` generalised to a `GATED_ROUTES` array; `/sops/page` is now gated alongside `/sops/[sopId]/page`, closing the exact hole 41-RESEARCH Pitfall 1 called out (a single-route hardcode would stay green after the surface merge while proving nothing about the list route).
- Added marker self-validation: a forbidden literal absent from the entire build fails the build loudly instead of passing the absence check vacuously (CLAUDE.md 2026-05-25/2026-06-05 vacuous-guard class) — mutation-proven live (mutated `Owner role gone`, confirmed the exact failure message, reverted).
- `.bundle-baseline.json` now carries two real, freshly-measured route baselines: `/sops/[sopId]/page` = 1048 KB, `/sops/page` = 940 KB.
- `phase41` Playwright project registered with a deliberately broad `testMatch`; 5 stub spec files created (`bundle-gate` live, the other 4 `test.fixme` naming their activating plan). All `-g` filters named in the plan's acceptance criteria (SUR-01, SUR-02, SUR-03, SUR-04, SUR-06, deep-link, redirect shim) select at least one test.
- `tests/lint/no-static-admin-lens-import.spec.ts` created, registered in the `phase15-stubs` project, and mutation-proven in both directions (leaking `SopMillerBrowser` into `SopWorkerBrowser.tsx`, and leaking `@/actions/org-model` into `sops/page.tsx`) — both mutations were introduced, confirmed to fail with the correct file:line/message, then reverted with `git status --short src/` returning clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalise the SB-LINE-06 gate to a route array and capture the /sops/page baseline** - `c92bc6f` (feat)
2. **Task 2: Register the phase41 Playwright project and write the SUR-01..06 stub specs** - `3a5a0ed` (test)
3. **Task 3: Add the admin-lens static-import leak guard** - `4c84565` (test)

_No plan-metadata doc commit yet — this SUMMARY + STATE/ROADMAP updates land in the final commit per the execute-plan workflow._

## Files Created/Modified
- `scripts/check-bundle-size.ts` - route-array SB-LINE-06 gate with marker self-validation, route-A-scoped positive chunk-existence assertions preserved verbatim
- `scripts/capture-bundle-baseline.ts` - route-array baseline capture that merges into (not replaces) the existing `routes` object; new `--route=<route>` flag
- `.bundle-baseline.json` - two committed route baselines (`/sops/[sopId]/page` 1048 KB, `/sops/page` 940 KB)
- `playwright.config.ts` - registered `phase41` project; added `no-static-admin-lens-import` to the `phase15-stubs` testMatch regex
- `tests/phase41/bundle-gate.spec.ts` - LIVE: asserts the two scripts and the baseline are route-array shaped
- `tests/phase41/merged-surface.spec.ts` - fixme (41-05): SUR-01/SUR-02/SUR-06 stub contracts
- `tests/phase41/nav-and-shim.spec.ts` - fixme (41-06): SUR-03/SUR-04 + redirect-shim stub contracts
- `tests/phase41/reference-sweep.spec.ts` - fixme (41-07): `/admin/sops` reference-sweep stub, anchored regex excludes builder/new/pipeline/[sopId] sub-routes
- `tests/phase41/spec-repoint-inventory.spec.ts` - fixme (41-08): guards that legacy specs get repointed off the shim rather than going stale-red
- `tests/lint/no-static-admin-lens-import.spec.ts` - LIVE: two-contract static-import leak guard for the three admin lens components

## Decisions Made
- Rendering model (D-03) locked in the plan objective before this plan touched anything: `/sops` stays client-side, admin views become `next/dynamic({ ssr: false })` lenses. This governs every later 41-* plan and is why `next/dynamic` + `useIsAdmin()` + `history.replaceState` are the mechanisms these stub specs assert against.
- Chose to re-baseline `/sops/[sopId]/page` at its true current value (1048 KB) rather than preserve the stale 1059 KB figure from 2026-07-29 — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `/sops/[sopId]/page` baseline recapture returned 1048 KB, not the plan-expected 1059 KB**
- **Found during:** Task 1 (baseline capture)
- **Issue:** The plan's acceptance criteria assumed `/sops/[sopId]/page` would be "unchanged at 1059" after recapture on the unmodified tree, treating any change as a sign the merge or capture logic was broken. The actual pre-merge tree (post Phases 16-40) measured 1048 KB — an 11 KB *decrease* from the 2026-07-29 baseline.
- **Root cause:** `check-bundle-size.ts`'s delta gate only fails on growth (`deltaKB > TOLERANCE_KB`); a decrease never trips it. Across ~25 phases of legitimate work since the baseline was last captured, the route's real bundle shrank by 11 KB and nothing ever re-captured the baseline to reflect it — the stale ceiling just sat 11 KB above reality without failing.
- **Fix:** Verified `git status --short src/` was empty before and after capture (confirming no src/ edit caused the number), then accepted the accurately-measured 1048 KB as the new committed baseline rather than forcing a stale number. This is a correct capture, not a regression.
- **Files modified:** `.bundle-baseline.json` (value only; no logic change)
- **Verification:** `npm run build` → postbuild gate reports `Δ 0 KB` for both routes; `git status --short src/` empty throughout.
- **Committed in:** `c92bc6f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale plan assumption about baseline drift)
**Impact on plan:** No scope creep. The gate mechanics are exactly as specified; only the numeric baseline value differs from the plan's stated expectation, for a documented, verified reason.

## Issues Encountered
None beyond the baseline-value deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two-route SB-LINE-06 gate is live and enforced on every `npm run build` from this commit forward — 41-05 (the first plan to add real admin-lens code to `/sops/page`) will be caught immediately if any admin-lens code leaks into the worker bundle.
- `phase41` project stubs give 41-05/06/07/08 named, `-g`-selectable tests to flip live; no further `playwright.config.ts` edits needed for those plans.
- The admin-lens static-import guard is already live and will fail the moment any future wave statically imports `SopMillerBrowser`/`GovernanceQueueRow`/`WiringPatchBayShell` outside the permitted files — this includes protecting waves 1-4 before 41-05 exists.
- No blockers. Zero `src/` files were modified by this plan, satisfying the plan's hard constraint that Wave 0 lands before any surface work.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk; all 4 commit hashes (`c92bc6f`, `3a5a0ed`, `4c84565`, `6a8a1f7`) confirmed in `git log --oneline --all`.
