---
phase: 54-admin-inbox-floor-health-library-table
plan: 04
subsystem: ui
tags: [admin-table, worker-list, bundle-isolation, nextjs-dynamic, deep-links]

requires:
  - phase: 54-01
    provides: admin-health.ts (deriveChecks/tableStatus/CHECK_ORDER), MillerSop check-input fields, listAdminSopRows extensions
  - phase: 54-02
    provides: "/governance route (view=attention redirect target)"
provides:
  - AdminLibraryTable.tsx — admin checks table with Where/Status/Owner/Checks chips, Access lens lazy takeover
  - resolveLibraryNav/libraryNavToUrl/DEFAULT_LIBRARY_NAV (src/lib/sop-list/admin-rows.ts) — pure deep-link resolver
  - WorkerSimpleList.tsx — stacked worker list fallback with self-add/remove on each row
  - BuilderCategoryButton.tsx — category picker relocated into the builder Tools menu
  - sops/page.tsx rewritten — no Miller frame, admin branch mounts AdminLibraryTable, everyone else mounts SopsSection -> WorkerSimpleList
  - check-bundle-size.ts library-table marker group on both gated routes + recursive self-validation corpus
affects: [54-05, 54-06]

tech-stack:
  added: []
  patterns:
    - "one admin-only surface = one next/dynamic({ ssr:false }) module gated on a boolean the page computes, never the module's own internal state"
    - "pure URL<->state resolver colocated with its row-shaping helpers (admin-rows.ts), unit-tested directly via static @/ imports"

key-files:
  created:
    - src/components/admin/AdminLibraryTable.tsx
    - src/components/sop/WorkerSimpleList.tsx
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderCategoryButton.tsx"
  modified:
    - src/lib/sop-list/admin-rows.ts
    - src/lib/sop/worker-signal.ts
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx"
    - "src/app/(protected)/sops/page.tsx"
    - scripts/check-bundle-size.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase54/library-table.spec.ts
    - tests/phase41/merged-surface.spec.ts
    - tests/phase41/bundle-gate.spec.ts
    - tests/phase41/spec-repoint-inventory.spec.ts
    - tests/phase52/plant-render-seam.spec.ts
    - tests/phase53/phone-home-fallback.spec.ts

key-decisions:
  - "check circles use h-4/w-4 (16px), not the sketch's literal 18px — h-4.5/w-4.5 is not a Tailwind default spacing step and silently compiles to nothing (CLAUDE.md 2026-09-28 class); caught by grepping .next/static/css/*.css for the class before declaring done, per the plan's own instruction."
  - "AdminLibraryTable's useQuery is enabled: nav.view === 'table' so the Access-lens takeover doesn't pay for an unused admin-sop-rows fetch."
  - "SopsSection no longer receives departments/selectedDeptIds/allDepartments/onDeptSelect props — the Miller frame's 'By department' rail rows are gone with the frame itself; department selection is the DepartmentBottomSheet button only, at every viewport."

requirements-completed: [ADM-03]

duration: ~50min
completed: 2026-09-29
---

# Phase 54 Plan 04: Library table + worker simple list Summary

Admin `/sops` is now a plain checks table (SOP · Machine · Status · Owner · Checks · Review, five colour-coded circles per row) behind one `next/dynamic({ssr:false})` module gated on `isAdmin && viewport === 'desktop'`; every other session (worker, or admin below 1024px) gets `WorkerSimpleList`, a flat stacked list with self-add/remove on each row — `sops/page.tsx` no longer renders a Miller frame for anyone, and both gated routes shrank (`/sops/page` 940→935 KB, `/sops/[sopId]/page` 1048→1043 KB).

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 completed
- **Files modified:** 15 (3 created, 12 modified)

