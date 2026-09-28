---
phase: 54-admin-inbox-floor-health-library-table
plan: 05
subsystem: ui
tags: [nextjs, playwright, admin-surface, deletion, source-contract-tests, journeys]

# Dependency graph
requires:
  - phase: 54-admin-inbox-floor-health-library-table
    provides: "54-02 governance inbox (/governance, GovernanceInbox, inbox.ts), 54-03 floor health (AdminFloorHealth, PlantStage health mode), 54-04 AdminLibraryTable + WorkerSimpleList + BuilderCategoryButton swapped onto /sops"
provides:
  - "Seven Phase 41 Miller/lens files deleted (AdminSopSurface, sops-nav-types, MillerPrimitives, AdminAttentionLens, AdminStatusLens, SopMillerBrowser, SopWorkerBrowser); AdminAccessLens survives"
  - "~15 specs repointed onto the governance inbox / AdminLibraryTable / WorkerSimpleList / BuilderCategoryButton that replaced the deleted surface; tests/phase41/status-attention-lenses.spec.ts deleted (its guards live on in phase29 + phase54)"
  - "tests/phase54/deletion-sweep.spec.ts live (0 fixme, 5/5 green, mutation-proven)"
  - "tests/lint/no-static-admin-lens-import.spec.ts converted to a per-symbol allow-list (GovernanceQueueRow/WiringPatchBayShell/AdminFloorHealth/AdminLibraryTable)"
  - "Dead topSignal() removed from worker-signal.ts; plantRelState is the sole classifier it exports"
  - "journeys.ts/roles.ts/uat/tests.ts/CAPABILITY-MATRIX.md describe the inbox, floor, panel and library table — no retired lens named anywhere"
affects: [54-06 (eval rewrite), any future phase touching /sops, /governance, or admin SOP-list capabilities]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deletion runs last in a wave-ordered phase: 54-04 already unplugged the modules from the app graph, so 54-05 touches only tests + docs, never app behaviour"
    - "Comment-stripped source-contract sweep (stripComments + walkTsFiles + DEAD_NAMES regex) mutation-proven both ways: a comment mention passes, a real code reference (word-boundary match) fails"
    - "Per-symbol static-import allow-list (Record<string, string[]>) replaces a single shared file list once multiple distinct components each need their own single importer pinned"

key-files:
  created: []
  modified:
    - "src/lib/sop/worker-signal.ts (topSignal deleted; header reworded)"
    - "src/app/(protected)/admin/sops/page.tsx (stale header comment reworded)"
    - "tests/phase28/governance-queue.spec.ts, tests/phase28/library-and-worker.spec.ts, tests/phase29/queue-approve-action.spec.ts, tests/phase30/admin-nav.spec.ts, tests/phase30/governance-fold.spec.ts, tests/phase30/list-rows.spec.ts (rewritten), tests/phase32/library-filter-deeplink.spec.ts (rewritten), tests/phase33/sop-drilldown.spec.ts, tests/phase36/worker-library-chip.spec.ts, tests/phase41/nav-and-shim.spec.ts, tests/phase41/reference-sweep.spec.ts, tests/phase52/plant-pins-no-storage.spec.ts, tests/phase52/plant-pins.spec.ts (deviation), tests/lint/no-static-admin-lens-import.spec.ts, tests/phase54/deletion-sweep.spec.ts (fixme -> live)"
    - "src/lib/journeys/journeys.ts, src/lib/journeys/roles.ts, src/lib/uat/tests.ts, .planning/codebase/CAPABILITY-MATRIX.md"

key-decisions:
  - "topSignal() deleted outright rather than kept dormant — its only consumer (SopWorkerBrowser) is gone and no other src/ file called it; plantRelState alone remains worker-signal.ts's classifier"
  - "tests/phase52/plant-pins.spec.ts (not in the plan's files_modified list) had a topSignal-behaviour describe block that would have failed after the deletion — removed as a same-commit deviation rather than reverting the deletion, since the function's retirement is deliberate per Task 2"
  - "tests/phase41/status-attention-lenses.spec.ts deleted outright (not repointed) — its lens subjects are gone and its two safety-relevant guards (APR-03/04 GovernanceQueueRow gating, SUR-04 single-builder-chain) already live doubled in tests/phase29/queue-approve-action.spec.ts and tests/phase54 specs"

