---
phase: 26-sop-builder-redesign
plan: 08
subsystem: admin-builder
tags: [inserter, tiered-menu, context-aware, keyboard-nav, reuse-tier, R3, P16]
requires:
  - content-ops-reducer
  - editable-document
  - block-registry
  - block-type-labels
  - block-picker
provides:
  - inserter-model
  - inserter-menu
  - reuse-tier
  - add-dividers
affects:
  - src/components/admin/builder-v2/EditableDocument.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
  - src/lib/builder/block-type-labels.ts
tech-stack:
  added: []
  patterns:
    - "Tiered inserter = a PURE model (LANE/SMART/GROUPS + row/keyboard/filter helpers in inserter-model.ts, no React) with a thin React shell (InserterMenu) — so context/keyboard/filter behaviour is unit-testable directly like content-ops (no browser)."
    - "Reuse is RE-WIRED, not rebuilt: ReuseTier wraps the existing Phase 13 BlockPicker; the dept-scope toggle maps to the picker's sopCategory soft-filter; selection routes through the existing org-scoped addBlockToSection junction path (T-26-08-01)."
    - "＋ dividers live in EditableDocument (the content-array holder) as non-sortable siblings between blocks — insert dispatches content-ops insertBlock(BLOCK_DEFAULTS) into the SAME useBuilderAutosave path (no new persistence)."
key-files:
  created:
    - src/components/admin/builder-v2/inserter/inserter-model.ts
    - src/components/admin/builder-v2/inserter/InserterMenu.tsx
    - src/components/admin/builder-v2/inserter/ReuseTier.tsx
    - tests/phase26/inserter.spec.ts
  modified:
    - src/components/admin/builder-v2/EditableDocument.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
    - src/lib/builder/block-type-labels.ts
decisions:
  - "Reuse (BlockPicker) is delegated OUT of the 320px popover as its own full-screen modal via onOpenReuse — the sketch drew Reuse as a sub-page, but the Phase 13 picker IS a full-screen modal; embedding it in the popover would rebuild it (violates 'not rebuilt'). The dept toggle floats above it (z-60)."
  - "BlockEditShell was NOT modified (listed in the plan's files_modified). ＋ dividers are section-level siblings owned by EditableDocument, which holds content[] and the insert dispatch — a per-block affordance in the shell would need to reach back up to the array holder for no benefit."
  - "AI drill row ('Describe with AI') is supported by InserterMenu but omitted at the call site (no onDescribeAI wired) — AI drafting is a later plan; rendering a dead button would be a stub (P16/no-dead-affordance)."
  - "Reuse selection creates the junction (addBlockToSection) but does NOT mutate content[] — this matches the existing Phase 13 handleLibraryAdd contract exactly (addBlockToSection never touches layout_data); layout insertion for reused blocks stays that path's concern, unchanged."
metrics:
  duration: ~35m
  completed: 2026-07-03
  tasks: 2
  files_changed: 7
---

# Phase 26 Plan 08: Tiered Context-Aware Inserter (R3) Summary

The `＋` is now a paged, context-aware command menu (R3), validated against the sketch. Opening it in a Hazards section yields a different "Fits here" list than in a Steps section (LANE keyed by section render-family); it is fully keyboard-operable (↑↓ highlight, ↵ insert-or-drill, esc close/back) with type-to-filter; insertion drops a fresh default block at the cursor and autosaves through the unchanged path; and the Reuse tier is the existing Phase 13 dept-scoped `BlockPicker`, not a rebuild.

## What was built

### Task 1 — inserter model + paged menu (`5851d5d`)
- `src/components/admin/builder-v2/inserter/inserter-model.ts` (PURE, no React): `LANE` (`SectionRenderFamily → BlockType[]` "Fits here"), `SMART` (prev block → predicted + why), `GROUPS` (full grouped catalog), ported from the sketch and retyped to the real 17-block catalog. Plus the pure navigation helpers `homeRows` / `allRows` / `filterRows` / `moveHighlight` and `reuseSopCategory` — the exact logic the React shell drives, unit-testable directly (same discipline as `content-ops`).
- `src/components/admin/builder-v2/inserter/InserterMenu.tsx` (`'use client'`): a 320px paged popover — HOME (search + smart row + "Fits here" LANE list + drill rows) and ALL (grouped catalog, ‹ back). Keyboard handler (↑↓/↵/esc), type-to-filter, humanised labels via `humanizeBlockType` (P16), outside-click close. Local state only — no route writes on the hot path (2026-05-13).
- `src/lib/builder/block-type-labels.ts`: added `StepWithPhotosBlock` / `PhotoGridBlock` / `ModelBlock` label entries (see Deviation 1).

