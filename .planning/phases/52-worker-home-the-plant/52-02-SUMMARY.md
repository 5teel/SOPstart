---
phase: 52-worker-home-the-plant
plan: 02
subsystem: ui
tags: [playwright, source-contract, tdd, tailwind, scene, plant]

# Dependency graph
requires:
  - phase: 52-worker-home-the-plant
    plan: 01
    provides: phase52 Playwright project + stub specs, worker-signal.ts (plantRelState/compareToDoFirst/machineSops/PLANT_REL_LABEL), RelBadge.tsx, Konva/voice bundle guards
  - phase: 51-site-model-machine-editor
    provides: src/lib/site/scene.ts (View/fitView/zoomAt/centroid), src/lib/validators/site.ts (Point/Polygon)
provides:
  - src/lib/site/scene.ts additions -- ZOOM_MIN/ZOOM_MAX/PLANT_PANEL_WIDTH/FLY_SCALE/ZONE_FIT_MAX/CAMERA_MS, flyToView, fitBoxView, zoneColour
  - src/components/sop/plant/PlantStage.tsx -- PlantStage/PlantStageHandle/PlantStageMachine
  - src/components/sop/plant/MachinePanel.tsx -- MachinePanel
  - .plant-pin-bob keyframes in globals.css
  - tests/phase52/plant-stage.spec.ts and plant-panel.spec.ts flipped from fixme to live
