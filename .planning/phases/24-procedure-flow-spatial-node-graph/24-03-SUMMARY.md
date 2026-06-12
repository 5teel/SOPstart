---
phase: 24-procedure-flow-spatial-node-graph
plan: "03"
subsystem: flow-graph
tags: [flow-tab, viewport, ssr-safe, desktop-default, preview-removal, flow-editor, journeys, bundle-gate]
dependency_graph:
  requires:
    - FlowGraphSchema relaxed (Plan 24-01)
    - phase24-stubs playwright project (Plan 24-01)
    - FlowGraphCanvas production renderer — hasExplicitPositions, fitToView, exportPng, accent tokens (Plan 24-02)
  provides:
    - FlowTab SSR-safe desktop-default graph view via useViewport useEffect reconcile
    - PREVIEW pill/label removed from all three flow surfaces
    - BuilderFlowEditButton — FlowGraphEditor re-surfaced in builder outside suppressed Puck sidebar
    - 24-HUMAN-UAT.md runbook for FLOW-05 round-trip + FLOW-03 export + FLOW-04 viewport (all PASSED)
    - Bundle gate confirmed green at 1104 KB delta 0 KB (dynamic-import FlowGraphCanvas)
  affects:
    - src/components/sop/tabs/FlowTab.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/lib/journeys/journeys.ts
    - src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts
    - tests/lint/no-preview-pill.spec.ts
tech_stack:
  added: []
  patterns:
    - SSR-safe viewport reconcile: useState('list') seed + useEffect(() => { if (viewport === 'desktop') setView('graph') }, [viewport])
    - createPortal modal outside Puck with mounted guard + Escape-to-close (BuilderFlowEditButton mirrors BuilderFlowButton shell)
    - No Puck hook in components mounted outside <Puck> (CLAUDE.md 2026-06-08 invariant)
    - next/dynamic ssr:false for client-only graph canvas to prevent bundle bloat on SSR route
key_files:
  created:
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx
    - .planning/phases/24-procedure-flow-spatial-node-graph/24-HUMAN-UAT.md
  modified:
    - src/components/sop/tabs/FlowTab.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/lib/journeys/journeys.ts
    - src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts
    - tests/lint/no-preview-pill.spec.ts
decisions:
  - "FlowTab seeds useState<'list'|'graph'>('list') — SSR-safe constant; useViewport reconcile runs only in useEffect (post-hydration) to avoid React #418"
  - "BuilderFlowEditButton is a sibling component (not an extension of BuilderFlowButton) — single-responsibility: BuilderFlowButton is preview-only, BuilderFlowEditButton is author-mode"
  - "FlowGraphEditor seeded from explicit flow_graph (safeParse success) else deriveFlowGraph — admin starts from current layout, not a blank canvas"
  - "No Puck hook called in BuilderFlowEditButton — mounted in BuilderStageShell header, outside <Puck> entirely; per CLAUDE.md 2026-06-08 outside-Puck crash rule"
  - "journeys.ts /sops/[sopId] detail updated to reflect desktop=graph / mobile=list flow-tab default (CLAUDE.md pathways same-commit rule)"
  - "FlowTab loads FlowGraphCanvas via next/dynamic with ssr:false — graph view never renders on SSR (list is the SSR default); dynamic-import holds bundle at 1104 KB delta 0 (per 24-CONTEXT locked decision: dynamic-import if over tolerance)"
metrics:
  duration: "~25m total (Tasks 1+2 ~5m; bundle gate deviation + fix ~10m; Task 3 human UAT; Task 4 confirmation ~5m)"
  completed: "2026-06-12"
  tasks_completed: 4
  tasks_total: 4
  files_changed: 9
  status: complete
---

# Phase 24 Plan 03: Production Flow Experience + FLOW-05 Re-surface Summary

Delivered the production Flow tab behaviour (FLOW-04 desktop-default graph via SSR-safe useViewport reconcile), FlowGraphEditor re-surface in builder (FLOW-05), removed all PREVIEW labels across flow surfaces, updated journeys.ts, and confirmed the bundle gate at 1104 KB delta 0 KB via next/dynamic FlowGraphCanvas. Human-UAT passed on sopstart.com for all three scenarios: FLOW-05 round-trip, FLOW-03 fit/export PNG with accent colours, FLOW-04 viewport default with no React #418.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | FLOW-04 — desktop-default graph view + drop preview labels | `f02f3b1` | FlowTab.tsx, BuilderFlowButton.tsx, flow-graph-canvas.spec.ts, no-preview-pill.spec.ts |
| 2 | FLOW-05 — re-surface FlowGraphEditor + journeys.ts update | `5233c12` | BuilderFlowEditButton.tsx (new), BuilderStageShell.tsx, journeys.ts |
| 3 | Human-UAT — FLOW-05 round-trip, FLOW-03 export, FLOW-04 viewport | `a234d0e` | 24-HUMAN-UAT.md (runbook); approved by Simon 2026-06-12 on sopstart.com |
| 4 | Bundle gate — /sops/[sopId] First-Load-JS ≤ 1104 KB ±2 KB | `20bb8a5` (deviation fix) | FlowTab.tsx (dynamic-import FlowGraphCanvas); gate confirmed green at delta 0 KB |

## Verification Results

