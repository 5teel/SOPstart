---
phase: 55-cut-the-dropped-features-one-organisation
plan: 02
subsystem: worker-path
tags: [react-query, supabase, zustand, autosave, bundle-gate]

requires:
  - phase: 55-01
    provides: worker-path-contract spec (fixme), phase55 project, bundle before-numbers
provides:
  - WorkerSopRow type (worker-signal.ts) replacing CachedSop
  - useWorkerSops(requestedIds) built from server reads only
  - useSopDetail and NowCard minutes read from Supabase
  - useBuilderSaveStatus store; builder autosave calls updateSectionLayout directly
affects: [55-06, 55-09]

tech-stack:
  added: []
  patterns:
    - "Worker list = published library query joined to getUserSopAssignments; assigned rows first"
    - "Builder autosave: 750 ms debounce, direct server action, pagehide/visibilitychange flush, status in a zustand store"

key-files:
  modified:
    - src/lib/sop/worker-signal.ts
    - src/hooks/useWorkerSops.ts
    - src/components/sop/SopLibraryCard.tsx
    - src/app/(protected)/sops/page.tsx
    - src/components/sop/plant/MachineView.tsx
    - src/hooks/useSopDetail.ts
    - src/components/sop/plant/NowCard.tsx
    - src/hooks/useBuilderAutosave.ts
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
    - scripts/autosave-rewire-check.tsx
    - tests/phase41/merged-surface.spec.ts
    - tests/phase52/plant-pins.spec.ts
    - tests/phase52/plant-pins-no-storage.spec.ts
    - tests/phase52/plant-now-card.spec.ts
    - tests/phase53/m-code-page.spec.ts
    - tests/phase26/autosave-rewire.spec.ts
    - tests/sb-layout-editor.test.ts
    - tests/phase55/worker-path-contract.spec.ts
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-VALIDATION.md

key-decisions:
  - "Overwrite-toast effect has no cleanup: clearOverwritten() re-runs the effect, and a cleanup would cancel the 4 s hide timer"
  - "Autosave flushes a pending edit on unmount as well as pagehide/visibilitychange, so switching section inside the 750 ms window does not drop the edit"

requirements-completed: [CUT-01]

duration: ~35min
completed: 2026-10-03
---

# Phase 55 Plan 02: Worker read side and builder autosave off Dexie Summary

**Worker list, SOP detail, Now-card minutes and builder autosave all read/write the server directly; `src/lib/offline` stays in place for 55-09 to delete.**

## Accomplishments

- `useWorkerSops(requestedIds)` no longer takes a cached list: assigned rows are the library rows whose id is in `getUserSopAssignments`, ordered first, then the rest of the library. Returns `assignmentsLoading` alongside `libraryLoading`.
- `/sops` loses `useAssignedSops`, `useSopSync`, the Dexie `syncMeta` query, `getRelativeTime` and the "Offline copy / Syncing / Not saved for offline yet" label; the `['assigned-sops']` invalidations are gone. The page only lost imports (bundle gate).
- `useSopDetail` is a plain Supabase read; `NowCard` sums `time_estimate_minutes` over `sop_sections(sop_steps)`.
- `useBuilderAutosave` keeps its signature and 750 ms debounce; each save calls `updateSectionLayout`. `useBuilderSaveStatus` carries `pending / lastSavedAt / error / overwrittenSectionIds`; BuilderClient's pill reads SAVING / NOT SAVED / SAVED Ns AGO and the "Updated by another admin" toast keys on `overwrittenSectionIds`.
- The three 55-02 describes in `worker-path-contract.spec.ts` are live (7 pass).

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0.
- Bundle gate: `/sops/[sopId]/page` 1030 KB (before 1045), `/sops/page` 827 KB (before 936); baseline file untouched.
- `npx playwright test` over phase55, phase52, phase41, phase26, phase53, phase15-stubs: 485 passed, 0 failed.
- `scripts/autosave-rewire-check.tsx` prints `AUTOSAVE-REWIRE OK`.
- `sb-layout-editor.test.ts`: SB-LAYOUT-04 now passes (was red in the baseline); the other 7 failures are the recorded stale Puck-era ones, left red as instructed.

## Task Commits

1. Worker list from server reads: `892943f`
2. SOP detail and Now-card minutes from Supabase: `64f9f25`
3. Builder autosave direct to `updateSectionLayout`, contracts live: `c86698a`

## Deviations from Plan

**1. [Rule 3 - Blocking] Extra source-contract specs repointed**
- **Found during:** Task 1
- **Issue:** `tests/phase53/m-code-page.spec.ts` pinned `useAssignedSops`/`useSopSync` inside MachineView, and `tests/phase52/plant-pins-no-storage.spec.ts` carried a `CachedSop` comment. Both outside the plan's file list.
- **Fix:** Repointed to `useWorkerSops` only; reworded the comment.
- **Commit:** `892943f`

**2. [Rule 1 - Bug] SB-LAYOUT-04 item 5 dropped its stale role assertion**
- The old test asserted `['admin', 'safety_manager']` in `sections.ts` (already red in baseline). Per plan, only the `updateSectionLayout` export and 128 KB cap are kept, which made the test pass.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, table, or service-role path; autosave uses the same `updateSectionLayout` gate (Zod, 128 KB cap, LWW).

## Hand-offs

- `useDraftLayoutSync`, `useSopSync`, `useAssignedSops` and `src/lib/offline/*` are now unreferenced by the worker path and builder; 55-09 deletes them.
- `MachineView` still exists (55-06 deletes it).
- Not pushed (per instruction); push belongs to the orchestrator.

## Self-Check: PASSED

- Commits `892943f`, `64f9f25`, `c86698a` exist; `src/lib/offline/db.ts` still present.
