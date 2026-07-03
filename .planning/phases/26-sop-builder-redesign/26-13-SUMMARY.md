---
phase: 26-sop-builder-redesign
plan: 13
subsystem: admin-builder / annotation-persistence + worker baked read
tags: [konva, annotation, bake-on-publish, service-role, org-scope, bundle-isolation, next16]
status: complete (persistence + bake wired; annotate launch reachable — 26-11 device-UX residual now verifiable post-deploy)

# Dependency graph
requires:
  - phase: 26-05
    provides: "sop_image_annotations table (scene/natural dims/baked path, append-only, org-scoped SELECT) + AnnotationEditorLoader + konva-worker-isolation gate"
  - phase: 26-11
    provides: "Full Konva editor (AnnotationEditor) + annotation-tools scene model + onChange scene JSON"
  - phase: 26-12
    provides: "BlockEditShell/EditableDocument re-wire (MediaGrid is the admin diagram edit surface)"
provides:
  - "saveAnnotation + bakeAnnotation server actions (service-role, org self-enforce, parseJwtPayload, async-only 'use server')"
  - "baked-path.ts — PURE content-versioned baked-PNG path helpers (kept out of the 'use server' module — CLAUDE.md 2026-06-27)"
  - "bake-on-publish.ts — client stage.toDataURL → versioned baked PNG via the action"
  - "VisualBlock baked-vs-raw diagram read (baked <img> wins, Konva-free worker path, R8)"
  - "DiagramAnnotateModal — the annotate launch point wired into MediaGrid diagram items (makes the 26-11 editor reachable from a route)"
affects:
  - "26.5 agent layer (annotation scene + baked PNG are now a real read/write surface)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client rasterises (stage.toDataURL); the server action owns versioning + the service-role storage upload + baked_storage_path write (never trust the client with the path or the org)"
    - "Content-versioned baked PNG (.v{N}.png) to beat CDN/service-worker cache on re-publish"
    - "baked path lives on the VisualBlock props (bakedSrc) — NOT a layout_data schema change (layout_data FROZEN, D-01)"

key-files:
  created:
    - src/actions/annotations.ts
    - src/lib/builder/baked-path.ts
    - src/components/admin/builder-v2/visual/bake-on-publish.ts
    - src/components/admin/builder-v2/visual/DiagramAnnotateModal.tsx
    - tests/phase26/bake-on-publish.spec.ts
  modified:
    - src/components/admin/builder-v2/visual/VisualBlock.tsx
    - src/components/admin/builder-v2/visual/MediaGrid.tsx
    - src/components/admin/builder-v2/visual/AnnotationEditor.tsx
    - src/components/admin/builder-v2/visual/media-adapter.ts
    - src/lib/validators/blocks.ts
    - src/lib/builder/sign-layout-data-images.ts
  deleted:
    - "src/app/(protected)/admin/builder-v2-konva-spike/page.tsx (26-05 throwaway spike — real MediaGrid wiring replaces it)"

key-decisions:
  - "Bake runs at annotation SAVE (the Konva Stage is live in the editor), not a headless publish pass — the baked PNG + baked_storage_path outcome is identical without mounting an offscreen Stage per diagram (Rule 3 pragmatic deviation from the plan's publish-time framing)"
  - "saveAnnotation is append-only (one row per save, non-destructive history); bakeAnnotation attaches the baked path to the LATEST scene row (updates baked_storage_path/baked_at metadata only — never mutates a stored scene)"
  - "sop_images has no organisation_id column → org membership of a diagram image is enforced through its org-scoped sops row (service-role bypasses RLS, so this join IS the gate)"
  - "bakedSrc/sopImageId added as optional VisualBlock props (mirrored in validators/blocks so the lossless commit gate accepts them) — sanctioned by 'baked path lives on VisualBlock props', not a layout_data migration"

requirements-completed: [R5, R8]

# Metrics
duration: ~40min
completed: 2026-07-03
---

# Phase 26 Plan 26-13: Annotation Persistence + Bake-on-Publish Summary

