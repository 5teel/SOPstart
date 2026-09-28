---
phase: 51-site-model-machine-editor
plan: 01
subsystem: testing
tags: [playwright, zod, konva, harness, contract-module]

requires: []
provides:
  - phase51 Playwright project registered (broad tests/phase51/** testMatch)
  - Six Wave-0 stub specs, one per downstream plan (51-02..51-06)
  - Widened Konva allow-list (src/components/admin/site added) + SiteEditor-via-loader rule
  - tests/evals/site-editor.eval.ts skeleton + tests/evals/fixtures/site-scene.png (1600x900)
  - src/lib/validators/site.ts (Zod schemas + row/data types)
  - src/lib/site/scene.ts (scenePath, newMachineCode, polygon geometry, fitView/zoomAt, Gemini prompt/request/response helpers, SceneEditorProps contract)
  - .planning/phases/51-site-model-machine-editor/51-BASELINE-FAILURES.md (20 pre-existing failures at commit 736f44a)
affects: [51-02, 51-03, 51-04, 51-05, 51-06, 51-07]

tech-stack:
  added: []
  patterns:
    - "Crockford base32 6-char machine code via crypto.getRandomValues, unbiased % 32 mapping"
    - "Pure pan/zoom math (fitView/zoomAt) ported from sketch 007, decoupled from Konva so it's unit-testable without a canvas"
    - "Konva allow-list widened to an array (ALLOWED_DIRS) with a file-scoped loader-only rule layered on top of the directory allow-list"

key-files:
  created:
    - playwright.config.ts (phase51 project block)
    - tests/phase51/site-model.spec.ts
    - tests/phase51/site-migration-shape.spec.ts
    - tests/phase51/site-model-rls-runtime.spec.ts
    - tests/phase51/site-actions-contract.spec.ts
    - tests/phase51/site-editor-canvas.spec.ts
    - tests/phase51/site-workspace-wiring.spec.ts
    - tests/phase51/builder-machines-row.spec.ts
    - tests/evals/site-editor.eval.ts
    - tests/evals/fixtures/site-scene.png
    - src/lib/validators/site.ts
    - src/lib/site/scene.ts
    - .planning/phases/51-site-model-machine-editor/51-BASELINE-FAILURES.md
  modified:
    - tests/phase26/konva-worker-isolation.spec.ts

key-decisions:
  - "Polygon validation is shape-only (>=3 finite non-negative points, <=200) -- no convexity/self-intersection check, per RESEARCH Pitfall 3"
  - "Machine code = 6-char Crockford base32 (32^6 ~= 1.07B), CSPRNG via crypto.getRandomValues"
  - "Editor zoom clamp is a caller-supplied [min, max] on zoomAt, not hardcoded -- the sketch's 0.35-2.4 is the worker-renderer contract, too tight for vertex placement on a 2K scene"
  - "SiteEditor-via-loader rule is file-scoped, not directory-scoped, because SiteWorkspace.tsx (51-05) will live in the same src/components/admin/site/ directory and must still go through SiteEditorLoader"

patterns-established:
  - "phase51 Playwright project: broad testMatch tests/phase51/**, single registration point for the whole phase"
  - "Editor prop contract (SceneEditorProps) lives in the pure scene.ts module, not in the Konva component, so SiteWorkspace can type against it without importing the Konva-gated SiteEditor"

requirements-completed: [SIT-01, SIT-02, SIT-03, SIT-04]

duration: 8min
completed: 2026-09-28
---

# Phase 51 Plan 01: Wave-0 Scaffold & Site Model Contract Summary

**Registered the phase51 test harness, widened the Konva bundle-isolation gate for the upcoming site editor, and shipped the site model's pure data contract (Zod validators + scene/geometry/Gemini helpers) test-first.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-28T09:36:03Z
- **Completed:** 2026-09-28T09:43:59Z
- **Tasks:** 3 completed
- **Files modified:** 14 (12 created, 1 modified spec, 1 modified config)

## Accomplishments

- Registered the `phase51` Playwright project and six `test.fixme` stub specs (one per downstream plan 51-02..51-06), verified discoverable with `--list`
- Recorded the pre-phase full-suite failure baseline (20 pre-existing failures at commit `736f44a`) so the phase's final gate can prove "no new failures"
- Widened `tests/phase26/konva-worker-isolation.spec.ts`'s `ALLOWED_DIR` to an array (`ALLOWED_DIRS`) covering `src/components/admin/site`, and added a fourth, file-scoped test enforcing that `SiteEditor` is only ever reached through `SiteEditorLoader`
- Added the `tests/evals/site-editor.eval.ts` skeleton and a 1600x900 fixture PNG (four "machine" rectangles with walkway gaps) for 51-07's deployed eval
- Built `src/lib/validators/site.ts` and `src/lib/site/scene.ts` test-first (RED commit, then GREEN): polygon/machine/layout/junction/generate-scene Zod schemas, scene path + Crockford-base32 machine code helpers, pan/zoom math ported from the sketch, and the Gemini REST prompt/request/response shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the phase51 project, create the stub specs, record the failure baseline** - `b553165` (feat)
2. **Task 2: Widen the Konva gate, add the SiteEditor-via-loader rule, eval skeleton + fixture PNG** - `2cabe92` (feat)
3. **Task 3: Site model contract — validators + pure scene helpers (test-first)**
   - RED: `56b2285` (test) — `tests/phase51/site-model.spec.ts`, confirmed failing (module not found)
   - GREEN: `74bb8eb` (feat) — `src/lib/validators/site.ts` + `src/lib/site/scene.ts`, 31/31 passing; includes a 2-line test-fixture fix (invalid UUID literals corrected to satisfy zod 4's stricter `.uuid()` format check)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `playwright.config.ts` - added `phase51` project block (broad `tests/phase51/**` testMatch)
- `tests/phase51/site-migration-shape.spec.ts` - RLS/migration shape stub (activates 51-02)
- `tests/phase51/site-model-rls-runtime.spec.ts` - runtime RLS matrix stub (activates 51-02)
- `tests/phase51/site-actions-contract.spec.ts` - actions + generate-route stub (activates 51-03)
- `tests/phase51/site-editor-canvas.spec.ts` - Konva canvas stub (activates 51-04)
- `tests/phase51/site-workspace-wiring.spec.ts` - workspace + route stub (activates 51-05)
- `tests/phase51/builder-machines-row.spec.ts` - builder ToolsMenu stub (activates 51-06)
- `tests/phase51/site-model.spec.ts` - live TDD contract spec, 31 passing tests
- `tests/phase26/konva-worker-isolation.spec.ts` - `ALLOWED_DIR` → `ALLOWED_DIRS`, new SiteEditor-via-loader rule
- `tests/evals/site-editor.eval.ts` - deployed-eval skeleton (self-skips without `EVAL_BASE_URL`)
- `tests/evals/fixtures/site-scene.png` - 1600x900 fixture scene image (38.9 KB)
- `src/lib/validators/site.ts` - `polygonSchema`, `upsertSiteMachineSchema`, `upsertSiteLayoutSchema`, `setSopMachinesSchema`, `generateSceneSchema`, `SCENE_MAX_BYTES`, `SCENE_MIME_TYPES`, row/data types (`SiteLayout`, `SiteMachine`, `SopMachineLink`, `SiteDepartment`, `SiteSopOption`, `SiteData`)
- `src/lib/site/scene.ts` - `scenePath`, `newMachineCode`, `MACHINE_CODE_PATTERN`, `polygonWithinScene`, `clampPoint`, `centroid`, `fitView`, `zoomAt`, `buildScenePrompt`, `buildGeminiImageRequest`, `extractGeminiImage`, `geminiEndpoint`, `SceneEditorProps`
- `.planning/phases/51-site-model-machine-editor/51-BASELINE-FAILURES.md` - pre-phase failure list

## Decisions Made

- Polygon shape-only validation (no geometric correctness checks) to avoid rejecting legitimate concave machine outlines — matches RESEARCH Pitfall 3
- Machine code alphabet is Crockford base32 (excludes I, L, O, U) for human-legible plate codes (Phase 53), generated via CSPRNG with an unbiased `% 32` mapping since 256 is a multiple of 32
- `fitView`/`zoomAt` take explicit width/height/scale args rather than closing over component state, keeping them pure and independently unit-testable
- The SiteEditor-via-loader Konva rule checks the file path exactly (not a directory prefix) because `SiteWorkspace.tsx` (Plan 51-05) will live alongside `SiteEditor.tsx` in the same allow-listed directory and must still be forced through `SiteEditorLoader`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture used invalid UUID literals**
- **Found during:** Task 3 GREEN run
- **Issue:** `tests/phase51/site-model.spec.ts` used `00000000-0000-0000-0000-000000000001` as a stand-in UUID for `siteLayoutId`/`id` fields. Zod 4's `.uuid()` format check enforces RFC4122 variant/version nibbles (or the two specific all-zero/all-f sentinels) — this fixture matched neither, so two otherwise-correct schema tests failed.
- **Fix:** Replaced both occurrences with a properly-formed v4-shaped UUID (`11111111-1111-4111-8111-111111111111`).
- **Files modified:** `tests/phase51/site-model.spec.ts`
- **Verification:** Re-ran `npx playwright test --project=phase51 tests/phase51/site-model.spec.ts` — 31/31 passing.
- **Committed in:** `74bb8eb` (part of the GREEN task commit)

No other deviations — plan executed as written.

## Known Stubs

None — this plan's deliverables (harness, gate, contract modules) are fully implemented and tested; the six `tests/phase51/*.spec.ts` stub files and the eval skeleton contain `test.fixme` entries by design (they are Wave-0 scaffolding activated by later plans, per the plan's own spec).

## Self-Check: PASSED

- `playwright.config.ts` contains `name: 'phase51'` (count 1) — FOUND
- `tests/phase51/site-migration-shape.spec.ts` — FOUND
- `tests/phase51/site-model-rls-runtime.spec.ts` — FOUND
- `tests/phase51/site-actions-contract.spec.ts` — FOUND
- `tests/phase51/site-editor-canvas.spec.ts` — FOUND
- `tests/phase51/site-workspace-wiring.spec.ts` — FOUND
- `tests/phase51/builder-machines-row.spec.ts` — FOUND
- `tests/phase51/site-model.spec.ts` — FOUND
- `tests/evals/site-editor.eval.ts` — FOUND
- `tests/evals/fixtures/site-scene.png` — FOUND (1600x900 PNG, 38.9 KB)
- `src/lib/validators/site.ts` — FOUND
- `src/lib/site/scene.ts` — FOUND
- `.planning/phases/51-site-model-machine-editor/51-BASELINE-FAILURES.md` — FOUND
- Commit `b553165` — FOUND in `git log --oneline`
- Commit `2cabe92` — FOUND in `git log --oneline`
- Commit `56b2285` — FOUND in `git log --oneline`
- Commit `74bb8eb` — FOUND in `git log --oneline`
- `npx playwright test --list --project=phase51` lists 71 tests across 7 files — CONFIRMED
- `npx playwright test --project=phase51` exits 0 (31 passed, 40 skipped) — CONFIRMED
- `npx playwright test --project=phase26` exits 0 (103 passed, incl. 4 konva-worker-isolation tests) — CONFIRMED
- `npx tsc --noEmit` exits 0 — CONFIRMED
