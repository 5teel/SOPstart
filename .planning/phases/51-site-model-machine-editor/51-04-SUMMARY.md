---
phase: 51-site-model-machine-editor
plan: 04
subsystem: ui
tags: [konva, react-konva, canvas, pan-zoom, polygon-editor]

requires:
  - phase: 51-site-model-machine-editor (plan 01)
    provides: src/lib/site/scene.ts (fitView, zoomAt, clampPoint, centroid, SceneEditorProps/SceneEditorMachine, View), phase51 Playwright project, site-editor-canvas.spec.ts stub
provides:
  - src/components/admin/site/SiteEditor.tsx — presentational Konva canvas (default export, props = SceneEditorProps): natural-size scene render, fit/pan/zoom-to-cursor, draw-mode polygon placement + close, machine select, vertex drag — all output in clamped scene-pixel coordinates
  - src/components/admin/site/SiteEditorLoader.tsx — next/dynamic(ssr:false) loader, the only sanctioned SiteEditor reference site
  - tests/phase51/site-editor-canvas.spec.ts fully live (9 real tests; 1 test.fixme deferred to 51-05)
affects: [51-05, 51-06, 51-07]

tech-stack:
  added: []
  patterns:
    - "Konva editor owns no data and calls no server action — all state flows in via SceneEditorProps and out via onSelect/onCreate/onPolygonChange callbacks; SiteWorkspace (51-05) owns persistence"
    - "Every placed/dragged vertex goes through layer.getRelativePointerPosition() (transform-aware) then clampPoint(); getPointerPosition() (raw) is used only inside the wheel handler for zoom-to-cursor — enforced by a source-contract test that scans every getPointerPosition( occurrence against the handleWheel function span"
    - "React 19 / eslint-plugin-react-hooks 7 'adjust state during render' idiom (mirrors PersonPanel/TrainingRecordSection's prevPersonId pattern) used for fit-on-resize, draft-reset-on-drawing-toggle, and drag-copy-reset-on-selection-change — avoids react-hooks/set-state-in-effect; a ref write during render (fitScaleRef) was replaced by recomputing fitView() fresh in the wheel handler instead (refs can't be written during render either, react-hooks/refs)"

key-files:
  created:
    - src/components/admin/site/SiteEditor.tsx
    - src/components/admin/site/SiteEditorLoader.tsx
  modified:
    - tests/phase51/site-editor-canvas.spec.ts

key-decisions:
  - "Deferred the 'Delete key and a delete button both remove the selected machine' test to 51-05 rather than force-implementing it here — SceneEditorProps (frozen in 51-01) has no onDelete callback, and the plan's own objective states delete/rename/department/save all live in the workspace, not the canvas. Left as test.fixme with an updated comment explaining why."
  - "Vertex handle radius (7px), close-snap distance (10px) and zoom clamp [fit*0.5, 4] taken from the plan's stated D-09 discretion defaults, not re-derived"
  - "No fitScaleRef: eslint-plugin-react-hooks 7's react-hooks/refs rule forbids writing a ref during render, so the zoom floor is recomputed via a fresh fitView() call inside handleWheel instead of cached from the last fit"

patterns-established:
  - "Source-contract test asserts geometric correctness structurally: every getPointerPosition( match's byte offset must fall inside the handleWheel function's brace-matched span, computed via a small functionSpan() helper — catches a future edit that reads raw pointer position outside the one legitimate (zoom) call site"

requirements-completed: [SIT-02, SIT-03]

duration: 10min
completed: 2026-09-28
---

# Phase 51 Plan 04: Site Editor Canvas (Konva) Summary

