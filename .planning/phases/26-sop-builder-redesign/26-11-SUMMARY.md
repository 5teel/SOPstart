---
phase: 26-sop-builder-redesign
plan: 11
subsystem: admin-builder / annotation-editor
tags: [konva, annotation, primitives, transformer, undo-redo, palm-rejection, hotspot, bundle-isolation]
status: build-complete-awaiting-human-verify

# Dependency graph
requires:
  - phase: 26-05
    provides: "AnnotationEditor spike shell + AnnotationEditorLoader (dynamic ssr:false) + konva-worker-isolation gate + sop_image_annotations table"
  - phase: 26-09
    provides: "VisualBlock diagram medium + VisualItem.annotationId linkage"
provides:
  - "Full Konva annotation editor (R5/D-03 slice 2): Arrow/Rect/Ellipse/Text/numbered-callout/freehand + Konva.Transformer + undo/redo + textarea overlay + stylus palm-rejection"
  - "annotation-tools.ts — the PURE scene-JSON tool model (primitive factories, snapshot undo/redo, non-destructive serialize, acceptsPointer palm-rejection filter) — unit-tested in-process"
  - "DiagramHotspotBlock — the ONLY freeform-positioning surface: numbered callouts at freeform x/y in natural-image space, linked via annotationId"
affects:
  - "26-13 (persist scene → sop_image_annotations via service-role action + bake-on-publish PNG; delete the 26-05 spike route)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PURE tool model (annotation-tools.ts, no konva/react) so the phase26 project — no @/ alias — exercises primitive/undo-redo/serialize logic in-process; Konva stays in the .tsx leaf"
    - "Scene = shapes only, natural-image-space coords; background image URL kept OUT of the scene (Konva pitfall #8) → non-destructive, scale-stable re-open (pitfall #2)"
    - "Snapshot undo/redo (past/present/future) over immutable Scene objects — a new commit branches away the redo future"

key-files:
  created:
    - src/components/admin/builder-v2/visual/annotation-tools.ts
    - src/components/admin/builder-v2/visual/DiagramHotspotBlock.tsx
    - tests/phase26/annotation-primitives.spec.ts
  modified:
    - src/components/admin/builder-v2/visual/AnnotationEditor.tsx

key-decisions:
  - "Split the geometry/serialize/history logic into a PURE annotation-tools.ts (no konva import) so it loads in the phase26 Playwright project (mirrors media-adapter.ts) — Konva canvas rendering is the human-verify gate, the model is machine-proven"
  - "DiagramHotspotBlock reuses createCallout Labels on the SAME scene model — a hotspot scene IS a normal annotation scene (one editor, one storage shape), not a bespoke format"
  - "Persist deferred to 26-13 (onChange surfaces scene JSON upward; no save action here) — matches the plan's key_links (scene JSON snapshot, save deferred)"

requirements-completed: []   # R5 slice 2 build done; R5 completion pending the human-verify UX gate

# Metrics
duration: ~35min
completed: 2026-07-03 (non-gated build; awaiting Task-3 human-verify)
---

# Phase 26 Plan 26-11: Konva Annotation Primitives + DiagramHotspotBlock Summary

**Upgraded the 26-05 Konva spike shell into the full absorbed-Phase-17 annotation editor — six primitives (Arrow / Rect / Ellipse / Text / numbered-callout / freehand), `Konva.Transformer` resize+rotate, snapshot undo/redo, `<textarea>` text-edit overlay, and a "Pen only" stylus palm-rejection toggle — plus `DiagramHotspotBlock`, the single freeform-positioning surface (numbered callouts at freeform x/y in natural-image space). All non-gated build work is complete, tested, tsc-clean, and build-green with the worker bundle Konva-free (Δ0 KB). The device UX (draw feel / transform handles / palm rejection) is the remaining Task-3 human-verify gate.**

## Status: build complete — awaiting the Task-3 human-verify UX gate

Tasks 1 and 2 are done and committed. Task 3 is a `checkpoint:human-verify` (blocking) — the Konva draw/select/undo/palm-reject/re-edit feel is device-dependent and cannot be proven headless (it is the VALIDATION manual-only item). **Not self-approved** — returned to the orchestrator for the user to eyeball on-device. R5/D-03-slice-2 is marked complete only after that approval.

## What Was Built

### Task 1 — Primitives + Transformer + undo/redo + palm-rejection (commits `f6ddecf` RED, `52b40a6` GREEN)
- **`annotation-tools.ts` (PURE — no konva, no react):** the scene-JSON model + tool logic the editor drives.
  - `Scene = { schemaVersion, width, height, shapes[] }` — shapes only; each shape's keys map 1:1 onto its react-konva node props.
  - Primitive factories: `createArrow` / `createRect` (dashed option) / `createEllipse` / `createText` / `createCallout` (auto-incrementing number off existing Labels) / `createFreehand` (tension-smoothed Line). Stroke defaults to `SEMANTIC_ACCENTS` (brand-yellow primary `#fbbf24`, hazard red `#ef4444`) — not arbitrary.
  - Immutable scene ops (`addShape`/`removeShape`/`updateShape`) + snapshot undo/redo (`initHistory`/`commitScene`/`undo`/`redo`, past/present/future; a new commit branches away the redo future).
  - `serializeScene`/`deserializeScene` — non-destructive round-trip; the scene never carries an image URL.
  - `acceptsPointer(pointerType, {penOnly})` — palm-rejection filter (pen-only ⇒ pen accepted, touch/mouse rejected).
