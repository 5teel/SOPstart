---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 08
subsystem: ui
tags: [react, wiring-patch-bay, org-model, access-grants, playwright, next.js]

# Dependency graph
requires:
  - phase: 33-05
    provides: "createGrant/revokeGrant SOP-target arm (collectionId XOR sopId), narrowing-override materialization"
  - phase: 33-06
    provides: "Full org ladder (site/area/dept/role/person) in WiringPatchBay teams column, generalized leftEndpoint"
provides:
  - "Collection->SOP drill-down: expandedCollections state, SOP rows nested under their collection, reusing the shipped pinned-SOP child-row pattern"
  - "Organic choose-mode: ANY SOP row (pinned or drilled-down) enters wire-up via a generalized enterWireUp(sopId)/activeSop — the ?sop= URL pin survives only as a deep-link pre-select/pre-expand nicety"
  - "handleDone now writes SOP-target grants (createGrant({..., sopId})) instead of iterating collectionIds — the 'no collection' dead-end guard is gone"
  - "rightEndpoint: SOP-target wire anchors at the SOP row when its collection is expanded, else collapses to the collection jack with an aggregated count (mirrors leftEndpoint)"
  - "sopGrantsByUnit + a second resolveEffectiveAccess() pass so SOP-target grants inherit down the org chain exactly like collection grants"
  - "Overridden SOPs (any direct SOP-target grant) render a neutral 'CHOSEN BY NAME' row pill, derived client-side from grants"
  - "page.tsx sopsByCollection assembly via one .in('collection_id', ids) join read on sop_collections->sops, replacing the old count-only read (no new serial await)"
