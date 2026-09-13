---
phase: 41-one-sop-surface
plan: 04
subsystem: admin-status-attention-lenses
tags: [react-query, nextjs, client-components, refactor]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 01
    provides: phase41 Playwright project, two-route bundle gate, static-import leak guard (AdminStatusLens/AdminAttentionLens pre-allowlisted)
  - phase: 41-one-sop-surface
    plan: 02
    provides: listAdminSopRows server action, frozen AdminSopListResult shape, flag-display.ts maps
provides:
  - AdminStatusLens client component (src/components/sop/lenses/AdminStatusLens.tsx) — props { status, ownerOnly, departments?, collection?, onResult?, onClearFilter }
  - AdminAttentionLens client component (src/components/sop/lenses/AdminAttentionLens.tsx) — props { onBack }
affects: [41-05-merged-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lens wraps an unmodified admin component (SopMillerBrowser / GovernanceQueueRow) behind a useQuery fetch, matching the AdminAccessLens shape from 41-03 — same file IS the next/dynamic({ ssr: false }) chunk boundary"
    - "Scope/filter exits are callbacks (onClearFilter, onBack), never <Link>/router.push, so a merged-page scope change never fires an RSC fetch through the service worker (CLAUDE.md 2026-05-13)"

key-files:
  created:
    - src/components/sop/lenses/AdminStatusLens.tsx
    - src/components/sop/lenses/AdminAttentionLens.tsx
    - tests/phase41/status-attention-lenses.spec.ts

key-decisions:
  - "AdminStatusLens's 'Open in library (N)' banner condition is `data.filtered && !departments` — matching the original page's `filterIds !== null && !departmentFilter` exactly, so the banner shows only for a ?collection= deep link, never for a department-scope filter (which carries its own scope label instead)."
  - "AdminAttentionLens re-derives flaggedRows/rowFlag/attentionGroups from the raw listGovernanceQueue() rows rather than having the action return pre-grouped data — keeps the action's return shape ({ success, rows } | { error }) unchanged and reusable by any future caller, and matches the plan's explicit instruction to copy the grouping logic verbatim into the lens."

requirements-completed: [SUR-02, SUR-04, SUR-05]

# Metrics
duration: 35min
completed: 2026-09-13
---

# Phase 41 Plan 04: Status + Attention Lenses Summary

**Built `AdminStatusLens` (wraps the unmodified `SopMillerBrowser`, fed by `listAdminSopRows`) and `AdminAttentionLens` (wraps the unmodified `GovernanceQueueRow`, fed by `listGovernanceQueue`, grouped worst-flag-first) as the two remaining admin lenses for the merged `/sops` surface — both self-guarding via their underlying server actions, both exiting only through callbacks.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 3 (all created)

## Accomplishments

- `src/components/sop/lenses/AdminStatusLens.tsx` — `'use client'`, fetches `listAdminSopRows` via one `useQuery` keyed on `[status, ownerOnly, departments, collection]` (`staleTime: 60s`), renders loading (pulse skeleton, `lg:col-span-2`) / error (`blueprint-frame` ERROR panel with the returned string) / success (filtered banner + `SopMillerBrowser`) states. The "Open in library (N)" banner's `Clear filter` is a `<button onClick={onClearFilter}>`, never a `<Link>`. `onResult` is invoked from a `useEffect` keyed on the query data so the merged page can reuse this single fetch for its scope-column counts. Zero references to `admin/sops/builder` — `SopMillerBrowser` itself is untouched and remains the only file with that route string.
- `src/components/sop/lenses/AdminAttentionLens.tsx` — `'use client'`, fetches `listGovernanceQueue` via one `useQuery` (`staleTime: 60s`), re-derives `flaggedRows`/`rowFlag` (`FLAG_PRIORITY.find`)/`attentionGroups` from `41-02`'s `flag-display.ts` maps exactly as `admin/sops/page.tsx`'s attention-view branch does, renders the CLEAR panel when there are zero groups, otherwise one `<section>` per non-empty group with `GovernanceQueueRow` rows. Renders full width (no Miller frame), exits via `onBack` only. `GovernanceQueueRow.tsx` confirmed byte-identical (`git diff --stat` empty) both before and after this plan.
- `tests/phase41/status-attention-lenses.spec.ts` — 18 comment-stripped source-contract assertions covering both lenses (registered and passing under `--project=phase41 -g "lens"`, exceeding the ≥12 acceptance bar), plus 3 preservation assertions duplicating the phase29 APR-03/04 approval-gating contract onto `GovernanceQueueRow`, plus 2 SUR-04 assertions (the single builder link lives only in `SopMillerBrowser`; zero other lens/worker-browser/sops-page files reference it). Mutation-proven both ways: injecting a `<Link href="/admin/sops/builder/x">` into `AdminStatusLens.tsx` fails the SUR-04 sweep; changing `FLAG_PRIORITY.find(` to `FLAG_PRIORITY.filter(` in the attention lens fails the worst-flag assertion. Both reverted cleanly (`git status --short` empty afterward).
- `npm run build` — exits 0; postbuild bundle gate reports `/sops/[sopId]/page` and `/sops/page` both at **Δ 0 KB** — neither lens is yet referenced by `sops/page.tsx` (that wiring is 41-05's job), so this plan adds nothing to the client graph.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build AdminStatusLens** - `e56c368` (feat)
2. **Task 2: Build AdminAttentionLens** - `6f75335` (feat)
3. **Task 3: Source-contract spec for both lenses** - `070252f` (test)

## Files Created/Modified

- `src/components/sop/lenses/AdminStatusLens.tsx` — `AdminStatusLens` client lens
- `src/components/sop/lenses/AdminAttentionLens.tsx` — `AdminAttentionLens` client lens
- `tests/phase41/status-attention-lenses.spec.ts` — mutation-proven source-contract spec

## Decisions Made

- Banner visibility condition (`data.filtered && !departments`) documented in frontmatter `key-decisions` — 41-05 should not need to touch this when wiring the lens in, since the prop it depends on (`departments`) is passed straight through from the merged page's own filter state.
- Kept `listGovernanceQueue`'s return shape unmodified; the grouping/worst-flag logic lives in the lens (duplicated from the old page, same pattern 41-02 used for `listAdminSopRows`'s row mapping) rather than pushed into the action.

## Deviations from Plan

None — plan executed exactly as written. One self-caught test-authoring bug during Task 3 (the "onResult inside useEffect" assertion initially matched the `import { useEffect } from 'react'` line instead of the actual `useEffect(` call, giving a false red before any mutation testing) — fixed by searching for `useEffect(` instead of `useEffect`, then verified green before mutation-proving. Not a deviation from the plan's code, only a fix to the new test's own search string.

## Verification

- `npx tsc --noEmit` — exits 0
- `npm run build` — exits 0; `/sops/[sopId]/page` and `/sops/page` both Δ 0 KB
- `npx playwright test --project=phase41 --project=phase15-stubs --project=phase28 --project=phase29 --project=phase30` — 322 passed, 22 skipped (pre-existing fixme/live-DB tests unrelated to this plan), 0 failed
- `npx playwright test --project=phase41 -g "lens"` — 18 tests selected and passed
- Mutation proof 1 (builder `<Link>` injected into `AdminStatusLens.tsx`): failed correctly, reverted, re-verified green
- Mutation proof 2 (`FLAG_PRIORITY.find(` → `FLAG_PRIORITY.filter(` in attention lens): failed correctly, reverted, re-verified green
- `git diff --stat -- src/components/admin/governance/GovernanceQueueRow.tsx` — empty (untouched)
- `git status --short` — clean on `src/` throughout (no stray modifications from mutation testing)

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `AdminStatusLens` (`{ status, ownerOnly, departments?, collection?, onResult?, onClearFilter }`) and `AdminAttentionLens` (`{ onBack }`) are ready for 41-05 to wire into `sops/page.tsx` behind `next/dynamic({ ssr: false })` calls, alongside 41-03's `AdminAccessLens`, all gated by `useIsAdmin()`.
- All three admin lenses (status, attention, access) now exist with the same callback-exit, self-guarding-action shape — 41-05 has a consistent contract to compose against.
- No blockers. `admin/sops/page.tsx` remains fully functional and unmodified (this plan touched no page file), so nothing regresses before the shim lands in 41-06.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 3 created files confirmed present on disk; all 3 task commit hashes (`e56c368`, `6f75335`, `070252f`) confirmed in `git log --oneline --all`.