affects: [52-03-now-card-and-ask-bar, 52-04-render-seam, 52-05-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Camera state seeded null, fit driven from an effect after mount, never from window/navigator during render (D-09)"
    - "React 19 ref-as-prop (no forwardRef) for an imperative camera handle (fit/flyTo/fitMachines)"
    - "Duration controlled via an inline transitionDuration style (0ms when not animating, CAMERA_MS while flying) rather than a fixed Tailwind duration class, so reduced-motion and drag/wheel snaps never animate"
    - "Tailwind v4's dynamic spacing/duration utilities accept arbitrary integers (w-95, h-6.5, duration-250) with no arbitrary-value brackets -- confirmed by compiling a probe file through @tailwindcss/postcss directly"

key-files:
  created:
    - src/components/sop/plant/PlantStage.tsx
    - src/components/sop/plant/MachinePanel.tsx
  modified:
    - src/lib/site/scene.ts
    - src/app/globals.css
    - tests/phase52/plant-stage.spec.ts
    - tests/phase52/plant-panel.spec.ts

key-decisions:
  - "flyToView/fitBoxView/zoneColour ported verbatim from sketch 007's buildStage arithmetic (zoomTo, department-chip fit) rather than re-derived, so behaviour matches the validated sketch exactly"
  - "PlantStage's transition duration is set via an inline style keyed off a `flying` boolean, not a fixed duration-350 Tailwind class, so pan/zoom/drag apply instantly (0ms) and only fit/flyTo/fitMachines animate over CAMERA_MS"
  - "MachinePanel never sorts its own `sops` prop -- ordering is worker-signal's job (machineSops/compareToDoFirst); the source-contract spec asserts no `.sort(` in the file"

patterns-established:
  - "A component doc comment must never quote a banned literal (even inside a path like 'tests/phase26/konva-worker-isolation.spec.ts' or the word 'owner') -- the deny-list greps the whole file text, not just code; describe the absence in different words (2026-09-28 class, hit twice this plan, see Deviations)"

requirements-completed: [HOM-01, HOM-04]

# Metrics
duration: ~45min
completed: 2026-09-29
---

# Phase 52 Plan 02: Plant Scene and Machine Panel Summary

**Camera maths ported into `scene.ts` (flyToView/fitBoxView/zoneColour) plus `PlantStage` (image + SVG polygon scene with pan/zoom-to-cursor/fly-to/pins) and `MachinePanel` (worker variant, D-11) -- both pure presentation components ready for 52-04 to compose**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-29
- **Completed:** 2026-09-29
- **Tasks:** 3 (Task 1 is TDD: RED then GREEN)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Added `ZOOM_MIN`/`ZOOM_MAX`/`PLANT_PANEL_WIDTH`/`FLY_SCALE`/`ZONE_FIT_MAX`/`CAMERA_MS` constants, `flyToView`, `fitBoxView` and `zoneColour` to `src/lib/site/scene.ts`, additive-only -- Phase 51's `SiteEditor` imports and the full `tests/phase51/site-model.spec.ts` suite still pass unchanged
- `zoneColour` implements the D-12 three-step resolution: a department's own non-default colour, then the Forming/General/Engineering token triple, then the next theme accent by index -- all hex-free in component code (the colour literal only ever lives in `scene.ts` as plain lib code, outside the design-token lint's component/app scan)
- Built `PlantStage.tsx`: an `<img>` at natural size inside one transformed `world` div with an SVG polygon overlay, no Konva. Camera state mounts `null` and fits in a post-mount effect (D-09); a `ResizeObserver` retries `fit()` if the stage was built at 0x0; wheel zoom-to-cursor is wired non-passively so `preventDefault()` works; drag-pan ignores pointerdowns that start on a `<polygon>`; `fit`/`flyTo`/`fitMachines` are exposed through a React 19 `ref` prop (no `forwardRef`); transitions apply only while `flying` (fit/flyTo/fitMachines), never on drag/wheel, and `prefers-reduced-motion` skips the animation entirely
- Machines render as focusable/clickable polygons (Enter/Space wired) with a paint precedence of selected > hovered-or-highlighted > zoned > pinned > transparent, and a counter-scaled label + amber pin (`.plant-pin-bob`, 26px, honours reduced-motion) that shows on hover, highlight, selection, or (for pinned machines) whenever the pointer is anywhere over the scene
- Built `MachinePanel.tsx` (D-11): sprite or "no photo yet", department name in its zone colour, machine name, SOP rows to-do first (ordering is entirely the caller's -- `machineSops`/`compareToDoFirst` from `worker-signal.ts` -- the component contains no `.sort(`), the shared `RelBadge`, a `Walk ›` link to `/sops/<id>?tab=walk` and a plain Read link to `/sops/<id>`. Empty state reads "No procedures for this machine yet." verbatim (52-04's bundle marker). No admin controls, `inert` when closed.
- Verified Tailwind v4's dynamic numeric-spacing/duration utilities (`w-95`, `h-50`, `h-13`, `h-6.5`, `w-6.5`, `mb-1.5`, `duration-250`, `duration-350`, …) actually compile before relying on them, by running a probe file through `@tailwindcss/postcss` directly (not guessed from convention) -- all confirmed present in the compiled CSS
- Flipped both `tests/phase52/plant-stage.spec.ts` and `plant-panel.spec.ts` from `test.fixme` stubs to live assertions (28 + 10 = 38 tests), asserting wiring (handler bodies, import lists, precedence of the polygon-vs-setPointerCapture check) rather than mere string presence, per the 2026-06-05 source-contract convention

## Task Commits

Task 1 is TDD (RED then GREEN); Tasks 2 and 3 are single commits:

1. **Task 1 RED: failing camera-maths tests for scene.ts** - `3c383af` (test)
1. **Task 1 GREEN: camera maths and zone colours in scene.ts** - `e24590e` (feat)
2. **Task 2: PlantStage** - `8c454be` (feat)
3. **Task 3: MachinePanel** - `142700d` (feat)

## Files Created/Modified
- `src/lib/site/scene.ts` - camera constants, `flyToView`, `fitBoxView`, `zoneColour` (additive)
- `src/components/sop/plant/PlantStage.tsx` - the read-only scene renderer
- `src/components/sop/plant/MachinePanel.tsx` - the worker machine panel
- `src/app/globals.css` - `.plant-pin-bob` keyframes + reduced-motion entry
- `tests/phase52/plant-stage.spec.ts` - camera-maths unit tests + PlantStage source-contract tests (0 fixme)
- `tests/phase52/plant-panel.spec.ts` - MachinePanel source-contract tests (0 fixme)

