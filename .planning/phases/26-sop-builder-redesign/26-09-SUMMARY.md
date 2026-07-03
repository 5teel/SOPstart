---
phase: 26-sop-builder-redesign
plan: 09
subsystem: ui
tags: [visual-block, media-grid, block-contract, introspection, zod, konva-isolation]

# Dependency graph
requires:
  - phase: 26-03
    provides: "Puck-free block-registry (BLOCK_COMPONENTS/BLOCK_DEFAULTS) + 3-place contract-check"
  - phase: 26-05
    provides: "visual/ dir + AnnotationEditorLoader (code-split Konva), konva-worker-isolation guard"
  - phase: 26-06
    provides: "FIELD_MAP reachability registry + Pattern A/B/D inline editors + one Zod-validated commit path"
  - phase: 26-07
    provides: "Pattern C FieldPanel; P14 parity gate (0 unreachable). Pattern E declared, deferred here"
provides:
  - "The 18th block type — unified Visual block (R5): one block, mixed medium-tagged media (visual:photo|diagram|video)"
  - "Pattern E media grid (MediaGrid) + medium sub-picker — completes FIELD_MAP; P14 stays 0-unreachable across 18 blocks"
  - "Legacy PhotoBlock/PhotoGridBlock/StepWithPhotosBlock edit THROUGH the Visual UI with layout_data kind + provenance frozen (A3)"
  - "Medium tags on /api/schema via BLOCK_REGISTRY.VisualBlock (R7/D-02 agent-contract hook)"
