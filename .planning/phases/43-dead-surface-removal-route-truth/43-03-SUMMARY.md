---
phase: 43-dead-surface-removal-route-truth
plan: 03

subsystem: admin-ui
tags: [dead-code-removal, upload, photo-scanner, wiring-patch-bay, wizard]

# Dependency graph
requires:
  - phase: 43-dead-surface-removal-route-truth
    plan: 01
    provides: tests/phase43/dead-controls.spec.ts fixme scaffold (5 assertions pinned) and the phase43 Playwright project registration
provides:
  - UploadDropzone -> PhotoScanner wiring (Scan document opens the real scanner, not a placeholder)
  - WiringPatchBay Wiring-only access map (Matrix/Illuminate lens options and the toggle removed)
  - Dead state removed: WizardClient sopCategoryOptions memo + categories prop, blank/page.tsx listBlockCategories fetch, versions/page.tsx selectedForCompare state pair
  - tests/phase43/dead-controls.spec.ts fully live (5/5 passing, 0 fixme remaining)
affects: [43-05-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional-mount overlay: PhotoScanner is only rendered while scannerOpen is true (not mounted-but-hidden), so React state resets on every open and each scan session starts clean"

key-files:
  created: []
  modified:
    - src/components/admin/UploadDropzone.tsx
    - src/components/admin/PhotoScanner.tsx
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
    - src/app/(protected)/admin/sops/new/blank/page.tsx
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
    - tests/phase43/dead-controls.spec.ts

key-decisions:
  - "PhotoScanner's two pre-existing no-unused-vars sources (scanButtonRef, the _url destructure) were fixed in the same commit that wires the component in, per D-02 -- the file is now live-imported so its own lint debt had to clear too"
  - "The two pre-existing react-hooks/set-state-in-effect eslint errors on versions/page.tsx are untouched, per D-02's explicit out-of-scope carve-out"

requirements-completed: [DED-02, DED-03]

duration: ~35min
completed: 2026-09-30
---

# Phase 43 Plan 03: Scanner Wiring + Dead State Removal Summary

**Scan document now opens the shipped PhotoScanner instead of a "coming soon" placeholder, WiringPatchBay's unimplemented Matrix/Illuminate lens toggle is gone, and the two confirmed dead-state blocks (sopCategoryOptions memo, selectedForCompare state) are deleted — all five dead-controls scaffold tests are live and green.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-30
- **Tasks:** 2/2 completed
- **Files modified:** 7 (6 source files + the scaffold spec)

## Accomplishments
- `UploadDropzone.tsx` imports and conditionally mounts `PhotoScanner` (only while `scannerOpen`), replacing the placeholder modal; `onSubmit` routes scanned pages through the same `validateAndAddFiles` path picked files use.
- `PhotoScanner.tsx`'s two pre-existing unused-symbol warnings cleared: `scanButtonRef` deleted (grep-confirmed unreferenced anywhere else), and the IndexedDB persist effect's `_url` destructure replaced with an explicit field pick.
- `WiringPatchBay.tsx`: `LensView`, `LENS_OPTIONS`, the `lens` state, the `matrix`/`illuminate` coming-soon early-return branch, both `<ViewToggle>` renders, and the now-orphaned `ViewToggle` import are all gone — the Access map renders only the Wiring view.
- `WizardClient.tsx`: dead `sopCategoryOptions` memo removed along with the `categories` prop, the `useMemo` import, and the `BlockCategory` type import (all confirmed unused elsewhere via grep).
- `blank/page.tsx`: the `listBlockCategories()` fetch that only fed the dead memo is gone; the page now fetches and passes only `departments`.
- `versions/page.tsx`: the `selectedForCompare`/`setSelectedForCompare` state pair and its comment removed; the Compare link's `compareUrl` usage is untouched.
- All 5 tests in `tests/phase43/dead-controls.spec.ts` flipped from `test.fixme` to `test` and pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scan document drives the shipped PhotoScanner (D-04, D-02)** - `87c8e04` (feat)
2. **Task 2: Wiring-only access map + dead state removed (D-05, D-02)** - `649c79f` (feat)

## Files Created/Modified
- `src/components/admin/UploadDropzone.tsx` - Imports `PhotoScanner`; the "Scan document placeholder modal" block replaced with a conditional `<PhotoScanner open onClose onSubmit>` mount
- `src/components/admin/PhotoScanner.tsx` - Removed unused `scanButtonRef`; persist effect now picks explicit fields (`id`, `blob`, `quality`, `detectedPageNumber`) instead of destructuring an unused `_url`
- `src/components/admin/wiring/WiringPatchBay.tsx` - Removed `LensView`, `LENS_OPTIONS`, `lens` state, the non-wiring early-return branch, both `ViewToggle` renders, and the `ViewToggle` import
- `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` - Removed `sopCategoryOptions` memo, `categories` prop, `useMemo` and `BlockCategory` imports
- `src/app/(protected)/admin/sops/new/blank/page.tsx` - Removed `listBlockCategories` fetch and import; renders `<WizardClient departments={departments} />`
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - Removed `selectedForCompare`/`setSelectedForCompare` state and its comment
- `tests/phase43/dead-controls.spec.ts` - All 5 tests flipped from `test.fixme` to `test`, all passing

## Decisions Made
- Followed 43-CONTEXT.md D-02, D-04, D-05 exactly as specified; no new judgment calls.
- Left the two pre-existing `react-hooks/set-state-in-effect` eslint errors on `versions/page.tsx` untouched, per the plan's explicit "out of scope (D-02) — do not touch them" instruction.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance-criteria grep/count matched on the first pass.

## Red-First Proof (Task 1)

Before the UploadDropzone/PhotoScanner change, flipping the scaffold test live and running it failed exactly as expected:

```
Error: expect(received).toContain(expected)
  expected substring: "import { PhotoScanner } from './PhotoScanner'"
    at tests\phase43\dead-controls.spec.ts:57:19
```

After the wiring change, the same test passed in 53ms.

## Verification Results

- `npx playwright test --project=phase43 tests/phase43/dead-controls.spec.ts` → **5 passed, 0 skipped**
- `npx playwright test tests/phase32/library-filter-deeplink.spec.ts tests/phase32/wire-up-mode.spec.ts tests/phase32/wiring-at-scale.spec.ts tests/phase33/plain-language-access.spec.ts tests/phase33/sop-drilldown.spec.ts tests/phase33/teams-ladder.spec.ts tests/phase40/dup02-metadata-picker.spec.ts tests/integration/wizard-sop-dept.spec.ts --grep-invert "sentinel __new__"` → **71 passed, 8 skipped** (skips are the documented live-chromium runtime arms; no failures, no `.planning/phases/51-site-model-machine-editor/51-BASELINE-FAILURES.md` exceptions triggered)
- `npx eslint` on all six touched source files → **0 `no-unused-vars` problems**. `versions/page.tsx` still carries its 2 pre-existing `react-hooks/set-state-in-effect` errors (out of scope per D-02, confirmed unrelated to this plan's edits).
- `npx tsc --noEmit` → clean, no output.
- `npm run build` → exit 0. Postbuild bundle gate green:
  - `/sops/[sopId]/page` = 1045 KB (baseline 1048 KB, Δ **-3 KB**, tolerance ±2 KB — under baseline, no recapture needed)
  - `/sops/page` = 936 KB (baseline 940 KB, Δ **-4 KB**, tolerance ±2 KB — under baseline, no recapture needed)
  - Bundle isolation, source-viewer isolation, Konva isolation, and marker self-validation all OK.
- `git diff --exit-code .bundle-baseline.json` → exit 0 (baseline file untouched, confirming no recapture occurred).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Journeys / Pathways Map
No routes were added, removed, or renamed by this plan (only the existing `/admin/sops/upload`, `/admin/sops/new/blank`, and `/admin/sops/[sopId]/versions` pages had internal state/props changed). `journeys.ts` requires no update.

## Next Phase Readiness
- `tests/phase43/dead-controls.spec.ts` is now fully live (0 fixme remaining) — 43-05's verification pass can run it as a plain green gate.
- No blockers for 43-04 (route shims) or 43-05 (verification/eval).

---
*Phase: 43-dead-surface-removal-route-truth*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 3 commit hashes (`87c8e04`, `649c79f`, `32eb567`) verified in `git log`.
