---
phase: 26-sop-builder-redesign
plan: 04
subsystem: admin-builder
tags: [bespoke-editor, edit-canvas, autosave-rewire, dnd-kit, content-reducer, R2, R7, P11, D-02]
requires:
  - block-registry
  - sanitize-layout
  - puck-free-layout-renderer
provides:
  - content-ops-reducer
  - editable-document
  - block-edit-shell
  - inline-text
  - autosave-rewire
  - dnd-kit-reorder
affects:
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
tech-stack:
  added:
    - "@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers, @dnd-kit/utilities (admin-only, builder-v2)"
  patterns:
    - "Bespoke edit canvas = controlled content[] reducer (content-ops) feeding the UNCHANGED useBuilderAutosave — the hook reads only {content,root}, so replacing <Puck onChange> is a caller swap, not a persistence rewrite (P11)"
    - "Edit == worker render: BlockEditShell renders the SAME BLOCK_COMPONENTS entry (no forked renderer) and layers hover tools + click-to-edit InlineText on top"
    - "Lossless props round-trip: every reducer op spread-merges props ({...prev,...changed}) so junctionId/block_provenance/unknown agent keys survive (R7/D-02 hook)"
    - "Behavioural parity via the tsx-subprocess harness (react-dom/server) the 26-03 render-parity spec established — Playwright's JSX transform can't render real react-dom"
key-files:
  created:
    - src/lib/builder/content-ops.ts
    - src/components/admin/builder-v2/EditableDocument.tsx
    - src/components/admin/builder-v2/BlockEditShell.tsx
    - src/components/admin/builder-v2/InlineText.tsx
    - scripts/autosave-rewire-check.tsx
    - tests/phase26/props-roundtrip.spec.ts
    - tests/phase26/autosave-rewire.spec.ts
    - tests/phase26/reorder.spec.ts
  modified:
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
    - scripts/render-parity-check.tsx
decisions:
  - "content-ops.ts lives in src/lib/builder/ (pure, no 'use server') — a sync export from an action module breaks next build (CLAUDE.md 2026-06-27)."
  - "BlockEditShell wires ONE primary text field per block type (PRIMARY_TEXT_FIELD map) for click-to-edit this wave; full 16 structured-field panels (array/config) are P14/W2. Non-text blocks render read-only until then."
  - "BuilderClient's Puck-coupled wiring (createPuckOverrides, PuckApiTap/useGetPuck, junction/selection maps, AddMenu, BlockPicker, StructuredFieldPopover) removed with the <Puck> swap — selection-sync (P12), AI-flag overlays (P13), verify UI (P8) and the tiered inserter (R3) are RE-WIRED in later waves per the plan. Build→Review→Publish stage flow (BuilderStageShell/BuilderWithSourceViewer) untouched."
  - "autosave-rewire is behavioural via a tsx subprocess: edit → in-memory draftLayouts row (payload byte-identical to useBuilderAutosave) → reload renders the edited text through the worker LayoutRenderer. IndexedDB itself is browser infra (out of scope); fake-indexeddb was NOT added (avoids an unplanned dep)."
  - "Two *-check.tsx harnesses share the global script scope under tsc → added `export {}` to both to isolate module scope (render-parity-check.tsx touched only for this)."
metrics:
  duration: ~45m
  completed: 2026-07-03
  tasks: 3
  files_changed: 10
---

# Phase 26 Plan 04: Bespoke EDIT Canvas + Autosave Re-wire Summary

Built the bespoke EDIT canvas over the FROZEN `layout_data` (D-01, R2): the admin now edits the exact worker block components in place, all edits flow through a pure controlled `content[]` reducer, and content changes feed the UNCHANGED `useBuilderAutosave` → Dexie `draftLayouts` → Supabase path (P11 RE-WIRE, no new persistence path). `<Puck onChange>` is gone from the Build stage; blocks reorder via dnd-kit vertical sortable (keyboard + pointer); every reducer op round-trips ALL props keys losslessly (R7/D-02 hook).

## What was built