affects: [26-10 ghosts, 26-11 Konva annotation editor, 26.5 agent layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure media-adapter module (schema + legacy↔visual adapters) so phase26 (no @/ alias) tests it in-process"
    - "New bespoke block exempt from puck-config parity (Puck is being removed); contract-check remains the gate"
    - "Legacy blocks render THROUGH a shared media control by adapting field values, never rewriting layout_data kind"

key-files:
  created:
    - src/components/admin/builder-v2/visual/media-adapter.ts
    - src/components/admin/builder-v2/visual/VisualBlock.tsx
    - src/components/admin/builder-v2/visual/MediaGrid.tsx
    - tests/phase26/visual-block.spec.ts
  modified:
    - src/lib/validators/blocks.ts
    - src/actions/introspection.ts
    - src/lib/builder/block-registry.tsx
    - src/lib/builder/block-type-labels.ts
    - src/lib/builder/diff-block-content.ts
    - src/components/admin/builder-v2/fields/field-map.ts
    - src/components/admin/builder-v2/fields/field-commit.ts
    - src/components/admin/builder-v2/inserter/inserter-model.ts
    - src/components/admin/builder-v2/BlockEditShell.tsx
    - scripts/field-panel-reachability-check.tsx
    - tests/phase26/{block-registry,contract-check-target,render-parity,field-panel-reachability,field-map}.spec.ts

key-decisions:
  - "VisualBlockPropsSchema lives in the PURE media-adapter.ts (not the .tsx component) so introspection, field-commit, and the phase26 spec all import it without pulling a React barrel"
  - "VisualBlock is exempt from the field-map puck-parity check — it never had a Puck config; contract-check (18/18/18) is the real registration gate"
  - "PhotoBlock stays single-src: MediaGrid offers the medium sub-picker only for the Visual block; photo-only blocks add photo items"

patterns-established:
  - "Adding the Nth block type = 3-place contract + label + FIELD_MAP + SCHEMA_BY_TYPE + diff-block-content case + bump every count-coupled spec/harness"
  - "Media editing is unified behind MediaGrid via toVisualItems/fromVisualItems adapters keyed by the block's NATIVE field (items/src/photos)"

requirements-completed: [R5, R7]

# Metrics
duration: 40min
completed: 2026-07-03
---

# Phase 26 Plan 09: Unified Visual Block Summary

**Added the 18th block type — a unified Visual block holding mixed, medium-tagged media (visual:photo|diagram|video) — completing Pattern E's media grid and routing every legacy photo block through the same Visual UI without any layout_data drift.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-03
- **Completed:** 2026-07-03
- **Tasks:** 2/2
- **Files modified/created:** 20

## Accomplishments

### Task 1 — VisualBlock 3-place contract + label + medium tags (R5/R7)
- `VisualBlockContentSchema` (`kind: 'visual'`, medium-tagged `items[]{medium,src,alt,caption,annotationId?}`) added to the `BlockContentSchema` discriminated union; `VisualItemContentSchema` mirrors the pure `media-adapter` shape.
- `media-adapter.ts` (pure): `VisualBlockPropsSchema`, `VISUAL_MEDIUMS`, `mediumTag()`, `MEDIUM_ACCENT`, and the `toVisualItems`/`fromVisualItems` legacy adapters.
- Registered across **all three contract places** + the label map: `BLOCK_COMPONENTS`/`BLOCK_DEFAULTS` (Konva-free `VisualBlock` display), `BLOCK_REGISTRY` (with a `visual:photo|diagram|video` example — the R7/D-02 hook), `BLOCK_TYPE_LABELS`/`SLUG_TO_KEY`.
- Wired the exhaustive maps `tsc` requires: `FIELD_MAP` (Pattern E), `SCHEMA_BY_TYPE`, `diff-block-content` `'visual'` case; added Visual to the inserter's "Data capture" group.
- `scripts/contract-check.ts` → **18/18/18**; bumped every count-coupled phase26 spec/harness 17→18.

### Task 2 — MediaGrid (Pattern E) + legacy-through-Visual (A3/P4)
- `MediaGrid.tsx`: 3-up media grid, per-item `visual:{medium}` tag pill (photo cyan / diagram blue / video pink), inline caption, remove, and a `＋ add media` medium sub-picker (Photo/Diagram/Video) for the Visual block. Konva-free — annotation editing stays code-split to 26-11.
- Replaced the `media — soon` stub in `BlockEditShell` Pattern E with `MediaGrid`; legacy `PhotoBlock`/`PhotoGridBlock`/`StepWithPhotosBlock` now edit **through** it by adapting their native field value (`src`/`items`/`photos`) — their stored `layout_data` `kind` is never rewritten (A3), and `block_provenance`/`junctionId` survive the lossless commit path (P4/R7).
- `visual-block.spec.ts` (behavioural, in-process): medium-tag round-trip, invalid-medium rejection, `/api/schema` medium-enum surface, 3-place source-contract, and legacy-photo-through-Visual parity with no kind drift.

## Verification

- `npx tsx scripts/contract-check.ts` → three-place contract intact, **18/18/18**.
- `npx tsc --noEmit` → clean.
- `npx playwright test --project=phase26` → **60 passed** (visual-block, convert-golden-path byte-equivalence, render-parity `18 block types`, reachability `0 unreachable across 18 blocks`, contract-check-target, field-map).
- `npm run build` → green. Postbuild bundle gate: `/sops/[sopId]` = 1054 KB, **Δ 0 KB**; **Konva isolation OK** (konva/react-konva absent from the worker bundle) — VisualBlock display added zero worker cost.

## Deviations from Plan

### Auto-added (enables correct completion)

**1. [Rule 3 - Blocking] Extra pure module `visual/media-adapter.ts` (beyond the plan's file list)**
- **Found during:** Task 1. `VisualBlockPropsSchema` is needed by `introspection.ts`, `field-commit.ts` (SCHEMA_BY_TYPE), and the phase26 spec, but the phase26 Playwright project has no `@/` alias and cannot load React barrels. Defining the schema + adapters in a pure (zod-only) module — exactly the established `field-map.ts`/`content-ops.ts` pattern — is the only way to expose them to all three consumers and keep the logic in-process testable.
- **Files:** `src/components/admin/builder-v2/visual/media-adapter.ts` (created).
- **Commit:** d06fa6b

**2. [Rule 3 - Blocking] `diff-block-content.ts` exhaustiveness case**
- **Issue:** Its `switch (content.kind)` has a `never` exhaustiveness guard; the new `'visual'` kind broke `tsc` until a case was added.
- **Fix:** Added a `case 'visual'` emitting a `medium: src — caption` item summary.
- **Commit:** d06fa6b

**3. [Rule 3 - Blocking] field-map.spec puck-parity exemption**
- **Issue:** `field-map.spec` asserted `FIELD_MAP` keys === puck-config component keys. VisualBlock is a bespoke block with **no** puck-config entry (Puck is being removed), so the parity + per-block loop would fail/throw.
- **Fix:** Exempted VisualBlock from the puck-parity assertion (it is not a Puck block); count bumped to 18. Puck-configured blocks are still fully parity-checked (no legacy field dropped).
- **Commit:** d06fa6b

Count-coupled 17→18 edits across `block-registry.spec`, `contract-check-target.spec`, `render-parity.spec`, `field-panel-reachability.spec` + `-check.tsx`, and `field-map.spec` are expected mechanical consequences of adding the 18th block type, not behavioural deviations.

## Known Stubs

- **New-media upload/annotate wiring is not built here.** `＋ add media` inserts a medium-tagged item with `src: null` (a placeholder slot); actual file upload and the diagram Konva editor are out of this plan's scope (annotation editing is explicitly 26-11). The Visual contract, medium tagging, and legacy-through-Visual editing are complete and tested. Intentional — the stub is a `null`-src slot that validates and carries its medium tag; it does not block the plan's goal (unified, tagged, convert-safe Visual media).

## Threat Flags

None — no new network endpoint, auth path, or trust-boundary schema beyond the plan's `<threat_model>`. `/api/schema` advertises block/medium tags only (T-26-09-02 accept); invalid media is rejected by `VisualBlockPropsSchema` (T-26-09-01 mitigate); legacy kinds render through Visual with no layout_data rewrite (T-26-09-03 mitigate — convert-golden byte-equivalence spec green).

## Self-Check: PASSED

All created files exist on disk; both per-task commits (d06fa6b, 45fd000) present in git history.
