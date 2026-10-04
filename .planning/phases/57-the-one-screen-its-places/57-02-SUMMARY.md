---
phase: 57-the-one-screen-its-places
plan: 02
subsystem: ui
tags: [plant-stage, rooms, shell, search, place-state, account-control]
requires:
  - phase: 57-01
    provides: rooms.ts (ROOMS, roomPolygon, roomMatches), place.ts (Place, parsePlace, formatPlace)
provides:
  - PlantStage room layer (PlantStageRoom, rooms, onRoomClick, flyInset, focus replay)
  - ShellFrame (three panes, one select(), search, Esc, edit swap) and ShellSite / ShellFrameProps
  - AccountControl (email, Profile, Sign out, admin Pathways / Feedback)
  - askMatches accepting { title } maps
affects: [57-04, 57-05, 57-06, 57-08, 57-09, 57-10]
tech-stack:
  added: []
  patterns: [last-camera-intent replay on resize, single select() writer for state plus address bar, pure resolvePlace in render]
key-files:
  created:
    - src/components/shell/ShellFrame.tsx
    - src/components/shell/AccountControl.tsx
  modified:
    - src/components/sop/plant/PlantStage.tsx
    - src/lib/sop/worker-signal.ts
    - tests/phase57/stage.spec.ts
    - tests/phase57/shell-structure.spec.ts
    - tests/phase57/search.spec.ts
    - tests/phase52/plant-render-seam.spec.ts
key-decisions:
  - "Camera intent (fit / fly / box) is recorded before the 0x0 measure check, so a stage that is hidden below lg replays the right intent when it first shows"
  - "Esc handler reads select through a ref updated in an effect, keeping replaceState in exactly one place"
patterns-established:
  - "resolvePlace(place, ctx) is a pure function: unknown machine/department, or edit without rights, renders as the overview; never redirects"
requirements-completed: []
duration: ~50min
completed: 2026-10-05
---

# Phase 57 Plan 02: Rooms on the scene and the shared frame Summary

PlantStage now draws the four rooms above the machines with always-on signposts and replays its last camera intent on resize; ShellFrame is a data-agnostic three-pane frame where map, list and detail close all go through one `select()`.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. Room layer, signposts, flyInset, focus replay | b3391e5 | `stage.spec` 9 tests live and green; phase52, phase26, both token lints green |
| 2. ShellFrame, AccountControl, search | fe03769 | frame + search specs live; askMatches `{ title }` unit test |

Requirements SHL-01, SHL-02, SHL-04, PLC-01 are not ticked: the frame is not mounted anywhere yet (57-04 / 57-05 mount it), so they are not proven end to end.

## Verification

- `npx tsc --noEmit`: exit 0 after both tasks.
- `npx playwright test --project=phase57`: 47 passed, 22 skipped (remaining fixme stubs owned by later plans).
- `--project=phase52`: 93 passed. `--project=phase26`: 77 passed.
- `--project=phase15-stubs design-tokens no-undefined-css-tokens no-dead-internal-hrefs`: 13 passed.
- `npm run build`: exit 0, run twice (second after clearing `.next/cache/webpack` per the 2026-09-29 learning). `/sops` and `/sops/[sopId]` are 818 KB against a baseline of 817 KB (+1 KB, inside the +-2 KB tolerance); `.bundle-baseline.json` untouched. The +1 KB is the PlantStage room layer, which the existing `/sops` plant chunk carries; ShellFrame itself is unmounted so adds no route weight.
- Compiled CSS contains the new utility families (`lg:w-64`, `lg:w-100`, `aria-[current=true]:bg-paper-2`, `h-tap`, `w-tap`, `min-w-6`, `text-micro`).
- Not run: deployed eval (nothing mounts the frame yet; 57-10 owns it). Room polygons were not checked against real scene screenshots for the same reason; the Workshop fractions from 57-01 remain the one table to tune once the frame is mounted.

## Deviations from Plan

**1. [Rule 1 - Bug] Focus intent was recorded only after a successful measure.** The plan's replay design would lose a `fly` / `box` intent when the stage is hidden below 1024px (0x0, `flyToView` returns null) and later shown: the observer would only `fit()`. `fit`, `flyTo` and `fitMachines` now set `focusRef` before the null check, and the ResizeObserver always replays the stored intent (a `free` focus with a null view still fits). Files: `PlantStage.tsx`. Commit fe03769.

**2. [Plan wording] `followFitRef` and the observer's `viewRef.current === null` branch.** The null-view guard remains as `viewRef.current === null && focusRef.current.kind === 'free'`, which is unreachable by design but keeps the spec'd "null view still fits" explicit; the real null-view fit comes from the default `{ kind: 'fit' }` intent.

**3. Task 1 stage spec** asserts the flyTo / ShellFrame same-select behaviour in `shell-structure.spec.ts` rather than `stage.spec.ts`, because ShellFrame does not exist at the Task 1 commit.

Tooling note: two multi-line python heredocs were rejected by the shell tool; edits were made via script files and the Edit/Write tools instead. No effect on the result.

## Known Stubs

None in the new code. `renderCard`, `renderDetail`, `renderEdit` and `account` are caller-supplied slots by design (57-04 and 57-05 feed them).

## Threat Flags

None. T-57-04 (ids resolve only against loaded rows, overview otherwise), T-57-05 (search text only in React text nodes, no URL built from it), T-57-06 (replaceState once, inside `select()`, no router or navigation import; source-contract pinned) and T-57-07 (`canEdit` false resolves edit to the overview) are implemented and covered by `shell-structure.spec.ts`.

## Self-Check: PASSED

- Files exist: ShellFrame.tsx, AccountControl.tsx, this SUMMARY.
- Commits found: b3391e5, fe03769.
- STATE.md and ROADMAP.md not modified.