affects: [33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second grant-kind resolveEffectiveAccess() pass (Pattern 1): the pure resolver is target-agnostic, so feeding it sopGrantsByUnit instead of grantsByUnit gets SOP-target inheritance for free — no second resolver written"
    - "Parallel raw-edges arrays (rawEdges/rawSopEdges) instead of a unified/tagged edge type, specifically to keep the pinned rawEdges push line byte-identical for the shipped wiring-at-scale.spec.ts guard"

key-files:
  created: []
  modified:
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/components/admin/wiring/WiringPatchBayShell.tsx
    - src/app/(protected)/admin/sops/page.tsx
    - tests/phase32/wire-up-mode.spec.ts
    - tests/phase33/sop-drilldown.spec.ts

key-decisions:
  - "enterWireUp generalized to take a sopId parameter (not renamed to a new function) — keeps the pinned identifier name while evolving its semantics from 'the one pinned newSop' to 'the selected SOP', per RESEARCH Pattern 4's explicit instruction"
  - "SOP-target edges kept in a separate rawSopEdges/visibleSopEdges array rather than unioned into the existing rawEdges — avoids touching the wiring-at-scale.spec.ts pinned push-line literal, zero repoint needed for that file"
  - "grantsByUnit gained a guard (skip grants with null collectionId) — a Rule 1 bug fix: without it, 33-05's SOP-target grants (which have collectionId=null) would push null into the collection resolver's grant lists"
  - "The pinned newSop deep-link is merged into sopById/sopParentCollection (falling back to its own collectionIds field) rather than requiring the sopsByCollection join to have already caught up — avoids a race between ensureSopCollections' write and the same-request read"
  - "Only the deep-linked newSop shows the NEW · UNWIRED/WIRED pill; every other SOP row shows CHOSEN BY NAME only when overridden (has a direct SOP-target grant) — the old 'sopWired' semantic (collection has any grant) was misleading for ordinary rows and is gone"

requirements-completed: [SC-2, SC-3]

# Metrics
duration: ~50min
completed: 2026-07-19
---

# Phase 33 Plan 08: Collection->SOP drill-down + organic choose-mode + rightEndpoint Summary

**Collections in the access map now expand in place to nested SOP rows; clicking any SOP (not just the post-publish pinned one) enters choose-mode and writes a SOP-target grant via createGrant({sopId}), making it chosen-by-name — closing G2 and shipping SC-3's UI entry point.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `WiringPatchBay` grows `expandedCollections` (mirrors `expandedAreas`/`expandedDepts`/`expandedRoles`) with a twist toggle on every collection jack; expanding renders that collection's SOPs as nested child rows via a generalized `renderSopRow`, reusing the shipped pinned-SOP JSX pattern for every SOP instead of just one
- `enterWireUp` generalizes from a single pinned `newSop` to any SOP id — clicking any drilled-down SOP row enters connect mode identically to the old post-publish flow; `?sop=` now only pre-selects/pre-expands as a deep-link nicety, never a precondition
- `handleDone` writes ONE SOP-target grant per pending subject via `createGrant({subjectType, subjectId, sopId})` (33-05's arm) instead of iterating `newSop.collectionIds` — the "this SOP has no collection" dead-end error is gone since SOP-target grants don't need a collection at all
- `rightEndpoint` mirrors `leftEndpoint`: a SOP-target wire anchors at the SOP row when its collection is expanded, else collapses to the collection jack (aggregated via the existing `WireAgg.count`)
- `sopGrantsByUnit` feeds `resolveEffectiveAccess` a second time (same pure resolver, Pattern 1) so org/area/department/role/person SOP-target grants inherit down the chain exactly like collection grants — kept as a fully separate `rawSopEdges` array so the shipped `rawEdges` push line (pinned by `wiring-at-scale.spec.ts`) stays byte-identical
- Overridden SOPs (any direct SOP-target grant) render a neutral "CHOSEN BY NAME" pill, derived client-side from the `grants` prop — no stored flag
- Search extends to SOP titles and auto-expands their parent collection
- `page.tsx` fetches `sopsByCollection` (id/title/status per collection) via one `.in('collection_id', ids)` join read on `sop_collections→sops`, replacing the old count-only read in the exact same dependent-await slot — no new serial await added
- Rule 1 fix: `grantsByUnit` now skips grants with a null `collectionId` (SOP-target grants) so they can't pollute the collection resolver's per-unit grant lists with `null` entries

## Task Commits

1. **Task 1: Collection→SOP drill-down + organic choose-mode + rightEndpoint** - `b4a9434` (feat)
2. **Task 2: Repoint wire-up-mode + library-filter pins, flip sop-drilldown spec** - `b4e0c65` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/admin/wiring/WiringPatchBay.tsx` - expandedCollections/toggleCollection, sopById/sopParentCollection/rightEndpoint, generalized enterWireUp(sopId)/activeSop/activeSopExistingGrants, renderSopRow, sopGrantsByUnit + second resolver pass, handleDone SOP-target write, matchIds SOP-title search
- `src/components/admin/wiring/WiringPatchBayShell.tsx` - threads the new `sopsByCollection` prop
- `src/app/(protected)/admin/sops/page.tsx` - `sopsByCollection` assembly via the expanded sop_collections→sops join read
- `tests/phase32/wire-up-mode.spec.ts` - repointed enterWireUp/handleDone/wires body-line pins for the generalized entry
- `tests/phase33/sop-drilldown.spec.ts` - flipped live from Wave-0 `test.fixme` stub to real source-contract assertions; browser half kept as an honest `test.fixme` (Railway-only UAT)

## Decisions Made
See `key-decisions` in frontmatter. Most consequential: keeping SOP-target edges in a parallel array (`rawSopEdges`) rather than unioning them into the existing `rawEdges` — this meant `tests/phase32/wiring-at-scale.spec.ts` needed zero repoints (verified line-by-line, all 8 non-runtime assertions pass unchanged), directly honoring the plan's "verify each pin against the new source... repoint only if lines moved" instruction.

## Deviations from Plan

None — plan executed exactly as written. One pre-existing item logged, not fixed (SCOPE BOUNDARY, Rule 3 package-install exclusion doesn't apply — this is a stale-guard/env issue, not a package):

### Out-of-scope discovery (not fixed)

**[2026-07-18]-class CRLF worktree drift recurred in `tests/phase33/sop-grant-schema.spec.ts`**
- **Found during:** Task 2's full-suite sanity run (`--project=phase32 --project=phase33 --project=phase32-unit`)
- **Issue:** `createGrant — SOP-target arm source-contract... verifies the sopId target belongs to the caller org BEFORE inserting` fails: its `body.indexOf("from('access_grants')\n    .insert(")` returns `-1` because this worktree's checkout of `src/actions/grants.ts` has `\r\n` between the two lines (confirmed via byte inspection).
- **Scope:** `src/actions/grants.ts` is not in 33-08's `files_modified` and is byte-identical to this worktree's base commit `cfe2d7e` — not caused by this plan. Logged in `deferred-items.md` alongside the identical 33-01-era instance of the same class.
- **Files modified:** `.planning/phases/33-per-sop-access-granularity-wayfinder-builder-header/deferred-items.md` (documentation only)

## Issues Encountered
None beyond the deferred item above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- SC-2 (G2) and SC-3's UI entry are both shipped: drill-down, organic choose-mode, SOP-target grant writes, density-safe wires
- `resolveSopAccess`/materialization (33-05) and the drill-down UI (this plan) now form the complete round-trip: any SOP can be chosen-by-name from the access map and the override takes effect immediately on next `router.refresh()`
- 33-09 (plain-language answer panel + Wayfinder header) can build on the neutral "CHOSEN BY NAME" pill copy already shipped here — final user-facing copy sweep is explicitly 33-09 scope per the plan
- `npx tsc --noEmit` clean; `npx playwright test tests/phase32/wire-up-mode.spec.ts tests/phase32/library-filter-deeplink.spec.ts tests/phase33/sop-drilldown.spec.ts --project=phase32 --project=phase33` → 23 passed, 4 fixme (skipped) runtime smokes, 0 failed

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/components/admin/wiring/WiringPatchBay.tsx
- FOUND: src/components/admin/wiring/WiringPatchBayShell.tsx
- FOUND: src/app/(protected)/admin/sops/page.tsx
- FOUND: tests/phase32/wire-up-mode.spec.ts
- FOUND: tests/phase33/sop-drilldown.spec.ts
- FOUND commit: b4a9434
- FOUND commit: b4e0c65