### Task 2 — Reuse tier + ＋ dividers (`7669c79`)
- `src/components/admin/builder-v2/inserter/ReuseTier.tsx`: wraps the existing `BlockPicker` with a "This department / All departments" segmented toggle → `reuseSopCategory(scope, categoryTag)` → the picker's `sopCategory` soft-filter. Selection calls the existing `addBlockToSection` (org-scoped junction write, T-26-08-01) — not rebuilt.
- `EditableDocument.tsx`: `InsertDivider` renders a hairline ＋ (dashed "＋ insert block" pill on hover) between every block and at prepend, plus a big "＋ Add step or block" bar at section-end (and for an empty section). Opening a divider anchors `InserterMenu` at that cursor; `onInsert` dispatches `content-ops.insertBlock(content, type, afterIndex, BLOCK_DEFAULTS[type])` → autosave via the existing content effect; `onOpenReuse` opens `ReuseTier`.
- `BuilderClient.tsx`: passes `renderFamily` (`activeSection.section_kind?.render_family ?? 'custom'`) and `sopCategory` (`initialSop.category_tag`) into `EditableDocument`.

## Deviations from Plan

### Auto-fixed / adjustments (Rules 1–3)

**1. [Rule 2 — Missing critical functionality] `humanizeBlockType` returned the raw `'Block'` fallback for three catalog types**
- **Found during:** Task 1 (the `inserter.spec` "humanised labels only" test caught it).
- **Issue:** `BLOCK_TYPE_LABELS` had no entry for `StepWithPhotosBlock`, `PhotoGridBlock`, or `ModelBlock`. The inserter surfaces the FULL 17-block catalog (LANE + GROUPS), so those rows rendered the P16-violating fallback label `"Block"`. The old `AddMenu` never listed them, so the gap was latent.
- **Fix:** added the three entries (`Step + photos` / `Photo grid` / `3D model`, `kind-step`).
- **Files:** `src/lib/builder/block-type-labels.ts`. **Commit:** `5851d5d`.
- **Blast-radius check:** full phase26 suite (52 tests incl. field-panel-reachability across all 17 blocks + contract-check-target) stayed green; `npm run build` green.

### Scope decisions (deferred, tracked)
- **BlockEditShell.tsx** (in the plan's `files_modified`) was **not** modified — the ＋ dividers are section-level siblings owned by `EditableDocument` (the `content[]` holder + insert dispatcher), which is the correct home. Documented in frontmatter decisions.
- **"Describe with AI" drill row** is supported by `InserterMenu` (optional `onDescribeAI`) but not wired at the call site — AI drafting is a later plan; a dead button would be a stub.
- **Smart-next ghosts (26-10)** are NOT implemented here (explicitly out of scope). `SMART` is exported as the ghost source; this plan uses it only for the menu's single smart row.

## Frozen-contract / journeys note
No `layout_data`, junction, or `block_provenance` shape changed. No user-facing route or flow was added/removed/rerouted — the inserter is an internal edit-canvas affordance on the existing `/admin/sops/builder/[sopId]` Build stage (same as 26-04) — so `src/lib/journeys/journeys.ts` needs no update. Reuse routes through the unchanged Phase 13 `addBlockToSection` path.

## Threat surface
No new surface. Register mitigations held: **T-26-08-01** (Elevation — reuse uses the existing org-scoped `addBlockToSection`; no new write path introduced) and **T-26-08-02** (Tampering — inserts come only from `LANE`/`GROUPS`, which reference registered `BLOCK_COMPONENTS` types; `sanitizeLayoutContent` still guards unknown types at render).

## Known Stubs
None. The "Describe with AI" row is not rendered (no handler wired) rather than shown as a dead affordance.

## Verification
- `npx playwright test --project=phase26 -g "inserter|reuse"` → **8 passed** (context varies by family, keyboard nav + clamp, type-to-filter, insert-adds-block with fresh defaults, humanised labels, dept-scoped reuse scope mapping, reuse-row gating).
- `npx playwright test --project=phase26` (full suite) → **52 passed** (no regression from the label-map addition).
- `npx tsc --noEmit` → clean.
- `npm run build` → green; postbuild bundle gate **/sops/[sopId] = 1054 KB, Δ 0 KB, isolation OK** — the inserter + BlockPicker are admin-only and absent from the worker path.

## Self-Check: PASSED
- FOUND: src/components/admin/builder-v2/inserter/inserter-model.ts
- FOUND: src/components/admin/builder-v2/inserter/InserterMenu.tsx
- FOUND: src/components/admin/builder-v2/inserter/ReuseTier.tsx
- FOUND: tests/phase26/inserter.spec.ts
- FOUND: src/components/admin/builder-v2/EditableDocument.tsx (dividers + ReuseTier wired)
- FOUND: src/lib/builder/block-type-labels.ts (3 catalog labels added)
- FOUND commit: 5851d5d (Task 1)
- FOUND commit: 7669c79 (Task 2)