- `npx playwright test --project=phase24-stubs` — PASS (9/9, all stubs live, 0 fixme)
- `npx tsc --noEmit` — PASS (exit 0)
- `npx tsx scripts/check-bundle-size.ts` — PASS (1104 KB, baseline 1104 KB, delta 0 KB, tolerance ±2 KB)
- Human-UAT: All 3 scenarios PASSED on sopstart.com (approved by Simon 2026-06-12)

### Acceptance criteria met (all 4 tasks)

**Task 1:**
- `FlowTab.tsx` contains `useViewport` import, `useState<'list' | 'graph'>('list')` seed, and `useEffect` with `viewport === 'desktop'` → `setView('graph')` — confirmed
- `grep PREVIEW` across all three flow surfaces returns 0 — confirmed
- `no-preview-pill.spec.ts` is LIVE (not fixme) and passes — confirmed
- `flow-graph-canvas.spec.ts` assertion (c) is LIVE and passes — confirmed
- `npx tsc --noEmit` exits 0 — confirmed

**Task 2:**
- `BuilderFlowEditButton.tsx` mounts `FlowGraphEditor` via createPortal modal, seeded from explicit-or-derived graph — confirmed
- No Puck hook called (`grep useGetPuck/usePuck BuilderFlowEditButton.tsx` = 0) — confirmed
- `ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}` unchanged in BuilderClient.tsx:535 — confirmed
- `journeys.ts` `/sops/[sopId]` detail mentions "Flow tab defaults to spatial graph on desktop … List/Graph toggle … mobile defaults to list" — confirmed
- `npx tsc --noEmit` exits 0 — confirmed

**Task 3:**
- 24-HUMAN-UAT.md exists with all three scenarios — confirmed
- FLOW-05 round-trip: Edit flow editor opens, positions save + persist, Flow tab renders authored positions — PASSED by Simon 2026-06-12
- FLOW-03 export: Fit centres graph; Export PNG downloads with correct accent-colour fills — PASSED by Simon 2026-06-12
- FLOW-04 viewport: desktop=graph default, mobile=list default, no React #418 in console — PASSED by Simon 2026-06-12

**Task 4:**
- `npx tsx scripts/check-bundle-size.ts` exits 0 with `/sops/[sopId]/page` at 1104 KB, delta 0 KB — confirmed
- `.bundle-baseline.json` unchanged (not re-baselined to absorb feature weight) — confirmed

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — blocking issue)

**1. [Rule 3 - Blocking] Bundle gate tripped on Railway deploy (+6 KB over 1104 KB baseline)**

- **Found during:** Task 4 bundle gate — Railway production build measured /sops/[sopId]/page at 1110 KB (+6 KB, exceeding ±2 KB tolerance), blocking deploy
- **Root cause:** FlowTab statically imported FlowGraphCanvas; the canvas includes explicit-position layout + viewBox fit + Export PNG (native Canvas/XMLSerializer) added in Plan 24-02. The static import bundled all canvas code into the /sops/[sopId] route's First-Load-JS
- **Fix:** Loaded FlowGraphCanvas via `next/dynamic` with `ssr: false` in FlowTab.tsx. Safe because graph view never renders on SSR (list is the SSR default; graph activates post-hydration via useViewport useEffect). This matches the 24-CONTEXT locked decision: "dynamic-import if it pushes past tolerance"
- **Result:** Gate confirmed green at 1104 KB delta 0 KB. `.bundle-baseline.json` unchanged
- **Files modified:** `src/components/sop/tabs/FlowTab.tsx`
- **Commit:** `20bb8a5`
- **Note:** The fix was already committed and pushed before Simon's UAT approval on sopstart.com. The UAT approval was on the deployed fixed build

### Implementation note

BuilderFlowEditButton was created as a **sibling component** rather than extending BuilderFlowButton. The plan noted "prefer extending/adding a sibling component file if BuilderFlowButton's single-responsibility is preview-only" — implemented as a sibling. BuilderFlowButton's preview-only role is preserved; BuilderFlowEditButton owns the author-mode entry point.

## Known Stubs

None. All implemented behaviour is wired and verified end-to-end on sopstart.com.

## Threat Flags

None. Both tasks are client-side UI changes. The FlowGraphEditor write path goes through the unchanged `updateSopFlowGraph` server action (admin/safety_manager role gate + FlowGraphSchema validation + 256 KB cap) — T-24-05 mitigated as planned. T-24-06 (hydration mismatch) closed: no React #418 confirmed in Simon's UAT.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/sop/tabs/FlowTab.tsx` | FOUND |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx` | FOUND |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx` | FOUND |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` | FOUND |
| `src/lib/journeys/journeys.ts` | FOUND |
| `.planning/phases/24-procedure-flow-spatial-node-graph/24-HUMAN-UAT.md` | FOUND |
| commit `f02f3b1` (Task 1) | FOUND |
| commit `5233c12` (Task 2) | FOUND |
| commit `a234d0e` (UAT runbook) | FOUND |
| commit `c2fb71f` (partial SUMMARY + STATE) | FOUND |
| commit `20bb8a5` (bundle-gate deviation fix) | FOUND |
| Bundle gate 1104 KB delta 0 KB | CONFIRMED |
| Human-UAT all 3 scenarios PASSED | CONFIRMED (Simon 2026-06-12) |