- **`AnnotationEditor.tsx`:** full react-konva editor consuming the pure model — toolbar (one active tool at a time), `Konva.Transformer` (resize/rotate) bound to the selected node, `<textarea>` overlay for Text editing, Delete key + Cmd/Ctrl+Z(/⇧) undo/redo, drag-to-move, "Pen only" toggle (sets `touch-action:none` + filters non-pen pointers), background `<img>` rendered OUTSIDE the scene, `stage.destroy()` teardown (pitfall #5).

### Task 2 — DiagramHotspotBlock, freeform numbered callouts (commits `db7acb9` RED, `a71dbdc` GREEN)
- **`DiagramHotspotBlock.tsx`:** tap the diagram → drop the next numbered callout at that freeform x/y in natural-image space; drag to reposition. Backed by the SAME `annotation-tools` scene (callouts are `createCallout` Labels), linked to its `sop_image_annotations` row via `annotationId`. The single freeform-positioning exception (UI-SPEC §DiagramHotspotBlock) — called out so the layout checker does not flag it. Konva admin-only; `stage.destroy()` teardown; Pen-only palm rejection.

### Tests — `tests/phase26/annotation-primitives.spec.ts` (in-process, phase26 project)
- Six primitives each create their Konva node type in the scene JSON; callouts auto-increment; strokes are the semantic accents.
- Undo removes the last shape / redo restores / a post-undo commit branches away the future.
- Serialize omits any image URL; rect round-trips on re-open (behavioural, model-level).
- Palm rejection: pen-only accepts pen, rejects touch/mouse; off ⇒ accepts all.
- DiagramHotspotBlock: two callouts persist x/y + numbering across serialize → re-open (coordinate stability, pitfall #2); source-contract that it is Konva-backed and links via `annotationId`.
- Source-contract: `annotation-tools.ts` stays pure (no konva/react import); `AnnotationEditor` drives the pure tools, uses `Transformer`, `pointerType`, and `.destroy()`.

## Verification

- `npx playwright test --project=phase26 -g "annotation-primitives|konva-worker-isolation"` → **14 passed** (11 model/source-contract + 3 isolation).
- Hotspot describe (coordinate stability + annotationId) → green.
- `npx tsc --noEmit` → clean (exit 0).
- `npm run build` → green. Postbuild bundle gate: `/sops/[sopId]/page` = 1054 KB, **Δ 0 KB**; **Konva isolation OK** — konva + react-konva absent from the worker bundle (26-05 D-03 gate still green). pdfjs/mammoth isolation also green.

## Deviations from Plan

None — plan executed as written. Pure logic went into `annotation-tools.ts` and Konva stayed in the `.tsx` leaves exactly as the plan's `<action>` specified; no auto-fixes were needed.

## Known Stubs

- **Persistence is deferred to 26-13, by design.** The editor and hotspot block surface the scene JSON via `onChange` but do not save it — writing `sop_image_annotations.scene` (service-role action, self-enforcing org-scope) and bake-on-publish PNG are Plan 26-13 (this plan's `key_links` states "save deferred to 26-13"). Not a blocker: the annotation authoring model, primitives, transformer, undo/redo, palm-rejection, and hotspot placement are all complete and tested; only the write-through is out of scope.
- Neither `AnnotationEditor` nor `DiagramHotspotBlock` is wired into a route yet (VisualBlock diagram-item "annotate" launch is 26-13) — hence worker bundle Δ0 KB and nothing to leak.

## Threat Flags

None beyond the plan's `<threat_model>`. T-26-11-01 (XSS via annotation text) — mitigated: Konva text is canvas-rendered (no DOM injection); the `<textarea>` overlay commits plain text into the scene model. T-26-11-02 (Konva leaking to worker) — mitigated: editor + hotspot stay admin-only under `builder-v2/visual/`; the isolation lint + postbuild bundle gate both re-ran green.

## Awaiting

**Task 3 — human-verify Konva annotation UX (blocking).** On-device draw / select-transform / undo-redo / palm-reject / re-edit confirmation. See the checkpoint returned to the orchestrator. R5/D-03-slice-2 completes on approval.

## Self-Check: PASSED

- All 4 created/modified files present on disk.
- All 4 task commits (`f6ddecf`, `52b40a6`, `db7acb9`, `a71dbdc`) exist in git history.
- 14 phase26 specs green; tsc clean; build green; Konva worker-isolation gate green.