Closed the absorbed Phase 17 arc (D-03 slice 3): diagram annotations now **persist** to `sop_image_annotations` and **bake** into a flat, content-versioned PNG that the worker renders with **zero Konva**. Two real server actions (`saveAnnotation`, `bakeAnnotation`) — both service-role, both self-enforcing org-scope from `parseJwtPayload` — a client rasteriser (`bake-on-publish.ts`), a baked-vs-raw worker read in `VisualBlock`, and the annotate **launch point** wired into `MediaGrid` (which finally makes the 26-11 Konva editor reachable from a route, so the carried device-UX residual can be verified on sopstart.com). The 26-05 throwaway Konva spike route is deleted — the real admin wiring now forces react-konva into the build graph, and the worker `/sops/[sopId]` bundle stays **Δ0 KB, Konva-free**.

## What Was Built

### Task 1 — saveAnnotation + bakeAnnotation (commits `9513a2d` RED, `a0ab8e8` GREEN)
- **`src/actions/annotations.ts`** (`'use server'`, async-only):
  - `saveAnnotation({ sopImageId, scene, naturalWidth, naturalHeight })` — appends a Konva scene row via `createAdminClient()` (service-role; the table has no authenticated write policy, 26-05). Org from `parseJwtPayload(access_token)` (never `atob`), the target `sop_image` is confirmed in-org via its `sops` row, and `organisation_id` is self-set from the JWT — never client-supplied (T-26-13-01).
  - `bakeAnnotation({ sopImageId, dataUrl })` — decodes the client PNG, uploads a content-versioned baked PNG to `sop-images/baked/{sopId}/{imageId}.v{N}.png` (service-role), then records `baked_storage_path`/`baked_at` on the latest scene row with a self-enforced `.eq('organisation_id', callerOrg)` on the write.
  - Non-exported `callerOrgId()` / `imageSopIdForOrg()` helpers (allowed — only *exports* must be async in a 'use server' module).
- **`src/lib/builder/baked-path.ts`** (PURE): `bakedStoragePath(sop, image, v)` + `nextBakedVersion(currentPath)`. Kept OUT of the action module — a sync export in a `'use server'` file breaks `next build` (CLAUDE.md 2026-06-27) — and being pure it also loads in-process in the phase26 project.

### Task 2 — bake-on-publish + Konva-free worker read + annotate launch (commits `dd3004c` RED, `29551ca` GREEN)
- **`bake-on-publish.ts`** (client, in `visual/`): `bakeStageToVersionedPng(stage, sopImageId)` — `stage.toDataURL({ pixelRatio: 2 })` then delegates versioning/upload to `bakeAnnotation`. Runs at annotation save (live Stage), not a headless publish pass.
- **`AnnotationEditor.tsx`**: added `onStageReady(stage)` (fired in the mount effect, alongside the existing `stage.destroy()` teardown) so the launcher can bake the live Stage.
- **`DiagramAnnotateModal.tsx`** (new, in `visual/`): opens the 26-11 editor via `AnnotationEditorLoader` (dynamic ssr:false — Konva code-split), captures the scene JSON + live Stage, and on "Save & bake" persists the scene then bakes the flat PNG, handing `{ annotationId, bakedSrc }` back to the grid.
- **`MediaGrid.tsx`**: diagram items now show an "annotate" affordance that opens the modal; the returned annotationId + baked path are committed onto the item through the existing lossless `onCommitField` path.
- **`VisualBlock.tsx`**: worker read prefers `item.bakedSrc` for a diagram (baked `<img>` wins over raw) — still imports no Konva.
- **`media-adapter.ts` + `validators/blocks.ts`**: `bakedSrc` + `sopImageId` added as optional VisualBlock props (carried through `toVisualItems`/`fromVisualItems` and the commit-gate schema).
- **`sign-layout-data-images.ts`**: generalised the signer to a `{ obj, key, path }` ref so a diagram item's raw `bakedSrc` is signed like every other private `sop-images` path for the worker read.
- **Deleted** the 26-05 `builder-v2-konva-spike` route — the real MediaGrid → DiagramAnnotateModal → AnnotationEditorLoader path now carries react-konva into the admin build graph.