requirements-completed: [ADM-03, ADM-04]

duration: 17min
completed: 2026-09-29
---

# Phase 54 Plan 05: Deletion Wave Summary

**Deleted the seven Phase 41 Miller/lens files 54-04 left orphaned, repointed ~15 specs onto the governance inbox / admin library table that replaced them, and flipped the deletion sweep + per-symbol lint guard live — `npm run build` and the full touched-project test matrix stay green throughout.**

## Performance

- **Duration:** 17 min (04:32 → 04:49, three task commits)
- **Tasks:** 3
- **Files modified:** 25 (7 deleted, 1 spec deleted, 17 modified/rewritten)

## Accomplishments
- `AdminSopSurface.tsx`, `sops-nav-types.ts`, `MillerPrimitives.tsx`, `AdminAttentionLens.tsx`, `AdminStatusLens.tsx`, `SopMillerBrowser.tsx`, `SopWorkerBrowser.tsx` are gone from the repo; `AdminAccessLens.tsx` survives and still builds
- Every spec that read a deleted file now asserts the surviving implementation (the `/governance` page + `GovernanceInbox`/`inbox.ts`, `AdminLibraryTable.tsx`, `WorkerSimpleList.tsx`, `BuilderCategoryButton.tsx`, or the pure `resolveLibraryNav` in `admin-rows.ts`) — none repointed to a stub
- `tests/phase54/deletion-sweep.spec.ts` is live (0 `test.fixme`, 5/5 green) and mutation-proven: a comment mention of a dead name passes, a real code reference fails, reverted clean
- `tests/lint/no-static-admin-lens-import.spec.ts` converted to a per-symbol allow-list; `AdminLibraryTable`'s entry is empty (dynamic-only), matching its actual `next/dynamic({ssr:false})` wiring on `/sops`
- `journeys.ts` maps the floor + machine panel on `/governance`, every remaining "Admin scope group" label reads "SOP library (table)", and pathways coverage stays 0-not-mapped; `roles.ts`, `uat/tests.ts` and `CAPABILITY-MATRIX.md` name no retired lens
- `npm run build` clean: `/sops/[sopId]` 1043 KB (Δ -5 KB) and `/sops` 935 KB (Δ -5 KB), both within the ±2 KB gate with room to spare; `.bundle-baseline.json` untouched; marker self-validation OK

## Task Commits

1. **Task 1: Delete the seven files and repoint every spec that read them** - `a14b4cb` (feat)
2. **Task 2: Switch the sweep and lint guard live; clear dead exports; build** - `fe0945c` (feat)
3. **Task 3: Pathways, roles, UAT and the capability matrix describe the new surfaces** - `0c910f2` (docs)

_Plan metadata commit: pending (this SUMMARY + STATE/ROADMAP, owned by the orchestrator)._

## Files Created/Modified

**Deleted:**
- `src/components/sop/AdminSopSurface.tsx`, `src/components/sop/sops-nav-types.ts`, `src/components/sop/MillerPrimitives.tsx`, `src/components/sop/lenses/AdminAttentionLens.tsx`, `src/components/sop/lenses/AdminStatusLens.tsx`, `src/components/admin/SopMillerBrowser.tsx`, `src/components/sop/SopWorkerBrowser.tsx`
- `tests/phase41/status-attention-lenses.spec.ts`

**Modified (app code):**
- `src/lib/sop/worker-signal.ts` — `topSignal()` deleted (dead, no remaining consumer), header reworded
- `src/app/(protected)/admin/sops/page.tsx` — stale header comment reworded off `AdminSopSurface.tsx`