## Accomplishments
- `AdminLibraryTable.tsx` + `resolveLibraryNav`/`libraryNavToUrl` (`src/lib/sop-list/admin-rows.ts`): pure deep-link resolver (`?departments=`/`?collection=`/`?status=`/`?owner=me` resolve onto the table; `?view=attention` → the `'governance'` sentinel; `?view=access` drops departments/collection per SC-4) plus the table itself — checks from `deriveChecks`/`tableStatus`, never re-derived, Access lens as a lazy takeover inside the same module
- `WorkerSimpleList.tsx`: the retired Miller frame's scope strip + department-sheet button, plus self-add/remove relocated onto each row (the desktop detail pane was their only home before)
- `BuilderCategoryButton.tsx`: the category fix relocated into the builder Tools menu, writing through the existing `setSopCategory`, mounted in `BuilderStageShell.tsx` beside `BuilderMachinesButton`
- `sops/page.tsx` rewritten: `AdminSopSurface`, `MillerPrimitives`, `sops-nav-types`, `EMPTY_ADMIN` and the whole Miller-frame grid are gone; the admin branch mounts `AdminLibraryTable`, everyone else mounts the single `SopsSection` call site, which in turn mounts `PlantHome` / `PhoneHome` / `WorkerSimpleList` depending on viewport and site state — unchanged from Phase 52/53
- `check-bundle-size.ts`: `library table (AdminLibraryTable.tsx)` marker group added to both gated routes; `collectSelfValidationCorpus` now walks `.next/static/chunks` and the `/governance` server route recursively (not a flat `readdir`) so route-nested chunks still count
- Every stale guard repointed in the same commit: `tests/phase41/merged-surface.spec.ts` (full rewrite for the new gate/branch shape), `tests/phase41/bundle-gate.spec.ts`, `tests/phase52/plant-render-seam.spec.ts`, `tests/phase53/phone-home-fallback.spec.ts` (one `SopsSection` call site now, not two)

## Task Commits

1. **Task 1: AdminLibraryTable + the pure deep-link resolver** - `9d0e51a` (feat)
2. **Task 2: WorkerSimpleList + builder category picker** - `7877681` (feat)
3. **Task 3: swap /sops onto the table and the simple list** - `b12e78f` (feat)

**Plan metadata:** (this commit) docs: complete plan

## Files Created/Modified
- `src/components/admin/AdminLibraryTable.tsx` - the admin checks table, chips, deep-link resolution, Access lens takeover
- `src/lib/sop-list/admin-rows.ts` - `LibraryNav`/`resolveLibraryNav`/`libraryNavToUrl`/`DEFAULT_LIBRARY_NAV` added
- `src/components/sop/WorkerSimpleList.tsx` - stacked worker list, scope strip, self-add/remove per row
- `src/lib/sop/worker-signal.ts` - `WorkerScope` type moved here from `sops-nav-types.ts` (54-05 deletes that file)
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderCategoryButton.tsx` - Tools-menu category picker
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` - mounts `BuilderCategoryButton`
- `src/app/(protected)/sops/page.tsx` - rewritten: no Miller frame, one `AdminLibraryTable`/`SopsSection` branch
- `scripts/check-bundle-size.ts` - library-table marker group, recursive self-validation walk
- `.planning/codebase/CAPABILITY-MATRIX.md` - admin-lenses row rewritten for the table + Access lens
- `tests/phase54/library-table.spec.ts` - resolver unit tests, table wiring, surviving-affordances, page-seam (24 → 30 live tests, 0 fixme)
- `tests/phase41/merged-surface.spec.ts`, `tests/phase41/bundle-gate.spec.ts`, `tests/phase41/spec-repoint-inventory.spec.ts`, `tests/phase52/plant-render-seam.spec.ts`, `tests/phase53/phone-home-fallback.spec.ts` - repointed for the new surface shape

