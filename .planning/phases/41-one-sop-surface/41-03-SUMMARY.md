---
phase: 41-one-sop-surface
plan: 03
subsystem: admin-access-view
tags: [server-actions, nextjs, refactor, extraction, wiring-patch-bay]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 01
    provides: phase41 Playwright project, two-route bundle gate, static-import leak guard (AdminAccessLens pre-allowlisted)
provides:
  - listAdminAccessData server action (src/actions/admin-access-view.ts) — org tree, grants, collections, sopsByCollection, deptMembers, pinned newSop
  - AdminAccessLens client component (src/components/sop/lenses/AdminAccessLens.tsx) — props { pinnedSopId?, onBack }
affects: [41-05-merged-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-guarding server action returning the exact prop shape of the client component it feeds (AdminAccessData === WiringPatchBayShellProps minus orgName), so the lens can spread the result directly"
    - "Lens file IS the next/dynamic({ ssr: false }) chunk boundary — WiringPatchBayShell is imported statically inside it, allowlisted by tests/lint/no-static-admin-lens-import.spec.ts"
    - "Scope exit via callback (onBack), never <Link>/router.push — a client-side lens must not trigger an RSC fetch through the service worker on exit (CLAUDE.md 2026-05-13)"

key-files:
  created:
    - src/actions/admin-access-view.ts
    - src/components/sop/lenses/AdminAccessLens.tsx
    - tests/phase41/access-lens.spec.ts

key-decisions:
  - "AdminAccessData field list (frozen here for 41-05's wiring): { tree: OrgTree; collections: WiringCollection[]; sopsByCollection: Record<string, WiringSop[]>; grants: GrantRow[]; newSop: WiringNewSop | null; deptMembers: Record<string, string[]> } — exactly WiringPatchBayShell's props (minus optional orgName, not sourced by the old page either)."
  - "GrantRow (grants.ts) is returned instead of AccessGrant (org-model.ts) — structurally assignable (GrantRow is a superset: id/grantedBy/createdAt extra), so WiringPatchBayShell's grants: AccessGrant[] prop accepts it without a mapping step."

requirements-completed: [SUR-02, SUR-05]

# Metrics
duration: 40min
completed: 2026-09-13
---

# Phase 41 Plan 03: Admin Access-View Extraction Summary

**Extracted the `?view=access` wiring patch-bay data assembly (org tree, grants, collections, per-collection SOP drill-down, department-membership index, pinned `?sop=` new-SOP row) into one self-guarding `listAdminAccessData` server action, and wrapped the unmodified `WiringPatchBayShell` in a client lens (`AdminAccessLens`) that fetches it via `useQuery` with a callback-only exit.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 3 (all created)

## Accomplishments

- `src/actions/admin-access-view.ts` — `listAdminAccessData`, the only value export, `'use server'`, opens with `requireAdminContext()` before both the `ensureSopCollections` call and the first raw `.from(` read (mutation-proven positionally, not just presence-checked). Preserves the CR-01/CR-02 ordering exactly: a pinned `?sop=` is ensured into a collection BEFORE the collections list is read, so a just-created category collection appears in the right column. Uses the session RLS client throughout — `createAdminClient` appears zero times. The single `.in('collection_id', ids)` join read on `sop_collections -> sops(id, title, status)` is preserved (SC-2, 33-08) — not one read per collection. Takes no `departments`/`collection` parameter, matching the `!isAccessView` precedence rule in the current page (those Phase 33 filters stay inert under the access view).
- `src/components/sop/lenses/AdminAccessLens.tsx` — `'use client'`, renders loading (pulse-skeleton, matching the worker-side idiom)/error (`blueprint-frame` ERROR panel, rendering the actual returned error string)/success (`WiringPatchBayShell` spread from the action result) states via one `useQuery` (`staleTime: 0` so wiring writes are reflected on refetch). Statically imports `WiringPatchBayShell` — correct and required, since this file IS the dynamic-chunk boundary `sops/page.tsx` will load via `next/dynamic({ ssr: false })` in 41-05; already allowlisted by 41-01's `tests/lint/no-static-admin-lens-import.spec.ts`. Renders full width (no Miller frame), matching the current access-view branch. Exit is `onBack` — copy changed to "← Back to your SOPs" per D-05 (no nav-label "Library").
- `tests/phase41/access-lens.spec.ts` — 15 comment-stripped source-contract assertions covering both files, registered and passing under `--project=phase41 -g "access"` (15 selected, exceeding the ≥8 acceptance bar). Mutation-proven both ways: moving `ensureSopCollections` below the collections read fails the CR-02 ordering assertion (confirmed exact failure, reverted via `git checkout --`); replacing `onBack` with `<Link href="/sops">` fails the no-navigation assertion (confirmed, reverted). `git status --short` returned clean after both reverts.
- `npm run build` — exits 0; postbuild bundle gate reports `/sops/[sopId]/page` and `/sops/page` both at **Δ 0 KB** — this plan adds nothing to the client graph yet (the lens is not referenced by `sops/page.tsx` until 41-05), confirming zero accidental bundle impact.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract listAdminAccessData as a self-guarding server action** - `32c2fd9` (feat)
2. **Task 2: Build AdminAccessLens** - `dd095d0` (feat)
3. **Task 3: Source-contract spec for the access lens and its action** - `ba14b67` (test)

## Files Created/Modified

- `src/actions/admin-access-view.ts` — `listAdminAccessData` server action, `AdminAccessData` type
- `src/components/sop/lenses/AdminAccessLens.tsx` — `AdminAccessLens` client lens
- `tests/phase41/access-lens.spec.ts` — mutation-proven source-contract spec

## Decisions Made

- Froze the `AdminAccessData` field list (see frontmatter `key-decisions`) so 41-05 has a stable contract to wire the lens against — it is exactly `WiringPatchBayShell`'s prop set.
- Returned `GrantRow[]` (from `grants.ts`, carrying `id`/`grantedBy`/`createdAt`) rather than mapping down to the narrower `AccessGrant[]` type `WiringPatchBayShellProps` declares — TypeScript's structural typing accepts the superset directly, so no extra mapping step was needed or added.

## Deviations from Plan

None — plan executed exactly as written. Guard ordering, CR-02 ordering, the single join read, the departments/collection-free params type, the callback-only exit, and the bundle-neutrality claim were all verified directly during execution (including two live mutation-proof runs), not assumed.

## Verification

- `npx tsc --noEmit` — exits 0
- `npm run build` — exits 0; `/sops/[sopId]/page` and `/sops/page` both Δ 0 KB
- `npx playwright test --project=phase41 --project=phase15-stubs` — 125 passed, 19 skipped (pre-existing fixme/live-DB tests unrelated to this plan), 0 failed
- `npx playwright test --project=phase41 -g "access"` — 15 tests selected and passed
- Mutation proof 1 (ensureSopCollections ordering): failed correctly, reverted, re-verified green
- Mutation proof 2 (onBack → `<Link href="/sops">`): failed correctly, reverted, re-verified green
- `git status --short` — clean on `src/` throughout (no stray modifications from mutation testing)

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `listAdminAccessData` and `AdminAccessLens` are ready for 41-05 to wire into `sops/page.tsx` behind a `next/dynamic({ ssr: false })` call, gated by `useIsAdmin()`, alongside the 41-02/41-04 lenses.
- `AdminAccessLens`'s prop signature (`{ pinnedSopId?: string; onBack: () => void }`) is the contract 41-05 should call it with — `pinnedSopId` should come from the `?sop=` search param, `onBack` should return the scope to the worker/admin list scope group.
- No blockers. `admin/sops/page.tsx` remains fully functional and unmodified (this plan touched no page file), so nothing regresses before the shim lands in 41-06.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 3 created files confirmed present on disk; all 3 task commit hashes (`32c2fd9`, `dd095d0`, `ba14b67`) confirmed in `git log --oneline --all`.