**Rewritten/repointed (tests):**
- `tests/phase28/governance-queue.spec.ts`, `tests/phase28/library-and-worker.spec.ts` — governance-queue read/render assertions moved onto `/governance`, `GovernanceInbox.tsx`, `src/lib/governance/inbox.ts`; owner-filter/attention-deep-link assertions moved onto `AdminLibraryTable.tsx`/`admin-rows.ts`
- `tests/phase29/queue-approve-action.spec.ts` — "AdminAttentionLens" describe → "Governance inbox"; asserts `INBOX_CHIPS`' `approve` chip and the same `awaiting_approval && isCallerNextApprover` gate
- `tests/phase30/admin-nav.spec.ts` — `?view=attention` resolution assertion moved onto `resolveLibraryNav` in `admin-rows.ts`
- `tests/phase30/governance-fold.spec.ts` — full describe-block rewrite: `/governance` server read, redirect shim, approval gating, inbox chip, stuck-conversion Retry link, Access-lens reachability from the table
- `tests/phase30/list-rows.spec.ts` — full rewrite onto `AdminLibraryTable.tsx` (one row: SOP/status/owner/checks/review), `BuilderCategoryButton.tsx` (category fix), `admin-sop-list.ts` (flag/owner/no-department logic unchanged)
- `tests/phase32/library-filter-deeplink.spec.ts` — full rewrite: collection filter → `lib-chip-collection`; access-view precedence → `resolveLibraryNav`'s early `view === 'access'` return
- `tests/phase33/sop-drilldown.spec.ts` — `?sop=` deep-link entry point moved onto `resolveLibraryNav` + `AdminLibraryTable.tsx`
- `tests/phase36/worker-library-chip.spec.ts` — `SopLibraryCard` element read moved onto `WorkerSimpleList.tsx`
- `tests/phase41/nav-and-shim.spec.ts`, `tests/phase41/reference-sweep.spec.ts` — SUR-04 single-builder-chain assertions moved onto `AdminLibraryTable.tsx`/`WorkerSimpleList.tsx`
- `tests/phase52/plant-pins-no-storage.spec.ts` — (e) repointed off `SopWorkerBrowser` to a `src/`-wide scan for any file (other than `worker-signal.ts`) declaring `function plantRelState`/`function topSignal`
- `tests/phase52/plant-pins.spec.ts` — **deviation**, see below
- `tests/lint/no-static-admin-lens-import.spec.ts` — per-symbol allow-list; `sops/page.tsx` forbidden-token list updated (`listAdminSopRows`, `@/actions/admin-sop-list`, `@/lib/sop/admin-health`, `AdminAccessLens`)
- `tests/phase54/deletion-sweep.spec.ts` — all 5 `test.fixme` flipped to `test`, live and green

**Docs:**
- `src/lib/journeys/journeys.ts` — floor + machine-panel screens added to `governance-queue`; every "SOP surface (Admin scope group)" label → "SOP library (table)"; plant-entry and find-follow-sop wording updated; builder Tools step notes Change category
- `src/lib/journeys/roles.ts` — `/sops` row comment reworded (admin table, not admin-lenses scopes)
- `src/lib/uat/tests.ts` — `p41-merged-sop-surface` archived; `governance-inbox` and `library-table` added
- `.planning/codebase/CAPABILITY-MATRIX.md` — Phase 41 note rewritten as Phase 41/54; Self-add SOP row names `WorkerSimpleList.tsx`

## Decisions Made

