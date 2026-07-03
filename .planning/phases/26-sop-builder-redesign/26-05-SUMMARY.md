---
phase: 26-sop-builder-redesign
plan: 05
subsystem: admin-builder / annotation-foundation
status: complete
tags: [konva, annotation, migration, rls, bundle-isolation, next16]
requires:
  - "00038 append-only + org-scoped RLS pattern (current_organisation_id helper)"
  - "phase26 Playwright project (registered in 26-02)"
provides:
  - "'canvas' externalization + dynamic ssr:false AnnotationEditor (Konva proven in Next 16)"
  - "sop_image_annotations scene store (migration APPLIED to live DB — table + 1 org-scoped SELECT policy + 10 cols, verified via Management API to_regclass)"
  - "Konva-worker-isolation gate (bundle check + no-static-import lint)"
affects:
  - "26-13 (real VisualBlock + saveAnnotation server action build on this foundation)"
tech-stack:
  added: ["konva@10.3.0 (already installed)", "react-konva@19.2.5 (already installed)", "canvas (externalized)"]
  patterns: ["dynamic({ssr:false}) admin-only loader", "append-only org-scoped RLS (00038 analog)", "negative bundle-marker gate (pdfjs/mammoth analog)"]
key-files:
  created:
    - "src/components/admin/builder-v2/visual/AnnotationEditor.tsx"
    - "src/components/admin/builder-v2/visual/AnnotationEditorLoader.tsx"
    - "src/app/(protected)/admin/builder-v2-konva-spike/page.tsx (throwaway spike — delete in 26-13)"
    - "supabase/migrations/00039_sop_image_annotations.sql"
    - "tests/phase26/konva-worker-isolation.spec.ts"
  modified:
    - "next.config.ts"
    - "src/types/database.types.ts"
    - "scripts/check-bundle-size.ts"
decisions:
  - "Konva-in-Next-16 spike PASSED — no fallback (Excalidraw/custom SVG) needed"
  - "Added a throwaway admin spike route to force react-konva into the build graph (a component no route imports is never bundled, so the Pitfall-5 de-risk would be a no-op without it)"
metrics:
  duration: "~8 min (incl. push finalization)"
  completed: "2026-07-03 (push applied + verified; plan complete)"
requirements: [R5, R8]
---

# Phase 26 Plan 05: Konva Annotation Foundation Summary

Laid the Konva foundation for the absorbed Phase 17 diagram annotation and de-risked the one MEDIUM-confidence assumption (does react-konva render in Next 16) with a day-1 throwaway spike — **it passed**. Wrote the `sop_image_annotations` scene store (append-only, org-scoped, 42P17-safe) and fenced Konva out of the worker bundle with a bundle gate + no-static-import lint. **The [BLOCKING] `supabase db push` gate is CLEARED** — migration 00039 is applied to the live DB and verified via the Management API (`to_regclass('public.sop_image_annotations')` returns the table; 1 org-scoped SELECT policy; 10 columns). Plan complete.

## What Was Built

