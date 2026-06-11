---
phase: 24-procedure-flow-spatial-node-graph
plan: "03"
subsystem: flow-graph
tags: [flow-tab, viewport, ssr-safe, desktop-default, preview-removal, flow-editor, journeys]
dependency_graph:
  requires:
    - FlowGraphSchema relaxed (Plan 24-01)
    - phase24-stubs playwright project (Plan 24-01)
    - FlowGraphCanvas production renderer — hasExplicitPositions, fitToView, exportPng, accent tokens (Plan 24-02)
  provides:
    - FlowTab SSR-safe desktop-default graph view via useViewport useEffect reconcile
    - PREVIEW pill/label removed from all three flow surfaces
    - BuilderFlowEditButton — FlowGraphEditor re-surfaced in builder outside suppressed Puck sidebar
    - 24-HUMAN-UAT.md runbook for FLOW-05 round-trip + FLOW-03 export + FLOW-04 viewport
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
metrics:
  duration: "~5m"
  completed: "2026-06-12"
  tasks_completed: 2
  tasks_total: 4
  files_changed: 8
  status: stopped-at-checkpoint
---

# Phase 24 Plan 03: Production Flow Experience + FLOW-05 Re-surface Summary

Delivered the production Flow tab behaviour (FLOW-04) and the FlowGraphEditor re-surface (FLOW-05), removed all PREVIEW labels, updated journeys.ts, and wrote the human-UAT runbook. Stopped at Task 3 (checkpoint:human-verify) per plan — Tasks 3 and 4 require Simon to run UAT on sopstart.com and confirm the bundle gate.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | FLOW-04 — desktop-default graph view + drop preview labels | `f02f3b1` | FlowTab.tsx, BuilderFlowButton.tsx, flow-graph-canvas.spec.ts, no-preview-pill.spec.ts |
| 2 | FLOW-05 — re-surface FlowGraphEditor + journeys.ts update | `5233c12` | BuilderFlowEditButton.tsx (new), BuilderStageShell.tsx, journeys.ts |

## Verification Results

- `npx playwright test --project=phase24-stubs` — PASS (9/9, all stubs now live, 0 fixme)
- `npx tsc --noEmit` — PASS (exit 0)

### Acceptance criteria met (Tasks 1–2)

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

## Pending — Human Checkpoints

### Task 3: Human-UAT (checkpoint:human-verify)
Runbook written to `.planning/phases/24-procedure-flow-spatial-node-graph/24-HUMAN-UAT.md`.
Must run on sopstart.com post-deploy:
1. FLOW-05 round-trip — Edit flow editor opens, positions save + persist, Flow tab renders authored positions
2. FLOW-03 export — Fit centres graph; Export PNG downloads with correct accent-colour fills
3. FLOW-04 viewport — desktop=graph default, mobile=list default, no React #418 in console

### Task 4: Bundle gate (checkpoint:human-action)
Run from `C:\Development\SOPstart` in PowerShell: `npm run build; if ($?) { npx tsx scripts/check-bundle-size.ts }`
Confirm `/sops/[sopId]/page` First-Load-JS within 1104 KB ±2 KB.
If over tolerance: export-PNG path needs dynamic import.

## Deviations from Plan

### Auto-fixed Issues

None.

### Implementation note
BuilderFlowEditButton was created as a **sibling component** rather than extending BuilderFlowButton. The plan noted "prefer extending/adding a sibling component file if BuilderFlowButton's single-responsibility is preview-only" — implemented as a sibling. BuilderFlowButton's preview-only role is preserved; BuilderFlowEditButton owns the author-mode entry point.

## Known Stubs

None. All implemented behaviour is wired. Tasks 3 and 4 are human-UAT/gate checkpoints, not stubs.

## Threat Flags

None. Both tasks are pure client-side UI changes. The FlowGraphEditor write path goes through the unchanged `updateSopFlowGraph` server action (admin/safety_manager role gate + FlowGraphSchema validation + 256 KB cap) — T-24-05 mitigated as planned.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/sop/tabs/FlowTab.tsx` | FOUND |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx` | FOUND |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx` | FOUND |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` | FOUND |
| `src/lib/journeys/journeys.ts` | FOUND |
| `.planning/phases/24-procedure-flow-spatial-node-graph/24-HUMAN-UAT.md` | FOUND |
| commit `f02f3b1` | FOUND |
| commit `5233c12` | FOUND |
| commit `a234d0e` (UAT runbook) | FOUND |
