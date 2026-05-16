---
title: Phase 20 CONV-03 — DOCX → layout_data build plan
date: 2026-05-16
status: locked, ready to build
author: Simon + Claude (interactive design session)
gates: Phase 20 Plan 20-02 / 20-03
---

# Phase 20 CONV-03 — DOCX → layout_data build plan

Captured at end of design session. Resume next conversation by reading this
file first; everything below is committed to, no re-litigation.

## What we're solving

After commit `7b9151e` the structural DOCX extractor anchors images to the
correct procedural-table row. But the OUTPUT pipeline has no vocabulary for
"image alongside step" — `SectionEditor.tsx` renders sop_images in
`flex-col gap-2` (stacked, full-width, always). The AI's parsed SOP schema
has no layout field. So even with perfect alignment, images flatten into
long consecutive lists below each step.

The right fix is Path B from the design conversation: emit Puck `layout_data`
from the parser using new `RowLayout` / `PhotoGrid` blocks. Admin reviews in
the Phase 12 builder. This is exactly Phase 20 SPEC CONV-03.

## Locked decisions (Simon, 2026-05-16)

1. **Path B** — write `layout_data` from the parser; retire the legacy
   `/admin/sops/[sopId]/review` surface for new DOCX parses; route admin
   review to `/admin/sops/builder/[sopId]`.
2. **Code owns layout (v1) + AI override (v2)** — converter is deterministic
   for v1: maps `step.image_indexes.length` → block shape (`single` /
   `RowLayout(StepBlock, PhotoBlock)` / `RowLayout(StepBlock, PhotoGrid)`).
   AI schema gains an optional `layout_data_override` field for nuanced
   layouts later — opt-in, off by default.
3. **Stop writing legacy rows for new DOCX parses** — `layout_data` is the
   source of truth. `sop_images` keeps storage_path links (for Phase 20
   provenance + image serving). DO NOT bulk-migrate pre-Phase-20 SOPs.

## Critical pre-build research result (this session)

The Phase 12 builder shipped `LayoutRenderer.tsx` AND wired it into
`SectionContent.tsx` (worker-facing SOP detail rendering). Key file:
`src/components/sop/SectionContent.tsx` line 132-135 — already
checks `section.layout_data != null && section.layout_version != null` and
falls through to `<LayoutRenderer layoutData={section.layout_data} />`.

**Implication**: worker-side `layout_data` rendering ALREADY EXISTS for
blank/AI-source SOPs at the section level. Walkthrough + photo capture +
completion records all work for those SOPs today. So stopping legacy
sop_steps writes for parsed-DOCX SOPs **will not break worker rendering** —
we just need the parsed SOP's section rows to have layout_data populated
and step rows can be empty.

What I don't know yet (verify on resume):
- Does the walkthrough render `layout_data`-only sections correctly today?
  Search `useWalkthrough`, `MobileWalkthrough.tsx`, `WalkthroughList.tsx`.
- Is completion-photo capture keyed on `sop_steps.id` (will break) or on a
  Puck componentId / block junctionId (will work)?
- Sub-trade RLS (Phase 15) — does it gate on sop_steps existence?

## Build punch-list (next session)

### 1. New Puck blocks (~150 LOC across 4 files)
- `src/components/sop/blocks/RowLayoutBlock.tsx` — 2 DropZones (left + right), split-ratio prop (`50-50` / `60-40` / `70-30`), responsive stacks below `sm:`
- `src/components/sop/blocks/PhotoGridBlock.tsx` — image array, columns prop (2/3/4), gap, optional captions
- Register both in `src/lib/builder/puck-config.tsx` with full `fields` + `defaultProps` + `SafeRender` wrapper following existing patterns
- Zod props schemas in the block files (existing pattern)

### 2. Converter (~250 LOC, 1 file + tests)
- `src/lib/parsers/parsed-sop-to-layout-data.ts` — takes `ParsedSop` + `uploadedImages: UploadedImage[]` → returns Puck `layout_data` JSON tree
- Mapping rules:
  - section (steps kind) → `HeadingBlock` + (per step) layout shape:
    - `image_indexes.length === 0` → `StepBlock` only
    - `image_indexes.length === 1` → `RowLayout(StepBlock, PhotoBlock)`
    - `image_indexes.length >= 2` → `RowLayout(StepBlock, PhotoGrid)`
  - section (hazards kind) → `HeadingBlock` + per-hazard `HazardCardBlock`
  - section (ppe kind) → `HeadingBlock` + `PPECardBlock`
  - section (content kind) → `HeadingBlock` + `TextBlock`
  - Orphan images (any not referenced by a step) → bottom of first section as `PhotoGrid`