**A presentational Konva canvas that renders the site scene at natural pixel size behind a pan/zoom/fit world, draws and closes machine polygons, and drags vertex handles — every coordinate it emits is a clamped scene-pixel `[x,y]`, never a viewport pixel, and Konva never leaves the SiteEditorLoader-gated admin chunk.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-28T20:08:00+10:00
- **Completed:** 2026-09-28T20:18:18+10:00
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `SiteEditorLoader.tsx`: `next/dynamic(() => import('./SiteEditor'), { ssr: false })` — the only sanctioned `SiteEditor` reference site, satisfying the `konva-worker-isolation` gate's file-scoped rule (T-51-02)
- `SiteEditor.tsx` scene stage: renders the scene image at its natural `sceneWidth`/`sceneHeight` inside a `Stage` transformed by `{x, y, s}`; a `ResizeObserver` on the container drives `fitView()` on every resize (including the container's first real measurement after being 0×0 at mount, Pitfall 5); wheel zoom is zoom-to-cursor via `scene.ts`'s `zoomAt()`, clamped to `[fit * 0.5, 4]`; dragging empty canvas pans (checked via `e.target === e.target.getStage()` so vertex-handle drags never trigger a pan)
- Draw mode: clicks append vertices via `layer.getRelativePointerPosition()` → `clampPoint()`; closes on a click within 10 screen-px of the first vertex, or a double-click (which drops a duplicate final vertex left by the browser's click-click-dblclick sequence); a dashed preview line + highlighted close-target circle render while drawing
- Machines render as a fill polygon (opacity higher when selected) + stroke outline + centroid label; clicking a fill selects, clicking empty stage/the scene image deselects — both gated off while `drawing` is true
- Selected-machine vertex handles are draggable circles; `onDragMove` updates a local working-copy polygon so the fill tracks the handle live, `onDragEnd` re-reads `getRelativePointerPosition()`, clamps, and calls `onPolygonChange(id, polygon)` exactly once
- Every Konva node's screen-constant sizing (stroke width, vertex radius, label font size, dash pattern) divides by `view.s`; colour tokens (`--accent-zone`, `--accent-step`, `--ink-900`, `--paper-1`) are read once via `getComputedStyle(document.body)` in a lazy `useState` initializer (this module never SSRs, so no hydration-mismatch risk) — zero hardcoded hex anywhere in the file
- Activated 9 of 10 tests in `site-editor-canvas.spec.ts` (`scene` + `drawing` describes); the delete-machine test stays `test.fixme`, explicitly deferred to 51-05 (see Deviations)

## Task Commits

Each task was committed atomically:

1. **Task 1: Loader + scene stage — natural size, fit, wheel zoom-to-cursor, pan** - `07da639` (feat)
2. **Task 2: Draw, select and drag vertices — scene-pixel output only** - `36cc3b5` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/components/admin/site/SiteEditor.tsx` - the Konva canvas (354 lines): stage/pan/zoom/fit, draw mode, machine render + select, vertex drag
- `src/components/admin/site/SiteEditorLoader.tsx` - `next/dynamic(ssr:false)` loader
- `tests/phase51/site-editor-canvas.spec.ts` - both describe blocks activated (9 live tests, 1 fixme deferred)

## Decisions Made

- Kept `SiteEditor`'s data flow strictly one-directional (props in, callbacks out) per the plan's objective — no internal fetch, no server action import, so the `konva-worker-isolation` and bundle-isolation guarantees hold regardless of how `SiteWorkspace` (51-05) wires it up
- Recomputed `fitView()` fresh inside `handleWheel` instead of caching the last fit scale in a ref, once `react-hooks/refs` flagged writing to a ref during render — cheap pure-function call, no measurable cost, and removes a stale-ref class of bug entirely
- Used the codebase's established "adjust state during render" idiom (prevValue comparison + synchronous `setState` in the render body, not inside `useEffect`) for all three derived-state syncs (fit-on-resize, draft-reset-on-drawing-toggle, drag-copy-reset-on-selection-change) rather than suppressing `react-hooks/set-state-in-effect` with an eslint-disable comment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Loader's own header comment tripped its own `ssr: false` count guard**
- **Found during:** Task 1 acceptance-criteria verification
- **Issue:** The doc comment explaining the dynamic-import rationale contained the literal substring `ssr: false`, so `grep -c "ssr: false" SiteEditorLoader.tsx` returned 2 instead of the required 1 — identical in class to the 51-02/51-03 comment self-defeat pattern already logged in those plans' summaries.
- **Fix:** Reworded the comment to "`next/dynamic` with SSR disabled" without the literal code-shaped substring.
- **Files modified:** `src/components/admin/site/SiteEditorLoader.tsx`
- **Verification:** `grep -c "ssr: false" SiteEditorLoader.tsx` = 1.
- **Committed in:** `07da639` (Task 1 commit)

**2. [Rule 1 - Bug] `eslint-plugin-react-hooks` 7's `set-state-in-effect` and `refs` rules failed on three effects + one ref write**
- **Found during:** Post-Task-2 `npx eslint` sweep (orchestrator success-criteria gate, not in the plan's own per-task verify commands)
- **Issue:** The fit-on-resize effect, the draft-reset-on-drawing-toggle effect, and the drag-copy-reset-on-selection-change effect all called `setState` synchronously in the effect body; the fit effect also wrote `fitScaleRef.current` during that same synchronous path, which `react-hooks/refs` treats as a ref write during render once the effect is inlined.
- **Fix:** Replaced all three effects with the codebase's established "adjust state during render" pattern (prevValue-comparison + synchronous setState in the render body — same idiom as `PersonPanel.tsx`/`TrainingRecordSection.tsx`'s `prevPersonId`). Removed `fitScaleRef` entirely; `handleWheel` now recomputes `fitView()` fresh each time it needs the zoom floor.
- **Files modified:** `src/components/admin/site/SiteEditor.tsx`
- **Verification:** `npx eslint src/components/admin/site/SiteEditor.tsx` — 0 errors, 0 warnings; all 9 live playwright tests + `tsc --noEmit` still pass.
- **Committed in:** `36cc3b5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes are mechanical (comment rewording; effect-to-render-time-sync refactor) with no behavioural change to what the component does. No scope creep.

### Scope Adjustment (documented, not auto-fixed)

**Delete-machine test deferred to 51-05, not activated here**
- **Found during:** Task 2, while activating the `drawing` describe block
- **Issue:** The pre-existing `test.fixme('Delete key and a delete button both remove the selected machine', ...)` sits in this plan's spec file and Task 2's acceptance criteria literally requires `test.fixme` count = 0. But `SceneEditorProps` (the frozen contract from 51-01, not in this plan's `files_modified`) has no `onDelete` callback, and the plan's own objective states explicitly: "delete/rename/department/save live in the workspace" (51-05). There is no way for `SiteEditor` to notify a parent of a delete without either modifying the frozen prop contract (out of this plan's scope, and a breaking change for 51-05/51-06 which depend on the contract as-is) or silently doing nothing on Delete/click (which would make the test falsely green).
- **Resolution:** Left the test as `test.fixme` with an updated comment recording the reason and pointing to 51-05. `grep -c "test.fixme"` is 1, not the literal 0 the acceptance criteria states — documented here rather than force-fit. All other Task 2 acceptance criteria (full spec run exits 0, `getRelativePointerPosition(` count ≥ 2, phase26 exits 0, design-token lints exit 0, `tsc --noEmit` exits 0) are met exactly.
- **Files affected:** `tests/phase51/site-editor-canvas.spec.ts`
- **Committed in:** `36cc3b5` (Task 2 commit)

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 51-05 (`SiteWorkspace.tsx` + `/admin/site` page) can import `SiteEditorLoader` directly and wire `machines`/`selectedId`/`drawing` state plus `onSelect`/`onCreate`/`onPolygonChange` to `src/actions/site.ts`'s `upsertSiteMachine` — the canvas emits exactly the `Point[]` shape `upsertSiteMachineSchema` expects
- 51-05 must own: rename, department select, save/"Saved ✓" state, and **delete** (Delete key + delete button) — the deferred test in `site-editor-canvas.spec.ts` should be re-homed or re-activated as a `SiteWorkspace`-level test in that plan, calling `deleteSiteMachine` and clearing `selectedId`
- No blockers for 51-05/51-06

---
*Phase: 51-site-model-machine-editor*
*Completed: 2026-09-28*

## Self-Check: PASSED

- `src/components/admin/site/SiteEditor.tsx` — FOUND
- `src/components/admin/site/SiteEditorLoader.tsx` — FOUND
- Commit `07da639` — FOUND in `git log --oneline`
- Commit `36cc3b5` — FOUND in `git log --oneline`
- `grep -c "ssr: false" src/components/admin/site/SiteEditorLoader.tsx` = 1 — CONFIRMED
- `grep -cE "#[0-9a-fA-F]{6}" src/components/admin/site/SiteEditor.tsx` = 0 — CONFIRMED
- `grep -c "getRelativePointerPosition(" src/components/admin/site/SiteEditor.tsx` = 3 (>= 2) — CONFIRMED
- `wc -l src/components/admin/site/SiteEditor.tsx` = 354 (>= 180 min_lines) — CONFIRMED
- `npx playwright test --project=phase51 tests/phase51/site-editor-canvas.spec.ts` — 9 passed, 1 skipped (fixme), 0 failed — CONFIRMED
- `npx playwright test --project=phase26` — 103/103 passed (Konva isolation gate unaffected) — CONFIRMED
- `npx playwright test --project=phase15-stubs tests/lint/design-tokens.spec.ts tests/lint/no-undefined-css-tokens.spec.ts` — 9/9 passed — CONFIRMED
- `npx tsc --noEmit` exits 0 — CONFIRMED
- `npx eslint` on SiteEditor.tsx, SiteEditorLoader.tsx, site-editor-canvas.spec.ts — 0 errors, 0 warnings — CONFIRMED