## Decisions Made
See `key-decisions` in frontmatter. The 18px→16px check-circle size deviation is the only visible-behaviour change from the plan's literal spec; it was forced by a genuinely undefined Tailwind utility (`h-4.5`/`w-4.5` is not on the default spacing scale — confirmed by grepping the compiled CSS for the class and finding no rule, per the plan's own required check).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `h-4.5 w-4.5` check circles compiled to nothing**
- **Found during:** Task 3, the plan's own instruction to `grep -l "h-4\.5" .next/static/css/*.css` after `npm run build`
- **Issue:** `h-4.5`/`w-4.5` are not steps on Tailwind's default spacing scale (which jumps 3.5 → 4 → 5, no 4.5) and the project has no custom `--spacing-4.5` token, so the classes silently compiled to zero CSS rules — the check circles would have rendered at native (0-height) size, invisible, exactly the CLAUDE.md 2026-09-28 failure class.
- **Fix:** Changed to `h-4 w-4` (16px, on-scale) in `AdminLibraryTable.tsx`.
- **Files modified:** `src/components/admin/AdminLibraryTable.tsx`
- **Verification:** Re-ran `npm run build` and confirmed the design-tokens/no-undefined-css-tokens lint specs pass (they don't catch this class, so the compiled-CSS grep remains the load-bearing check).
- **Committed in:** `9d0e51a` (Task 1 commit)

**2. [Rule 3 - Blocking] `spec-repoint-inventory.spec.ts` flagged the rewritten `merged-surface.spec.ts`**
- **Found during:** Task 3 regression run (`--project=phase41 --project=phase52 --project=phase54 --project=phase30`)
- **Issue:** The rewritten `merged-surface.spec.ts` reads `admin/sops/page.tsx` (the redirect shim) to assert it still passes every legacy param through and redirects `view=attention` to `/governance` — `tests/phase41/spec-repoint-inventory.spec.ts` treats any non-allowlisted CODE reference to that path as a stale-guard violation.
- **Fix:** Added `tests/phase41/merged-surface.spec.ts` to `spec-repoint-inventory.spec.ts`'s `ALLOWLIST`, with a doc-comment entry mirroring the existing five (same pattern as 54-01's identical fix for `deletion-sweep.spec.ts`).
- **Files modified:** `tests/phase41/spec-repoint-inventory.spec.ts`
- **Committed in:** `b12e78f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for correctness (an invisible check circle would have defeated the table's whole purpose) and to keep an unrelated stale-guard sweep green. No scope creep.

## Known Stubs

None — every row in `AdminLibraryTable` comes from `listAdminSopRows` (real, org-scoped data); `WorkerSimpleList` renders the same `useWorkerSops` derivation the plant/phone homes already use.

## Bundle Numbers (recorded per plan instruction)

| Route | Before | After | Δ |
|---|---|---|---|
| `/sops/page` | 940 KB | 935 KB | −5 KB |
| `/sops/[sopId]/page` | 1048 KB | 1043 KB | −5 KB |

`.bundle-baseline.json` untouched (`git diff --quiet .bundle-baseline.json` passes) — the Miller frame + its primitives leaving the always-loaded chunk shrank both routes, as the plan predicted.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `AdminSopSurface.tsx`, its three lens wrapper files (`AdminStatusLens`/`AdminAttentionLens`/`AdminAccessLens` — `AdminAccessLens` is still imported, now from `AdminLibraryTable.tsx`, so only `AdminStatusLens`/`AdminAttentionLens` are truly orphaned), `MillerPrimitives.tsx`, `SopWorkerBrowser.tsx`, `SopMillerBrowser.tsx` and `sops-nav-types.ts` are now unreferenced from any live import graph — 54-05 deletes them and repoints the specs that still name them.
- No blockers. `npm run build` green, both gated routes within tolerance, marker self-validation OK, `npx tsc --noEmit` clean.

---
*Phase: 54-admin-inbox-floor-health-library-table*
*Completed: 2026-09-29*

## Self-Check

- `src/components/admin/AdminLibraryTable.tsx` — FOUND
- `src/components/sop/WorkerSimpleList.tsx` — FOUND
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderCategoryButton.tsx` — FOUND
- Commit `9d0e51a` — FOUND in `git log`
- Commit `7877681` — FOUND in `git log`
- Commit `b12e78f` — FOUND in `git log`

## Self-Check: PASSED
