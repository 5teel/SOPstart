---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 06
subsystem: ui
tags: [read-view, react-query, supabase-rls, server-action, capability-matrix]
requires: [63-02, 63-04, 63-05]
provides:
  - src/lib/sop/focus-assemble.ts (assembleFocus)
  - src/hooks/useReadSop.ts (useReadSop)
  - src/actions/sop-owner.ts (getSopOwner)
  - src/components/home/ReadView.tsx (ReadView)
affects: [63-11, 63-15]
key-files:
  created:
    - src/lib/sop/focus-assemble.ts
    - src/hooks/useReadSop.ts
    - src/actions/sop-owner.ts
    - src/components/home/ReadView.tsx
    - tests/phase63/read-view.spec.ts
  modified:
    - src/lib/sop/focus-read.ts
    - src/components/home/SopRow.tsx
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "assembleFocus is generic over the section and step row types, so loadFocusSop keeps its richer FocusStepRow and the browser hook keeps a slim ReadStep; output of loadFocusSop is unchanged (phase58 219 passed)"
  - "The status-dot colour map in SopRow is exported (DOT) and reused by ReadView so the list row and Read say the same thing in the same colour"
  - "Minutes in Read come from the list row (same derivation as the list), so the two cannot disagree"
requirements-completed: []
duration: 35min
completed: 2026-10-08
---

# Phase 63 Plan 06: Read view Summary

**A browser-client Read view for the home's reader pane: shared ordering with the focus screen through one extracted pure module, the owner name for supervisor and up only, and Make a request / Ask / Edit carried over from the retired surfaces. Built unmounted; 63-11 mounts it and 63-15 adds the merge.**

## Extraction

`src/lib/sop/focus-assemble.ts` (no directive, no Supabase, no members): `assembleFocus({ sopId, sections, steps, standards, attachments })` returns `{ sections, steps (section rank then sort_order), standards: { sop, sections, steps }, totalMinutes }`. `loadFocusSop` now calls it once (image signing, machines and the objective stay in place); `useReadSop` calls it with browser-read rows.

## Hook

`useReadSop(sopId)` key `['read-sop', sopId]`, enabled on a non-null id, staleTime 2 min. Browser client only: `sops` row, `sop_sections`, `sop_focus_steps`, `standards` and `standard_attachments` for the SOP's org. Returns `{ sop, sections, steps, standards, totalMinutes }`, or `null` when RLS returns no SOP (T-63-17).

## Action gate

`getSopOwner(sopId)` ('use server', async exports only): zod UUID, `getSessionContext()`, role must be supervisor / admin / safety_manager before any read (a worker gets `{ error: 'Not allowed' }`), session client read of `sops.owner_user_id` filtered to the session org, name from `memberLabel(userLabels())`. No service-role import in the file.

## Matrix row (CAPABILITY-MATRIX.md)

`SOP owner name on Read (home)` -- worker `—`, supervisor / admin / safety_manager `✅` -- enforced at `getSopOwner()` (role check from the session before any read, session-org filter, label helper, T-59-30 unchanged for workers).

## ReadView structure

Props `{ row, role, from, backLabel, onBack }`. Back button (`read-back`); `Wordmark chip merge data-fuse="sop"`; title; meta line with area swatch, type, version, owner (supervisor up), minutes; standards labels; status line; start button (`read-start`, `data-fuse="button"`, aria-label "start") holding `Wordmark start onInk data-fuse="start"`; note "Picks up at step N of M · or begin from step 1" (`read-begin-again`) or "n steps"; quiet row: Make a request (lazy), Ask (lazy, supervisor up), Edit link (admin / safety_manager); "What you'll do" ordered list from `walkOrder` with the existing `KindChip`. Start currently `router.push(focusHref(...))` with a prefetch on mount (63-15 replaces the click). Missing SOP: "This SOP isn't in your library." Loading: two pulse bars.

## Verification

- `npx tsc --noEmit` exit 0.
- phase63 `read view`: 9 passed (whole phase63 project: 64 passed).
- phase58: 219 passed, 9 skipped. phase59 `capability-matrix`: 8 passed. phase46 `capability-matrix-doc`: 9 passed.
- phase15-stubs `design-tokens`, `no-undefined-css-tokens`, `no-dead-internal-hrefs`: 13 passed (first run failed on a `rounded-sm` swatch, fixed to `rounded`).
- `npm run build` exit 0; bundle gate green: `/page` 837 KB (baseline 837, delta 0), `/sops/[sopId]/page` 795 KB (baseline 795, delta 0). `.bundle-baseline.json` untouched. ReadView is unmounted so no route moved.

## Deviations from Plan

- **SopRow edit (not in the plan's file list):** `DOT` is now exported so ReadView does not copy it. One word changed.
- Specs written with the code, green first run for task 1; task 2's first lint run caught the `rounded-sm`.
- Not visually checked: ReadView is unmounted until 63-11; the first look is the 63-12 deployed run.

## Known Stubs

None. The start button's click is deliberately the plain navigation until 63-15.

## Task Commits

1. Task 1 (extraction, hook, action, matrix row, spec): `3e0940a5`
2. Task 2 (ReadView): `bd027f67`

## Self-Check: PASSED

All new files exist; both commits are in `git log`.
