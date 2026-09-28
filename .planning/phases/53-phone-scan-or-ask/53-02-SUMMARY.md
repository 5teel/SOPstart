---
phase: 53-phone-scan-or-ask
plan: 02
subsystem: ui
tags: [react-query, refactor, source-contract-tests, bundle-gate]

# Dependency graph
requires:
  - phase: 52-worker-home-the-plant
    provides: "['site-worker'] query, PlantHome render seam on /sops/page.tsx (sops={workerSops} slot)"
  - phase: 36-competency-refresher
    provides: "refresherDueDate/isRefresherDue/isRefresherOverdue helpers"
provides:
  - "src/hooks/useWorkerSops.ts -- the one worker-list derivation (assignment lookup, library rows, lineage-rooted last completion, refresher window, newer-version check) consumed by /sops and, from 53-03, /m/[code]"
  - "SopsSection reduced to: call the hook, filter by department, render -- no data-fetching logic of its own"
  - "Every page-reading guard (phase41 merged-surface, phase36 refresher chip/no-gate, phase37 assessor no-gate, phase52 render-seam) repointed to watch the hook"
affects: [53-03, 53-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-derivation hooks that must agree across two pages (Phase 53's /sops and /m/[code]) live in src/hooks/, imported by both -- never duplicated per CLAUDE.md 2026-09-27's 'one classifier' rule"

key-files:
  created:
    - src/hooks/useWorkerSops.ts
  modified:
    - src/app/(protected)/sops/page.tsx
    - tests/phase41/merged-surface.spec.ts
    - tests/phase36/worker-library-chip.spec.ts
    - tests/phase36/no-refresher-gate.spec.ts
    - tests/phase37/no-competency-gate-worker.spec.ts
    - tests/phase52/plant-render-seam.spec.ts

key-decisions:
  - "The department filter stays a view concern in SopsSection, not in the hook -- the hook returns the unfiltered WorkerSop[] (allWorkerSops), the page does .filter((s) => deptMatches(s.id)) on top, matching 53-CONTEXT D-04's requirement that /m/[code] apply its own view filtering later."
  - "merged-surface.spec.ts's new one-derivation test excludes 'user-sop-assignments' from the four-key absence check -- page.tsx legitimately still references that key in two queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] }) calls (handleRemove/handleAdd); the useQuery DEFINITION moving is proven separately by asserting 'getUserSopAssignments' is absent from page.tsx."

requirements-completed: [PHN-01, PHN-02]

# Metrics
duration: ~4min (commit-to-commit span)
completed: 2026-09-29
---

# Phase 53 Plan 02: Extract useWorkerSops Summary

**Lifted the ~180-line worker per-SOP derivation (4 queries, lineage-rooted completion clock, refresher/version state, assigned+library list builder) out of `SopsSection` into `src/hooks/useWorkerSops.ts`, with zero rendered-output change and every page-reading guard repointed to the hook's new home**

## Performance

- **Duration:** ~4 min (commit-to-commit span; excludes upfront PLAN/context reading)
- **Started:** 2026-09-29T02:12:24+10:00 (Task 1 commit)
- **Completed:** 2026-09-29T02:15:39+10:00 (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Created `src/hooks/useWorkerSops(assignedSops, requestedIds)` -- the one place a worker's per-SOP list is built, returning `{ workerSops, assignments, libraryLoading }`; the four `useQuery` calls (user-sop-assignments, library-sops, worker-last-completions with its explicit `.eq('worker_id', ...)` self-scope, sop-refresher-intervals), `rootOf`/`lastCompletionByRoot`, `refresherState`, and `hasNewerVersion` all moved verbatim with their original comments (WR-02, WR-03, AFL-VER-04/D-08, REF-01/D-08, the 2026-06-08 "now computed per call" note)
- `SopsSection` now calls the hook once and applies only `deptMatches` on top (`const workerSops = allWorkerSops.filter((s) => deptMatches(s.id))`) -- `sops={workerSops}` on the PlantHome slot and every downstream consumer (`inScope`, `matchesQuery`, `scoped`, `counts`, `visibleScopes`, `loading`) unchanged
- Repointed five test files that grepped the moved code, adding a new "the worker list is derived in exactly one place" assertion (walks `src/`, confirms exactly one file owns the `worker-last-completions` query key and it carries `.eq('worker_id'`) and extending TARGETS/GATE_PATTERN/hook-order checks in the phase36/37/52 guards
- `npm run build` clean; bundle gate green on both worker routes with the change actually *shrinking* both chunks slightly (`/sops/page` 938 KB Δ-2 KB, `/sops/[sopId]/page` 1047 KB Δ-1 KB, both within ±2 KB tolerance); `.bundle-baseline.json` untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: create useWorkerSops and make SopsSection use it** - `8db3b27` (refactor)
2. **Task 2: repoint the page-reading guards, then prove the build** - `375a642` (test)

**Plan metadata:** commit pending (this SUMMARY -- STATE/ROADMAP owned by orchestrator)

## Files Created/Modified
- `src/hooks/useWorkerSops.ts` - the one worker per-SOP derivation: 4 queries, lineage-rooted completion clock, refresher/version-currency state, assigned+library `WorkerSop[]` builder
- `src/app/(protected)/sops/page.tsx` - `SopsSection` now calls `useWorkerSops`; removed the four queries, `LibrarySop` interface, `rootOf`/`lastCompletionByRoot`/`refresherState`/`hasNewerVersion`, and the list builder (now `allWorkerSops.filter(deptMatches)`); dropped now-unused imports (`CachedSop`, `categoryLabel`, `refresherDueDate`+friends, `getUserSopAssignments`)
- `tests/phase41/merged-surface.spec.ts` - SUR-01 "worker data layer is untouched" repointed (`getUserSopAssignments`/`refresherDueDate` now asserted against the hook, not the page); new "the worker list is derived in exactly one place" test with a `walk()` helper and `WORKER_SOPS_HOOK` const
- `tests/phase36/worker-library-chip.spec.ts` - `refresherDueDate` import regex now reads the hook; the no-gating-branch test covers the hook alongside the page/card
- `tests/phase36/no-refresher-gate.spec.ts` - added `useWorkerSops.ts` to `TARGETS`
- `tests/phase37/no-competency-gate-worker.spec.ts` - added `useWorkerSops.ts` to `TARGETS`
- `tests/phase52/plant-render-seam.spec.ts` - hook-order test now anchors on `lastIndexOf('useWorkerSops(', slotIdx)` instead of `lastIndexOf('useQuery(', slotIdx)`

## Verification output

```
npx tsc --noEmit          -> clean (0 output)
npx eslint <changed files> -> clean (0 output)

npx playwright test tests/phase41/ tests/phase36/worker-library-chip.spec.ts \
  tests/phase36/no-refresher-gate.spec.ts tests/phase37/no-competency-gate-worker.spec.ts \
  tests/phase52/ tests/phase28/... tests/phase29/... tests/phase30/... tests/phase32/... \
  tests/phase33/sop-drilldown.spec.ts tests/lint/no-static-admin-lens-import.spec.ts \
  tests/sb-auth-builder.test.ts
  -> 339 passed, 1 failed (sb-auth-builder.test.ts SB-AUTH-01 -- pre-existing,
     recorded in 51-BASELINE-FAILURES.md line 15, not caused by this plan), 6 skipped

npx playwright test --project=phase53
  -> 17 passed (all live specs from 53-01), 31 skipped (fixme stubs for 53-03/04/05)

npm run build
  check-bundle-size: /sops/[sopId]/page = 1047 KB (baseline 1048 KB, Δ -1 KB, tolerance ±2 KB)
  check-bundle-size: /sops/page = 938 KB (baseline 940 KB, Δ -2 KB, tolerance ±2 KB)
  check-bundle-size: ✓ Bundle isolation OK
  check-bundle-size: ✓ Source-viewer isolation OK
  check-bundle-size: ✓ Konva isolation OK
  check-bundle-size: ✓ Marker self-validation OK

git diff --quiet 736f44a HEAD -- .bundle-baseline.json  -> exit 0 (baseline untouched)
```

## Decisions Made
- Hook does NOT apply the department filter -- that stays view state in `SopsSection` (`allWorkerSops.filter(deptMatches)`), matching the plan's explicit instruction and setting up 53-03's `/m/[code]` to apply its own scoping on top of the same derivation.
- `merged-surface.spec.ts`'s new "exactly one place" test excludes the `user-sop-assignments` query key from the "absent from page.tsx" check, since page.tsx legitimately keeps two `queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })` calls in `handleRemove`/`handleAdd` -- asserted the useQuery *definition* moved instead, via absence of the `getUserSopAssignments` identifier.

## Deviations from Plan

None - plan executed exactly as written. The only adjustment was narrowing one self-authored test assertion (see Decisions Made above) after it caught its own false positive against legitimate `invalidateQueries` usage -- not a deviation from the PLAN.md instructions, a self-correction during Task 2 before commit.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useWorkerSops` is ready for 53-03's `/m/[code]` page and 53-04's `PhoneHome`/`MachineListSheet` to import -- both can call `useWorkerSops(assignedSops)` and get the identical `WorkerSop[]` the `/sops` list and plant already show, satisfying CONTEXT D-04's "fed by `useAssignedSops`" requirement without a second derivation.
- No visible change on `/sops` -- confirmed via the full page-reading spec set (339 passed) plus the bundle gate (both routes shrank slightly, no regression).
- 53-03 and 53-04 can now proceed in parallel in Wave 2 with disjoint files, per this plan's recorded rationale for splitting out of the orchestrator's original 5-plan outline.

---
*Phase: 53-phone-scan-or-ask*
*Completed: 2026-09-29*

## Self-Check: PASSED

Both task commits (`8db3b27`, `375a642`) verified present in `git log`; `src/hooks/useWorkerSops.ts` and this SUMMARY verified present on disk.