## Decisions Made
- Camera transitions are driven by an inline `transitionDuration` style keyed off a `flying` boolean rather than a fixed `duration-350` Tailwind class always being present -- this guarantees drag and wheel-zoom apply with zero transition lag (snap, not animate) while `fit`/`flyTo`/`fitMachines` animate over exactly `CAMERA_MS`, and it composes cleanly with the `prefers-reduced-motion` check inside `animateTo` (no CSS-only reduced-motion override needed for the world transform itself).
- `MachinePanel` deliberately does not import `PLANT_PANEL_WIDTH` at runtime -- the `w-95` Tailwind class is the single source of truth for the rendered width, and the source-contract spec is what imports the constant and asserts `PLANT_PANEL_WIDTH / 4 === 95`, keeping the two in step without the component needing the import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two doc comments quoted their own banned literal and self-tripped the grep guards they were describing**
- **Found during:** Task 2 (`PlantStage.tsx`) and Task 3 (`MachinePanel.tsx`) verification runs
- **Issue:** `PlantStage.tsx`'s header comment referenced the deny-listed engine by naming the guard file path (`tests/phase26/konva-worker-isolation.spec.ts`), which contains the banned word as a path segment -- tripping `tests/phase26/konva-worker-isolation.spec.ts`'s own plant-directory deny test. Separately, `MachinePanel.tsx`'s header comment said "no owner/version lines," and the word `owner` is itself one of the banned literals the plan's own `plant-panel.spec.ts` "no admin controls" assertion checks for -- tripping that test against the file describing its own absence. Same class as the `RelBadge.tsx` fix logged in 52-01 (commit `f21bd23`), now hit twice more in this plan.
- **Fix:** Reworded both comments to describe the absence without quoting the literal (e.g., "the admin-only canvas engine used by the site editor is deliberately absent here" instead of naming the guard file; "nothing here names who is responsible for a procedure" instead of the word itself).
- **Files modified:** `src/components/sop/plant/PlantStage.tsx`, `src/components/sop/plant/MachinePanel.tsx`
- **Commits:** `8c454be`, `142700d` (fixed within the same task commit before verification passed, not a separate commit)

None else — the rest of the plan executed exactly as written.

## Issues Encountered
None beyond the two self-inflicted comment-wording trips above, both caught and fixed within the normal verify-before-commit loop for their respective tasks.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `PlantStage` (`fit`/`flyTo`/`fitMachines` via ref, `onMachineClick`) and `MachinePanel` (`open`/`machine`/`department`/`sops`/`onClose`) are both pure presentation components with no internal data-fetching or derivation -- 52-03 (`NowCard`, `PlantAskBar`) and 52-04 (the render seam / `PlantHome` composition) can wire them directly to `listSiteForWorker()` + `worker-signal.ts` outputs with no further scavenger hunt.
- The camera maths (`flyToView`/`fitBoxView`/`zoneColour`) are unit-tested independently of the component, so 52-03's Now-card "Show me" and 52-04's department chips can call them with confidence.
- No blockers.

## Self-Check: PASSED

- FOUND: src/components/sop/plant/PlantStage.tsx
- FOUND: src/components/sop/plant/MachinePanel.tsx
- FOUND: src/lib/site/scene.ts (flyToView, fitBoxView, zoneColour present)
- FOUND: src/app/globals.css (.plant-pin-bob present)
- FOUND: tests/phase52/plant-stage.spec.ts (0 test.fixme)
- FOUND: tests/phase52/plant-panel.spec.ts (0 test.fixme)
- FOUND commit 3c383af (git log --oneline)
- FOUND commit e24590e
- FOUND commit 8c454be
- FOUND commit 142700d

---
*Phase: 52-worker-home-the-plant*
*Completed: 2026-09-29*