## Verification

- `npx playwright test --project=phase26 -g "bake-on-publish|konva-worker-isolation|annotation-primitives"` → **27 passed** (12 bake/persist + 3 isolation + 12 primitives/hotspot).
- `npx tsc --noEmit` → clean (exit 0).
- `npm run build` → green (real `next build` — the async-only `'use server'` gate that only surfaces here, CLAUDE.md 2026-06-27). Postbuild bundle gate: `/sops/[sopId]/page` = 1054 KB, **Δ 0 KB**; **Konva isolation OK** — konva + react-konva absent from the worker bundle even though the editor is now reachable admin-side (dynamic ssr:false keeps it split). pdfjs/mammoth isolation also green.

## Deviations from Plan

### Auto-fixed / pragmatic (Rules 2/3)

**1. [Rule 3 - Blocking] Bake at annotation-save, not headless publish**
- **Found during:** Task 2. The plan frames baking as a publish-time pass ("at publish … the admin client bakes stage.toDataURL()"), but BuilderClient owns no publish handler (publish is BuilderStageShell) and a headless publish pass would need to mount an offscreen Konva Stage per annotated diagram to re-rasterise.
- **Fix:** Bake at annotation **save** where the Stage is already live (DiagramAnnotateModal). The baked PNG + `baked_storage_path` outcome is identical. `bake-on-publish.ts` remains the reusable rasteriser.
- **Impact:** `BuilderClient.tsx` (listed in the plan's files_modified) was NOT modified — the launch + bake live in `MediaGrid`/`DiagramAnnotateModal`, which render under BuilderClient → EditableDocument → BlockEditShell.

**2. [Rule 2 - Correctness] Enabling props + signer generalisation**
- Added `bakedSrc`/`sopImageId` to the VisualItem model AND mirrored them in `validators/blocks.ts` (the lossless commit gate would otherwise strip/reject the new keys), and generalised `sign-layout-data-images.ts` to sign the baked path. Not in the plan's file list but required for the baked read to be functional end-to-end.

## Known Stubs

- **Diagram-item → `sop_images` linkage (`sopImageId`) is not yet populated in existing layout_data.** The `saveAnnotation` FK requires a `sop_images` row; pipeline-extracted diagrams have one, but the item→image id is threaded upstream at parse time (out of this plan's scope). Until that thread lands, the annotate modal still **opens and draws** (so the 26-11 UX feel is verifiable), but "Save & bake" is disabled for hand-added diagram slots with no linked image (button shows "Link an image to this diagram first"). The security-critical write path (`saveAnnotation`/`bakeAnnotation`) is fully real and org-safe regardless. Follow-up: populate `sopImageId` on diagram VisualItems at extraction/upload.

## Threat Flags

None beyond the plan's `<threat_model>`. T-26-13-01 (cross-org write) — mitigated: both actions self-enforce `.eq('organisation_id', callerOrg)` + in-org image check, org from `parseJwtPayload`. T-26-13-03 (sync export breaks build) — mitigated: annotations.ts async-only, pure helpers in `src/lib/builder/baked-path.ts`, real `npm run build` run. T-26-13-04 (Konva enters worker) — mitigated: worker serves the baked `<img>`; isolation lint + bundle gate re-ran green.

## Deferred-Residual (26-11 device-UX, now unblocked)

The carried 26-11 UAT item **`p26-annotation-editor-feel`** (on-device Konva draw/select/undo/palm-reject/re-open feel) is now **reachable** — the annotate launch mounts the editor from the admin builder. Run it on sopstart.com after this deploys, alongside a persistence check (annotate a pipeline diagram → Save & bake → confirm the worker read shows the baked image).

## Self-Check: PASSED

- All 5 created files present on disk; spike route confirmed deleted.
- All 4 task commits (`9513a2d`, `a0ab8e8`, `dd3004c`, `29551ca`) exist in git history.
- 27 phase26 specs green; tsc clean; `next build` green; Konva worker isolation Δ0 KB.
