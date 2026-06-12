---
phase: 24-procedure-flow-spatial-node-graph
fixed_at: 2026-06-12T00:00:00Z
review_path: .planning/phases/24-procedure-flow-spatial-node-graph/24-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-06-12
**Source review:** .planning/phases/24-procedure-flow-spatial-node-graph/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 11
- Fixed: 11 (3 pre-fixed in `edf3e45`, 8 fixed this run)
- Skipped: 0

**Verification:** `npx tsc --noEmit` clean; `npx playwright test --project=phase24-stubs --project=phase24-unit` 19/19 passed; `npm run build` postbuild bundle gate `/sops/[sopId]` = 1104 KB (baseline 1104 KB, Δ 0 KB).

## Fixed Issues

### CR-01: `fitToView` double-scales — graph renders at scale² instead of scale

**Files modified:** `src/components/sop/flow/FlowGraphCanvas.tsx`
**Commit:** `edf3e45` (pre-fixed before this run — verified present)
**Applied fix:** viewBox now computed from container extent / scale; fit held in React state; SVG width/height/viewBox React-managed.

### CR-02: Saved flow layout silently reverted on modal reopen

**Files modified:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx`, `src/lib/builder/flow-graph-field.tsx`
**Commit:** `edf3e45` (pre-fixed before this run — verified present)
**Applied fix:** `FlowGraphEditor` gained an `onSaved` callback; `BuilderFlowEditButton` holds the last-saved graph in state and prefers it when seeding.

### WR-01: `updateSopFlowGraph` reports success when the update wrote zero rows

**Files modified:** `src/actions/flow-graph.ts`
**Commit:** `5c58adf`
**Applied fix:** Added `.select('id')` to the update; zero rows now returns `"SOP not found or you do not have permission to edit it"` instead of `{ success: true }`.

### WR-02: Role gate built on client-editable `user_metadata`

**Files modified:** `src/actions/flow-graph.ts`
**Commit:** `3bff395`
**Applied fix:** Replaced the `user_metadata`-first role read with the canonical JWT-claims pattern from `src/actions/sops.ts` (`getSession()` → decode `access_token` payload → `user_role`). Also added the canonical `organisation_id` claim check and `.eq('organisation_id', organisationId)` scoping on the update, per the review's note that the action omitted it.

### WR-03: `hasExplicitPositions` heuristic discards authored layouts where every node has x = 0

**Files modified:** `src/components/sop/flow/FlowGraphCanvas.tsx`, `src/components/sop/tabs/FlowTab.tsx`, `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx`
**Commit:** `61762cd`
**Applied fix:** Provenance is now passed down instead of inferred from coordinates: both callers resolve `{ graph, authored }` (authored = `sop.flow_graph` parsed successfully) and pass `authored` to `FlowGraphCanvas`. `layout(graph, authored)` branches on the flag (guarded against empty node lists); the `hasExplicitPositions` coordinate heuristic was removed (it had no external consumers — grep-verified). No spec referenced the removed symbol, so no test changes were needed.

### WR-04: Authored nodes at negative coordinates are clipped out of the canvas

**Files modified:** `src/components/sop/flow/FlowGraphCanvas.tsx`
**Commit:** `e9e943a`
**Applied fix:** `layoutFromPositions` computes the bounding-box minimum (`Math.min(0, ...)`) and offsets all placements by `-min + PAD`; width/height include the negative extent. Non-negative graphs shift only by the PAD margin.

### WR-05: `exportPng` has no error handling and leaks the object URL on failure

**Files modified:** `src/components/sop/flow/FlowGraphCanvas.tsx`
**Commit:** `c492e73`
**Applied fix:** Image-load promise wrapped in try/catch/finally — `URL.revokeObjectURL(url)` runs in `finally`, failures log `[flow] PNG export failed` and return instead of escaping as unhandled rejections; `canvas.toBlob` null is now logged instead of silently swallowed. Source-contract spec assertions (`canvas.toBlob`, onClick wiring) still pass.

### WR-06: List view renders "0/N" step counter for non-step nodes

**Files modified:** `src/components/sop/tabs/FlowTab.tsx`
**Commit:** `948287a`
**Applied fix:** Counter is rendered only when `entry.stepNumber > 0` — nodes with no matching step show no counter rather than a wrong `0/N`.

### WR-07: List view ignores `node.stepId` linkage — authored nodes lose step detail

**Files modified:** `src/components/sop/tabs/FlowTab.tsx`
**Commit:** `6e42712`
**Applied fix:** Step lookup now falls back to the linkage field: `stepMap.get(node.id) ?? (node.stepId ? stepMap.get(node.stepId) : undefined)`.

### WR-08: Backdrop click / Escape discards unsaved flow edits without confirmation

**Files modified:** `src/lib/builder/flow-graph-field.tsx`, `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx`
**Commit:** `55a63be`
**Applied fix:** `FlowGraphEditor` gained `onDirtyChange` (identity comparison of nodes/edges against a baseline ref; baseline re-pointed and dirty cleared after each successful save). `BuilderFlowEditButton` tracks dirtiness and gates all three close paths (backdrop click, Escape, X button) behind `window.confirm('Discard unsaved flow changes?')` when dirty; dirty resets on open. The read-only preview modal (`BuilderFlowButton`) keeps backdrop-click-to-close, per the review's suggestion.

### WR-09: Unstable `graph` identity + stale `derivedGraph` deps defeat memoization

**Files modified:** `src/components/sop/tabs/FlowTab.tsx`
**Commit:** `edf3e45` (pre-fixed before this run — verified present)
**Applied fix:** Graph resolution memoized with `[sop.flow_graph, derivedGraph]` deps. (This run's WR-03 commit extended the same memo to also return the `authored` provenance flag.)

## Skipped Issues

None — all in-scope findings were fixed. Info findings (IN-01..IN-04) were out of scope (`fix_scope: critical_warning`).

**Note for verifier:** WR-03/WR-04 change layout behaviour for authored graphs (provenance-based mode selection + bounding-box offset). They type-check and pass the source-contract suite, but a visual pass on an authored flow graph on sopstart.com post-deploy is recommended.

---

_Fixed: 2026-06-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