### Task 1 — content-ops reducer + lossless props round-trip (`872fcfb`)
- `src/lib/builder/content-ops.ts` (pure, non-`'use server'`): `insertBlock`, `updateBlockProps`, `deleteBlock`, `duplicateBlock`, `reorderBlocks`, `stampProvenance`. `updateBlockProps` spread-merges over previous props (`{...prev,...changed}`); `duplicateBlock` deep-copies via `structuredClone` + fresh `crypto.randomUUID()`; `reorderBlocks` keeps the SAME item objects (lossless).
- `tests/phase26/props-roundtrip.spec.ts` (behavioural, direct import): after `updateBlockProps` only the edited field differs — `junctionId`, `block_provenance`, and a synthetic `__agent` key survive byte-identical; `duplicateBlock` deep-copies unknown keys with a new id; `reorderBlocks` preserves every block's metadata (Pitfall 7 / R7).

### Task 2 — EditableDocument + BlockEditShell + InlineText; autosave re-wire (`db9d1e8`)
- `EditableDocument.tsx` (`'use client'`): controlled `content[]` seeded from `layout_data` (parse + `sanitizeLayoutContent`), re-seeds on section switch, and a single `useEffect([content, root])` calls the existing `useBuilderAutosave({content, root})` (skips the initial seed). Selection/active state is local `useState` — no route/search-param writes on the hot edit path (2026-05-13).
- `BlockEditShell.tsx`: renders the SAME `BLOCK_COMPONENTS[type]` (R2, no forked renderer) with hover grip/duplicate/delete tools, `data-block-id` (for later P12 reverse-binding), and click-to-edit for the block's primary text field.
- `InlineText.tsx`: uncontrolled `contentEditable` — seeds `textContent` once, commits `textContent` on blur (never innerHTML → XSS T-26-04-01; never re-writes from state while focused → Pitfall 4 caret/IME). DOM reads only inside the mount effect (SSR-safe, #418).
- `BuilderClient.tsx`: swapped `<Puck onChange>` for `<EditableDocument>` and removed the Puck-coupled machinery; kept header/save-pill/toasts, the section rail, and the parent stage flow intact.
- `scripts/autosave-rewire-check.tsx` + `tests/phase26/autosave-rewire.spec.ts` (behavioural, tsx subprocess): edit a block's text → a `draftLayouts` row is written (`dirty`, payload byte-identical to `useBuilderAutosave`) → RELOAD from the persisted row renders the edited text through the worker `LayoutRenderer`; `junctionId` + `block_provenance` preserved. NOT a grep for `useBuilderAutosave`.

### Task 3 — dnd-kit vertical sortable reorder (`0657c26`)
- `EditableDocument` wraps blocks in `<DndContext modifiers={[restrictToVerticalAxis]}>` + `<SortableContext strategy={verticalListSortingStrategy}>` with `PointerSensor` + `KeyboardSensor` (keyboard reorder free from dnd-kit). `SortableBlock` passes `useSortable` ref/handle/transform to the dnd-agnostic `BlockEditShell` grip; `onDragEnd` → `reorderBlocks` (lossless) → autosave.
- `tests/phase26/reorder.spec.ts` (behavioural + guards): drag-up reorders `content[]` and preserves all props; `restrictToVerticalAxis`/`verticalListSortingStrategy` applied (no free-drag); `@dnd-kit` imported ONLY under `src/components/admin/builder-v2/` (admin-only, T-26-04-03).

## Deviations from Plan

### Auto-fixed / adjustments (Rules 1–3)

**1. [Rule 3 — Blocking] tsc global-scope collision between `*-check.tsx` harnesses**
- **Found during:** Task 2. Adding `scripts/autosave-rewire-check.tsx` (same top-level `require`/`const` shape as `render-parity-check.tsx`) made both files global scripts sharing the global scope → `TS2451 Cannot redeclare block-scoped variable`.
- **Fix:** added `export {}` to both harnesses to isolate module scope.
- **Files:** `scripts/autosave-rewire-check.tsx`, `scripts/render-parity-check.tsx`. **Commit:** `db9d1e8`.

**2. [Rule 3 — Blocking] `Block` typed as always-defined (TS2774)**
- **Found during:** Task 2. `BLOCK_COMPONENTS[type as BlockType]` is typed as never-undefined, so `Block ? … : …` was flagged.
- **Fix:** cast `Block` to `… | undefined` (item.type may be an unregistered type). **File:** `BlockEditShell.tsx`. **Commit:** `db9d1e8`.

### Scope decisions (deferred per plan — later waves)
The plan authorised mounting the canvas "minimally" with selection-sync/overlays/verify-UI/inserter RE-WIRED in later waves. Swapping out `<Puck>` therefore removed its dependents from **BuilderClient this wave**:
- **AddMenu / BlockPicker** (block insertion + library reuse) — inserter is R3, a named later wave. The edit canvas edits/reorders/duplicates/deletes existing blocks; there is no block-insertion affordance on the Build canvas until R3 lands.
- **StructuredFieldPopover** (array/config field editing) — P14 field panels (W2). Only the primary text field is editable inline this wave (`PRIMARY_TEXT_FIELD` map); non-text blocks (Photo/PhotoGrid/StepWithPhotos/Model) render read-only.
- **Selection-sync (P12), AI-flag overlays (P13), per-block verify UI (P8), orphan-image chip (P9)** — deferred to the W4 re-wire wave; `data-block-id` is already stamped for the P12 reverse binding.

These are intentional phase-arc reductions (Puck removal spans the phase; the dep is removed entirely in 26-14), not stubs — the plan's own success criteria (edit == worker render, autosave parity, reorder, lossless props) are fully met.

## Frozen-contract / journeys note
No `layout_data`, junction, or `block_provenance` shape changed (R6 golden-path spec still green in the phase26 suite). No user-facing route or flow was added/removed/rerouted — this is an internal render/edit-engine swap on the existing `/admin/sops/builder/[sopId]` Build stage — so `src/lib/journeys/journeys.ts` needs no update (same as 26-03). `@puckeditor/core`/`puck-config.tsx` remain installed (later waves + 26-14 own removal).

## Known Limitations (deferred, tracked)
- Block **insertion** and **structured (array/config) field editing** are not available on the Build canvas until R3 (inserter) and W2 (P14 field panels). Documented above; not blocking this plan's goal.

## Threat Flags
None new. Register mitigations landed: T-26-04-01 (InlineText commits `textContent`, never innerHTML), T-26-04-02 (reducer spread-merge + props-roundtrip parity test), T-26-04-03 (`@dnd-kit`/`builder-v2` admin-only; reorder.spec guard + bundle gate green, worker 1053 KB).

## Verification
- `npx playwright test --project=phase26` → **19 passed** (props-roundtrip 5, autosave-rewire 1, reorder 3, + prior 26-02/26-03 specs 10).
- `npx tsx scripts/autosave-rewire-check.tsx` → AUTOSAVE-REWIRE OK.
- `npx tsx scripts/render-parity-check.tsx` → RENDER-PARITY OK (17 types, still green post module-isolation).
- `npx tsc --noEmit` → clean.
- `npm run build` → green (prebuild contract-check + `next build` + postbuild bundle gate **1053 KB, Δ -1, isolation OK** — dnd-kit/builder-v2 absent from the worker path).
- `grep -n "router.push" src/components/admin/builder-v2/` → nothing.

## Self-Check: PASSED
- FOUND: src/lib/builder/content-ops.ts
- FOUND: src/components/admin/builder-v2/EditableDocument.tsx
- FOUND: src/components/admin/builder-v2/BlockEditShell.tsx
- FOUND: src/components/admin/builder-v2/InlineText.tsx
- FOUND: scripts/autosave-rewire-check.tsx
- FOUND: tests/phase26/props-roundtrip.spec.ts
- FOUND: tests/phase26/autosave-rewire.spec.ts
- FOUND: tests/phase26/reorder.spec.ts
- FOUND: src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx (Puck-free)
- FOUND commit: 872fcfb (Task 1)
- FOUND commit: db9d1e8 (Task 2)
- FOUND commit: 0657c26 (Task 3)
