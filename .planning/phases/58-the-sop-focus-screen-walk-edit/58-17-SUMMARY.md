---
phase: 58-the-sop-focus-screen-walk-edit
plan: 17
subsystem: focus-editor
tags: [annotation, konva, step-photos, lazy-chunk, un-drop]
requires: [58-12, 58-13, 58-16]
provides:
  - "Image annotation on step photos: full-screen Konva overlay, bake-on-save, marks kept for re-editing"
  - "saveAnnotatedStepImage / getStepAnnotation in src/actions/focus-steps.ts"
affects: [58-18]
tech-stack:
  added: []
  patterns: ["nested next/dynamic({ ssr: false }) import inside StepCard only", "canvas colours read from declared design tokens at shape creation"]
key-files:
  created:
    - src/components/focus/admin/annotate/AnnotationEditor.tsx
    - src/components/focus/admin/annotate/annotation-tools.ts
    - tests/phase58/annotation.spec.ts
  modified:
    - src/components/focus/admin/StepCard.tsx
    - src/actions/focus-steps.ts
    - scripts/dropped-features.json
    - tests/phase55/deletion-sweep.spec.ts
    - tests/phase26/konva-worker-isolation.spec.ts
    - tests/phase58/edit-actions.spec.ts
    - tests/evals/sop-focus.eval.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - .claude/skills/sketch-findings-SOPstart/references/one-screen-site.md
    - .claude/skills/sketch-findings-SOPstart/SKILL.md
key-decisions:
  - "Original photo is kept untouched (its sop_images row + file); the baked JPEG replaces its path in image_paths, and sop_image_annotations (00039) links original -> scene -> baked path"
  - "Re-editing a baked photo opens the ORIGINAL with its marks (getStepAnnotation), so marks never stack on marks"
requirements-completed: [FOC-02]
duration: ~1h
completed: 2026-10-05
---

# Phase 58 Plan 17: Annotation on step photos Summary

Optional wave, shipped: an admin can mark up a step photo in a full-screen dark-chrome Konva overlay; Save bakes the marks into a new JPEG that replaces the photo on the step (workers just see an image), the marks are kept for re-editing, and Esc closes without saving. Konva loads only when the tool opens.

## Commits

- `1d5c5495` feat(58-17): annotate step photos with the rebuilt Konva tool; un-drop annotation
- `c2d8dfe0` docs(58-17): matrix row, skill note and eval case for step-photo annotation

## What was built

**Ported files** (from `6eb04d2d^`, editor + tools only; no hotspot block, bake-on-publish or old annotations action):
- `src/components/focus/admin/annotate/annotation-tools.ts` -- the pure model. Changes: the two marks colours are read from `--brand-yellow` / `--accent-escalate` at shape creation (named-colour fallback, no hex), text size is a named constant.
- `src/components/focus/admin/annotate/AnnotationEditor.tsx` -- `fixed inset-0 z-50 bg-steel-900` overlay; six tools, undo/redo, delete, Pen only, resize/rotate, text box. The photo sits in its own Konva layer outside the scene JSON; the stage is scaled to fit and exported at natural size (`toBlob`, pixelRatio 1/scale). Registers with `useRegisterOverlay` so Esc closes it without saving. The photo is loaded with CORS on (plus a cache-distinct query) so the export is not tainted.

**Server** (`src/actions/focus-steps.ts`):
- `saveAnnotatedStepImage({ stepId, originalPath, bakedPath, scene })` -- `requireSopEditAccess({ stepId })`, `editableSop`, baked path rebuilt as `{session org}/{resolved sop}/steps/{step}/{uuid}.jpg|png` and checked uploaded; original must be an image row of this SOP and on this step (or the original behind a baked photo that is); zod scene schema (discriminated union, <= 200 shapes, point/number/string caps, 150 KB serialised cap, no trust fields). Writes (service role, session-org filtered): baked `sop_images` row, `sop_image_annotations` insert/update, step `image_paths` swap (the existing tick trigger clears the tick), then the earlier baked copy is deleted. Failures roll back the baked row.
- `getStepAnnotation({ stepId, storagePath })` -- read side for re-editing and for the remove prompt: returns the original's signed URL + scene when the displayed photo is a baked one, else null.
- `removeStepImage` now also removes the marks (and an editor-uploaded original) with a baked photo.

**StepCard**: per-photo "Annotate" (nested `dynamic(() => import('./annotate/AnnotationEditor'), { ssr: false })`, referenced nowhere else). The X on a photo asks `getStepAnnotation` first: a marked photo shows "Remove this photo?" / "Its marks are lost too." / "Remove photo" / "Keep it"; a plain photo still goes at once.

## Un-drop record

