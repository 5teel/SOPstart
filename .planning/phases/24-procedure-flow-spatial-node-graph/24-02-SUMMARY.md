---
phase: 24-procedure-flow-spatial-node-graph
plan: "02"
subsystem: flow-graph
tags: [renderer, svg, layout, export, canvas, tokens]
dependency_graph:
  requires:
    - FlowGraphSchema relaxed (Plan 24-01)
    - phase24-stubs playwright project (Plan 24-01)
  provides:
    - hasExplicitPositions discriminant
    - layoutFromPositions (authored-coordinate layout pass)
    - fitToView (real viewBox zoom-to-fit)
    - exportPng (SVG → CSS-var-inlined → canvas → PNG download)
    - NODE colour map unified to var(--accent-*) tokens
    - PREVIEW pill removed from FlowGraphCanvas toolbar
  affects:
    - src/components/sop/flow/FlowGraphCanvas.tsx
    - src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts
tech_stack:
  added: []
  patterns:
    - hasExplicitPositions/layoutFromPositions branch inside layout()
    - CSS-var colour tokens (var(--accent-*) matching FlowTab.TYPE_COLORS)
    - useCallback-based fitToView: viewBox attribute manipulation
    - exportPng: XMLSerializer + getComputedStyle CSS-var inline + canvas.toBlob (photo-compress.ts pattern)
key_files:
  created: []
  modified:
    - src/components/sop/flow/FlowGraphCanvas.tsx
    - src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts
decisions:
  - "layoutFromPositions uses bounding box + NW/NH + PAD*2 for canvas dimensions — simple and consistent with the auto-layout sizing formula"
  - "color-mix(in srgb, var(--accent-X) 12%, transparent) used for node fills — matches FlowTab StepCard tint idiom exactly"
  - "fitToView uses Math.min(cw/gw, ch/gh, 1) — never scales above 100%, avoids blurry upscaling on small graphs"
  - "exportPng wired as void exportPng() inline onClick — avoids returning a Promise directly to JSX onClick handler"
  - "FLOW-01 token + FLOW-03 fit/export assertions un-fixmed in spec; useViewport desktop-default (c) remains fixme for Plan 03"
metrics:
  duration: "~20m"
  completed: "2026-06-11"
  tasks_completed: 2
  files_changed: 2
---

# Phase 24 Plan 02: FlowGraphCanvas Production Renderer Summary

Productionised FlowGraphCanvas: explicit node positions now render at authored coordinates; derived graphs keep the existing depth-layer auto-layout; node colours unified to --accent-* CSS-var tokens matching FlowTab; real viewBox zoom-to-fit replaces the scrollTo stub; Export PNG downloads a colour-correct PNG using the XMLSerializer + getComputedStyle inline pattern; PREVIEW pill removed from toolbar. FLOW-01 token and FLOW-03 fit/export source-contract assertions flipped live.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | FLOW-01 — explicit positions + accent token unification | `c23327b` | FlowGraphCanvas.tsx |
| 2 | FLOW-03 — fitToView + exportPng + PREVIEW pill removal + spec un-fixmes | `734f8e5` | FlowGraphCanvas.tsx, flow-graph-canvas.spec.ts |

## Verification Results

- `npx playwright test --project=phase24-unit` — PASS (10/10 auto-layout derivation tests; fallback unchanged)
- `npx playwright test --project=phase24-stubs` — PASS (7 pass, 2 skipped-fixme: no-preview-pill awaits Plan 03 FlowTab label update; useViewport awaits Plan 03 desktop-default)
- `npx tsc --noEmit` — PASS (exit 0)

### Acceptance criteria met

- `grep -c "hasExplicitPositions" FlowGraphCanvas.tsx` = 2 (definition + call site in layout())
- `grep -c "layoutFromPositions" FlowGraphCanvas.tsx` = 3 (definition, return call in layout(), and function name in body)
- FlowGraphCanvas.tsx contains `var(--accent-step` — confirmed
- FlowGraphCanvas.tsx contains NO `#db2777` — confirmed
- FlowGraphCanvas.tsx contains NO `#ea580c` — confirmed
- PREVIEW pill absent (grep -c = 0) — confirmed
- scrollTo stub absent — confirmed
- `fitToView = useCallback` defined and wired to `onClick={fitToView}` — confirmed
- `exportPng = useCallback` with `canvas.toBlob`, `XMLSerializer`, `getComputedStyle` — confirmed
- Export PNG button wired via `onClick={() => void exportPng()}` — confirmed

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written, with one minor adaptation:

**Export PNG onClick form** — Plan spec showed `onClick={exportPng}` and `onClick={() => exportPng()}` as valid patterns. The implemented form is `onClick={() => void exportPng()}` (void-prefixed async) to avoid returning a Promise to JSX's onClick handler. The spec regex was extended to match this third form. Functionally equivalent.

## Known Stubs

- `tests/lint/no-preview-pill.spec.ts` — still test.fixme because `FlowTab.tsx:24` still reads `'Graph (preview)'`. Plan 03 removes that label.
- `flow-graph-canvas.spec.ts` assertion (c) — still test.fixme for `useViewport` desktop-default auto-switch. Plan 03 task.

## Threat Flags

None. Both tasks are pure client-side renderer changes with no network, no auth paths, no schema changes, and no new trust boundaries. The exportPng rasterises only the current user's own SOP flow graph to a local download (T-24-03 accepted disposition).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/sop/flow/FlowGraphCanvas.tsx` | FOUND |
| `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts` | FOUND |
| commit `c23327b` | FOUND |
| commit `734f8e5` | FOUND |