- **`topSignal()` deleted, not kept dormant.** `grep -rn "topSignal(" src` after the file deletions found only its own definition. Per Task 2's explicit either/or, deleted it outright and reworded the module header — `plantRelState` is now worker-signal.ts's sole classifier.
- **`tests/phase52/plant-pins.spec.ts` fixed as a same-commit deviation, not a plan violation.** This file wasn't in the plan's `files_modified` list, but it carried a `topSignal (moved, unchanged behaviour)` describe block that started failing (`TypeError: topSignal is not a function`) the moment the export was removed. Rule 1 (auto-fix bugs caused by this task's own change): removed the dead-function tests and the now-unused import, leaving `plantRelState`'s tests untouched. This is the correct fix, not a scope violation — the plan's own Task 2 explicitly authorized deleting `topSignal`, and a broken test left behind by that authorized deletion is the task's own regression to fix, not new work.
- **`tests/phase41/status-attention-lenses.spec.ts` deleted outright**, matching the plan's explicit instruction — its lens subjects no longer exist, and its two safety-relevant duplicate guards (GovernanceQueueRow's approval gate, the single-builder-chain rule) already live in `tests/phase29/queue-approve-action.spec.ts` and the `tests/phase54/*` specs from 54-02/54-04, so no coverage gap opened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/phase52/plant-pins.spec.ts` broke when `topSignal` was deleted per Task 2**
- **Found during:** Task 2 verification (`npx playwright test --project=phase52`)
- **Issue:** This spec (not listed in the plan's `files_modified`) imported and unit-tested `topSignal` directly. Deleting the function per Task 2's explicit instruction left 6 tests throwing `topSignal is not a function`, and `tsc --noEmit` flagged the now-missing export.
- **Fix:** Removed the `topSignal` import and its `describe('topSignal (moved, unchanged behaviour)', ...)` block, replacing it with a one-line comment explaining the retirement; `plantRelState`'s own tests are untouched.
- **Files modified:** `tests/phase52/plant-pins.spec.ts`
- **Verification:** `npx playwright test --project=phase52` (96/96 green), `npx tsc --noEmit` (clean)
- **Committed in:** `fe0945c` (Task 2 commit)

**2. [Rule 1 - Bug] Three self-authored test assertions needed correction during Task 1 verification**
- **Found during:** Task 1 verification run (`npx playwright test --project=phase28...phase54`)
- **Issue:** (a) `tests/phase30/list-rows.spec.ts`'s new "chip changes are client state" test checked `not.toContain('router.push')`, which false-matched a comment in `AdminLibraryTable.tsx` explaining the URL-state rule (no parens). (b) `tests/phase41/nav-and-shim.spec.ts`'s forbidden-token test for the shim now checked for the literal string `AdminLibraryTable`, which I had just written into that shim's own explanatory header comment — self-tripping. (c) `tests/phase52/plant-pins-no-storage.spec.ts` (e)'s new src-wide scan excluded `worker-signal.ts` by a forward-slash path literal, but `listFiles()` returns Windows backslash paths, so the exclusion never matched and the file flagged itself for declaring `plantRelState`.
- **Fix:** (a) tightened the assertion to `'router.push('` (call-site, not prose); (b) reworded the shim's comment to avoid the exact component name; (c) normalised path separators before comparing (`f.split(path.sep).join('/')`).
- **Files modified:** `tests/phase30/list-rows.spec.ts`, `src/app/(protected)/admin/sops/page.tsx`, `tests/phase41/nav-and-shim.spec.ts`, `tests/phase52/plant-pins-no-storage.spec.ts`
- **Verification:** re-ran the full `--project=phase28 --project=phase29 --project=phase30 --project=phase41 --project=phase52 --project=phase54` set — 456/456 green
- **Committed in:** `a14b4cb` (Task 1 commit — these were fixed before the first commit, not a follow-up)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caused by this task's own edits, fixed in the same commit as the change that caused them)
**Impact on plan:** No scope creep — both fixes were required to make this task's own authorized deletions (topSignal, the seven files) actually pass the plan's stated verification. No unrelated code touched.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 54-06 (eval rewrite) can now safely assume the deleted surfaces are gone from `src/` and `tests/` (outside `tests/evals`, which 54-06 owns) — `deletion-sweep.spec.ts` will catch any regression the moment `tests/evals` joins its scan.
- `AdminLibraryTable.tsx`, `WorkerSimpleList.tsx`, `GovernanceInbox.tsx`/`inbox.ts`, `AdminFloorHealth.tsx` and `BuilderCategoryButton.tsx` are now the sole, doc-consistent homes for every capability the deleted Miller/lens surface used to provide — no dangling references, no stale docs.
- No blockers.

---
*Phase: 54-admin-inbox-floor-health-library-table*
*Completed: 2026-09-29*

## Self-Check: PASSED

- Commits `a14b4cb`, `fe0945c`, `0c910f2` all found in `git log --oneline --all`
- Claimed-deleted files (`AdminSopSurface.tsx`, `tests/phase41/status-attention-lenses.spec.ts`) confirmed absent
- Claimed-modified/live files (`worker-signal.ts`, `deletion-sweep.spec.ts`, `CAPABILITY-MATRIX.md`, `uat/tests.ts`, `journeys.ts`) confirmed present
