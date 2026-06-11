---
phase: 24-procedure-flow-spatial-node-graph
plan: "01"
subsystem: flow-graph
tags: [testing, schema, validators, playwright, flow-graph]
dependency_graph:
  requires: []
  provides:
    - FlowGraphSchema relaxed (id/from/to min(1))
    - phase24-stubs playwright project
    - FLOW-02 derivation coverage (inspect/zone/cross-section/label-truncation)
    - FLOW-05 investigation findings
  affects:
    - src/lib/validators/flow-graph.ts
    - src/lib/sop/__tests__/flow-graph-derivation.test.ts
    - playwright.config.ts
tech_stack:
  added: []
  patterns:
    - Playwright grep-absence lint-guard (test.fixme until feature lands)
    - Playwright source-contract stubs (test.fixme for wiring assertions)
    - RFC-compliant UUID literals in schema specs (version nibble [1-8] required by zod uuid validator)
key_files:
  created:
    - src/lib/validators/__tests__/flow-graph-schema.spec.ts
    - tests/lint/no-preview-pill.spec.ts
    - src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts
    - .planning/phases/24-procedure-flow-spatial-node-graph/24-FLOW05-INVESTIGATION.md
  modified:
    - src/lib/validators/flow-graph.ts
    - src/lib/sop/__tests__/flow-graph-derivation.test.ts
    - playwright.config.ts
decisions:
  - "FlowGraphSchema id/from/to relaxed to z.string().min(1) — derived non-step nodes use junctionId/props.id which are not guaranteed UUIDs (FLOW-05 schema contract)"
  - "stepId stays z.string().uuid().optional() — always links to sop_steps.id"
  - "Schema spec uses valid v4-format UUIDs (version nibble [1-8]) — zod uuid validator rejects sequential test UUIDs like 00000000-...-000001"
  - "flow-graph-canvas.spec.ts uses [\\s\\S] not /s dotAll flag — TS1501 per CLAUDE.md 2026-06-02 learning"
  - "FlowGraphField unreachable from 21.6 builder (rightSideBarVisible: false at BuilderClient.tsx:535) — Plan 03 must re-surface via portaled modal/panel"
  - "Autosave cannot clobber flow_graph — useBuilderAutosave writes only layout_data per section_id, never root.props.flowGraph"
metrics:
  duration: "~30m"
  completed: "2026-06-11"
  tasks_completed: 3
  files_changed: 7
---

# Phase 24 Plan 01: Wave-0 Test Surface + Schema Relaxation + FLOW-05 Investigation Summary

Laid the Wave-0 test floor and two zero-risk foundations the renderer/wiring plans (24-02, 24-03) depend on: relaxed FlowGraphSchema so derived non-UUID node ids validate; registered `phase24-stubs` playwright project with 3 spec files; closed 3 FLOW-02 derivation coverage gaps; recorded FLOW-05 round-trip findings as code-confirmed facts.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Relax FlowGraphSchema + schema contract tests | `3d4f9c8` | flow-graph.ts, flow-graph-schema.spec.ts |
| 2 | Audit + extend FLOW-02 derivation coverage | `46a39f3` | flow-graph-derivation.test.ts |
| 3 | Register phase24-stubs + stub specs + FLOW-05 doc | `77c0795` | playwright.config.ts, no-preview-pill.spec.ts, flow-graph-canvas.spec.ts, 24-FLOW05-INVESTIGATION.md |

## Verification Results

- `npx tsc --noEmit` — PASS (exit 0)
- `npx playwright test --project=phase24-unit` — PASS (10/10 tests, 3 new cases added)
- `npx playwright test --project=phase24-stubs` — PASS (4 schema tests pass, 5 fixme tests skipped, exit 0)
- `npx playwright test --list --project=phase24-stubs` — confirms all 3 spec files discovered

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema spec used invalid UUID format in test data**
- **Found during:** Task 3 (phase24-stubs run failure)
- **Issue:** Test spec used `00000000-0000-0000-0000-000000000042` as a "valid UUID" stepId, but zod's uuid validator requires the version nibble to be `[1-8]` (RFC 4122 compliant). The sequential test UUIDs (`...000001`, `...000042`) fail this check.
- **Fix:** Changed to `a1b2c3d4-e5f6-4789-abcd-ef0123456789` (valid v4 format) and updated `BASE_NODE.id` to `a0000000-0000-4000-8000-000000000001`.
- **Files modified:** `src/lib/validators/__tests__/flow-graph-schema.spec.ts`
- **Commit:** `77c0795`

**2. [Rule 1 - Bug] flow-graph-canvas.spec.ts used `/s` dotAll regex flag (TS1501)**
- **Found during:** Task 3 (npx tsc --noEmit post-task)
- **Issue:** The useEffect assertion regex used the `/s` flag, which is only valid when targeting ES2018+. The project's tsconfig targets an earlier version.
- **Fix:** Replaced `/s` with `[\s\S]` multiline-safe pattern per CLAUDE.md 2026-06-02 learning.
- **Files modified:** `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts`
- **Commit:** `77c0795`

## FLOW-05 Investigation Summary

Key findings recorded in `24-FLOW05-INVESTIGATION.md`:

1. **FlowGraphField is unreachable** — `BuilderClient.tsx:535` passes `ui={{ rightSideBarVisible: false }}`, suppressing Puck's right sidebar where `root.fields.flowGraph` renders. Plan 03 must expose a portaled entry point (like `BuilderFlowButton`) outside Puck's sidebar.

2. **Autosave cannot clobber flow_graph** — `useBuilderAutosave` writes only `layout_data` per `section_id` to Dexie. `updateSopFlowGraph` (called by `FlowGraphEditor.handleSave`) is the sole writer of `sops.flow_graph`. The paths are completely separate.

3. **`hasExplicitPositions` discriminant is sound** — Any node with `x !== 0` indicates an authored position. The single-node-never-dragged edge case (still at `x: 0`) is acceptable; auto-layout is the correct fallback.

## Known Stubs

- `tests/lint/no-preview-pill.spec.ts` — `test.fixme` until Plans 02/03 remove the PREVIEW pill from `FlowGraphCanvas.tsx:115` and the "Graph (preview)" label from `FlowTab.tsx:24`.
- `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts` — all 4 assertions are `test.fixme` until Plans 02/03 implement `fitToView`, `exportPng`, `useViewport` desktop-default, and token-unified node colours.

## Self-Check: PASSED

All created files confirmed present. All 3 commits confirmed in git log.

| Check | Result |
|-------|--------|
| `src/lib/validators/flow-graph.ts` | FOUND |
| `src/lib/validators/__tests__/flow-graph-schema.spec.ts` | FOUND |
| `tests/lint/no-preview-pill.spec.ts` | FOUND |
| `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts` | FOUND |
| `.planning/phases/24-procedure-flow-spatial-node-graph/24-FLOW05-INVESTIGATION.md` | FOUND |
| commit `3d4f9c8` | FOUND |
| commit `46a39f3` | FOUND |
| commit `77c0795` | FOUND |