### Task 1 — Konva-in-Next-16 spike (DONE, PASSED) — commit `1912e9a`
- `next.config.ts`: appended `'canvas'` to `serverExternalPackages` (Pitfall 5 — stops `next build --webpack` from trying to bundle Konva's native `canvas` fallback).
- `AnnotationEditor.tsx`: `'use client'` minimal react-konva `<Stage><Layer><Rect/></Layer></Stage>`, sized to passed natural width/height, with `stage.destroy()` in effect cleanup (StrictMode remount leak guard).
- `AnnotationEditorLoader.tsx`: `dynamic(() => import('./AnnotationEditor'), { ssr: false, loading })` — the single sanctioned Konva reference site.
- Throwaway `/admin/builder-v2-konva-spike` route renders the loader so react-konva actually enters the build graph (a tsc typecheck alone does NOT exercise the `canvas` webpack resolution).
- **Spike result: PASS.** `next build` green; react-konva compiled into its own client chunk (`.next/static/chunks/2225.*.js`); Konva absent from `/sops/[sopId]/page.js`; worker First Load JS Δ 0 KB. No Excalidraw/custom-SVG fallback needed.

### Task 2 — Migration 00039 (DONE — file written & committed) — commit `0297992`
- `00039_sop_image_annotations.sql`: table with `scene jsonb`, `natural_width/height int`, `baked_storage_path text`, `baked_at timestamptz`, `organisation_id` + `sop_image_id` FKs, `created_at/updated_at`, indexes on org + image.
- RLS enabled; **exactly one** `for select to authenticated using (organisation_id = public.current_organisation_id())` policy. **No** authenticated INSERT/UPDATE/DELETE (writes via `createAdminClient()` self-enforcing org-scope in 26-13). **No** cross-table `public.sops` reference in the policy → 42P17-safe (CLAUDE.md 2026-05-13). Copies the 00038 pattern exactly.
- `database.types.ts`: manual `sop_image_annotations` Row/Insert/Update + Relationships (type regen unavailable, consistent with prior phases). `npx tsc --noEmit` green.

### Task 3 — Konva-worker-isolation gate (NON-GATED PART DONE) — commit `cadfa18`
- `check-bundle-size.ts`: new negative-marker gate asserting `konva`/`react-konva` are absent from the `/sops/[sopId]` worker chunk bytes (mirrors the existing pdfjs/mammoth gates). Green.
- `konva-worker-isolation.spec.ts`: 3 static-import leak guards (konva, react-konva, direct AnnotationEditor) — only `builder-v2/visual/` may statically import; `dynamic()` always allowed. Registered under the `phase26` project; all 3 green.

## BLOCKING Gate — CLEARED (push applied + verified)

**`supabase db push` for `00039_sop_image_annotations.sql` was run by the orchestrator and verified via the Management API (bypassing PostgREST cache):**
- `to_regclass('public.sop_image_annotations')` → returns the table (exists).
- **1 RLS policy** — org-scoped SELECT (`organisation_id = public.current_organisation_id()`); append-only, so NO write policies (as designed).
- **10 columns** present.

RLS design as shipped:
- Append-only: no authenticated write policy — service-role writes only (26-13), self-enforcing `organisation_id`.
- Org-scoped SELECT via `current_organisation_id()` only — no cross-table `public.sops` reference (42P17-safe).
- FKs cascade-delete from `organisations` and `sop_images`.

**Post-push verification (CLAUDE.md 2026-06-15):** confirmed via `to_regclass` (bypasses the PostgREST schema cache) — no stale-cache false negative.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added a throwaway admin spike route**
- **Found during:** Task 1
- **Issue:** Task 1's file list (next.config.ts + AnnotationEditor + AnnotationEditorLoader) has no route importing the loader. A component no route imports is never webpack-bundled, so `next build` would NOT exercise the `canvas` module resolution — the entire Pitfall-5 de-risk would be a silent no-op.
- **Fix:** Added `src/app/(protected)/admin/builder-v2-konva-spike/page.tsx` (admin-only, marked throwaway) that renders `AnnotationEditorLoader`, forcing react-konva into the build graph. This is what actually proved the spike. Admin-only → Konva stays out of the worker tier.
- **Files:** `src/app/(protected)/admin/builder-v2-konva-spike/page.tsx`
- **Commit:** `1912e9a`
- **Cleanup owner:** delete in 26-13 when the real VisualBlock wires the loader in. `journeys.ts` intentionally NOT updated — this is an internal dev-spike route, not a user-facing flow.

## Known Stubs

- `AnnotationEditor.tsx` is a spike shell (a single static `<Rect>`) — draw primitives, transformer, undo, and bake-on-publish are Plan 26-13, by design. Documented, not a blocker for this foundation plan.

## Commits

- `1912e9a` — feat(26-05): Konva-in-Next-16 spike — canvas externalized + dynamic ssr:false Stage
- `0297992` — feat(26-05): migration 00039 sop_image_annotations — append-only, org-scoped, 42P17-safe
- `cadfa18` — feat(26-05): Konva-worker-isolation gate — bundle check + no-static-import lint (D-03/R8)

_(db-push applied by the orchestrator; this SUMMARY + STATE/ROADMAP finalization is the closing docs commit.)_

## Final Verification (continuation)

- `npx tsc --noEmit` → clean (exit 0).
- `konva-worker-isolation.spec.ts` → 3/3 passed (no static konva/react-konva/AnnotationEditor import outside `builder-v2/visual/`).
- `check-bundle-size.ts` → Konva + react-konva ABSENT from `/sops/[sopId]/page` worker bundle; First Load JS 1054 KB, Δ 0 KB.
- Live DB → `sop_image_annotations` present (10 cols, 1 org-scoped SELECT policy), verified via Management API `to_regclass`.

## Self-Check: PASSED

- All 5 created files present on disk.
- All 3 task commits (`1912e9a`, `0297992`, `cadfa18`) exist in git.
- Plan advanced in STATE (26-05 complete).