- `scripts/dropped-features.json`: all 9 `annotation` entries removed (215 -> 206 entries).
- `tests/phase55/deletion-sweep.spec.ts`: `'annotation'` removed from `LIVE_FEATURES` AND `FEATURES` (the sweep asserts every listed feature has entries, so both lists had to move together); a comment records the return.
- `tests/phase26/konva-worker-isolation.spec.ts`: allow-list gains `src/components/focus/admin/annotate`.
- Skill `one-screen-site.md` ("Returned:" line under Kept vs dropped; "diagram and image annotation" -> "diagram") and `SKILL.md` dropped list.
- `CAPABILITY-MATRIX.md`: "Phase 58 -- annotate a step photo (drafts only)" row.
- `tests/phase58/annotation.spec.ts` pins the un-drop (no `"annotation"` in the list, no `'annotation'` in the sweep).

## Bundle (npm run build, postbuild gate)

```
check-bundle-size: /sops/[sopId]/page = 792 KB (baseline 792 KB, Δ 0 KB, tolerance ±2 KB)
check-bundle-size: /page = 831 KB (baseline 831 KB, Δ 0 KB, tolerance ±2 KB)
check-bundle-size: ✓ Focus editor is its own lazy chunk, not charged to /sops/[sopId]/page: static/chunks/4050.25c2c2570c6de477.js
check-bundle-size: ✓ Bundle isolation OK (delta within tolerance, no forbidden marker in a gated route)
check-bundle-size: ✓ Konva isolation OK — konva + react-konva not in /sops/[sopId]/page bundle (26-05 D-03).
```

`.bundle-baseline.json` untouched. Konva lives in its own chunk (`2225.*.js`), the annotation editor in another (`6886.*.js`); neither is the worker page chunk nor the focus-editor chunk. Compiled CSS confirmed to contain `bg-steel-900`, `bg-steel-800`, `hover:bg-steel-700`, `border-steel-700`, `text-steel-900`, `bg-brand-yellow`, `hover:bg-brand-yellow`, `border-brand-yellow` (undefined-utility trap, CLAUDE.md 2026-09-28).

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0.
- Projects phase58 + phase55 + phase26 + phase15-stubs: 414 passed, 13 skipped (the skips are the live-probe fixmes). Includes annotation, edit-actions, edit-ui, deletion-sweep, konva-worker-isolation, design-tokens, no-undefined-css-tokens, capability-matrix.
- `npx playwright test --list --project=evals sop-focus` lists the new case (18 tests). The deployed eval was NOT run (self-skips without `EVAL_BASE_URL`; 58-18 runs it and must read the `58-annotate` screenshot).

## Deviations from Plan

1. **[Rule 3 - blocking] Second server action `getStepAnnotation`.** Re-editing ("marks are kept for re-editing") and the remove prompt both need to know whether a displayed photo is a baked one and what its original/scene are; nothing on the client carries that. Added as a read-only export, guarded by `requireSopEditAccess({ stepId })`. `tests/phase58/edit-actions.spec.ts` pins the exact export list, so it gained the two new names (and `getStepAnnotation` in `NOT_CONTENT`, the same class as `getFocusSop`: a read, no `editableSop`).
2. **[Rule 2 - correctness] `originalPath` relaxed from "must match the step prefix" to "must be an image row of this SOP already on this step (or the original behind a baked photo that is)".** Parser-extracted photos live outside the step prefix; requiring the prefix would have made them un-annotatable. `bakedPath` still must match the exact rebuilt prefix. `removeStepImage` only deletes an original's file when it is under the step prefix.
3. **[Rule 1 - lint] Hex and px literals in the ported tools.** `design-tokens` bans bare hex and `fontSize: 20`; colours now come from the declared tokens via `getComputedStyle`, text size is a constant. A header comment that quoted a CSS-variable literal tripped `no-undefined-css-tokens` and was reworded (CLAUDE.md 2026-09-28).
4. Un-drop also had to remove `'annotation'` from `FEATURES` in the sweep spec (plan named only `LIVE_FEATURES`).
5. `konva` / `react-konva` were still in `package.json` `dependencies` (SiteEditor uses them); nothing installed.

## Known limits / handoff to 58-18

- Not exercised in a browser here. The one thing only the deployed eval can prove: `stage.toBlob` on a CORS-loaded Supabase signed URL (not tainted). If the Save fails with "Couldn't save the marks. Try again.", check the signed URL's CORS headers first.
- The overlay is rendered inside the step `<article>`; `fixed` positioning breaks if an ancestor ever gets a transform. None does today; the `58-annotate` screenshot will show it.
- Marks on photos are baked JPEG; a transparent PNG original would flatten onto black. Step photos are compressed to JPEG on upload, so this does not arise today.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register (T-58-annotation, T-58-26, T-58-bundle all mitigated as specified).

## Self-Check: PASSED

- Files exist: AnnotationEditor.tsx, annotation-tools.ts, annotation.spec.ts, this SUMMARY.
- Commits exist: 1d5c5495, c2d8dfe0.
- STATE.md / ROADMAP.md untouched; nothing pushed.