- Unit tests with `EN-FOR-03-042` fixture: assert generated tree shape

### 3. Parse route changes
- DOCX path in `src/app/api/sops/parse/route.ts`:
  - Generate `layout_data` after `parseSopWithGPT` returns
  - Write `sops.layout_data = layoutData`, `sops.layout_version = 1`, `sops.status = 'draft'`
  - **STOP writing sop_steps** for DOCX (but keep section row inserts so section metadata + `sop_images` foreign keys work)
  - Image inserts keep `section_id` set, but `step_id` is null (since no steps); workers find images via the Puck layout's image refs, not via step_id
- Non-DOCX paths unchanged (legacy until their own structural extractors land)

### 4. Review-surface redirect
- `src/app/(protected)/admin/sops/[sopId]/review/page.tsx`:
  - If `sop.source_file_type === 'docx' && sop.layout_data != null` → `redirect(\`/admin/sops/builder/${sopId}\`)`
  - Banner inside builder: "Parsed from EN-FOR-03-042.docx — review and edit, then publish."
- `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx`:
  - Add parse-status banner if SOP came from a parse job
  - Surface flagged images / orphans clearly

### 5. AI schema (optional override) — defer to v2
- Add `step.layout_data_override: PuckTree | null` to `SopStepSchema`
- For v1 leave null in all output; converter ignores
- v2: prompt AI to populate when it wants asymmetric layout

### 6. Tests
- New unit test file `src/lib/parsers/__tests__/parsed-sop-to-layout-data.test.ts`:
  - 1 image step → RowLayout(StepBlock, PhotoBlock) shape assertion
  - 3 image step → RowLayout(StepBlock, PhotoGrid(cols=3)) assertion
  - No-image step → StepBlock-only assertion
  - Orphans → PhotoGrid at first section bottom
- Update `extract-docx-structural.test.ts` if any contract drift
- Integration test (Playwright): upload EN-FOR-03-042, assert builder loads
  with the expected number of RowLayout nodes

## What lands when (single PR)

One atomic commit. Estimated diff: ~10 files modified/added, ~500 LOC net.
Zero new dependencies.

After Railway deploys:
- Re-upload `EN-FOR-03-042` → lands in builder
- Each procedural-table row renders as `Step text | photo` side by side
- Hazard icons render as a `PhotoGrid` at the top of the first section
- Admin edits in the builder (block swap, re-anchor, library picker)
- Worker walkthrough renders via existing `LayoutRenderer` — already wired

## Pre-build verification checklist (do these FIRST on resume)

- [ ] Confirm `SectionContent.tsx` LayoutRenderer wiring actually fires in
      walkthrough mode (not just SOP detail page)
- [ ] Confirm `usePhotoQueue` / completion record code doesn't hard-require
      `sop_steps.id` for parsed-DOCX-with-no-steps case
- [ ] Confirm sub-trade RLS (Phase 15) doesn't filter on sop_steps existence
- [ ] Grep for any test or code path that asserts `sop_steps.length > 0`
      for non-blank source types

If any of these reveal a hard dependency on sop_steps for worker rendering,
fall back to dual-write (`layout_data` for builder + `sop_steps` for worker
walkthrough) until the worker codepath is migrated separately.

## Files involved (estimated)

```
NEW   src/components/sop/blocks/RowLayoutBlock.tsx
NEW   src/components/sop/blocks/PhotoGridBlock.tsx
NEW   src/lib/parsers/parsed-sop-to-layout-data.ts
NEW   src/lib/parsers/__tests__/parsed-sop-to-layout-data.test.ts
MOD   src/components/sop/blocks/index.ts         (exports)
MOD   src/lib/builder/puck-config.tsx            (register new blocks)
MOD   src/lib/validators/sop.ts                  (add layout_data_override placeholder, optional)
MOD   src/app/api/sops/parse/route.ts            (write layout_data for DOCX)
MOD   src/app/(protected)/admin/sops/[sopId]/review/page.tsx  (redirect DOCX→builder)
MOD   src/app/(protected)/admin/sops/builder/[sopId]/page.tsx (parse-status banner)
```

## Out of scope (deferred to Phase 20 plans proper)

- PDF / scan / video → layout_data (separate extractors)
- Backfilling pre-Phase-20 SOPs into layout_data
- AI-emitted layout_data_override (v2)
- Custom column counts beyond 2/3/4 in PhotoGrid
- Asymmetric row splits beyond 50/60/70 (no real corpus signal yet)
