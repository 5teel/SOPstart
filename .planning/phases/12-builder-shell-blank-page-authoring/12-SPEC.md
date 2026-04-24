# Phase 12: Builder Shell & Blank-Page Authoring — Specification

**Created:** 2026-04-24
**Ambiguity score:** 0.19 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

An admin can start a new SOP from a blank-page wizard, reach a Puck-based builder at `/admin/sops/builder/[sopId]`, drag 7 block types (Text, Heading, Photo, Callout, Step, HazardCard, PPECard) onto each section, reorder sections by drag-and-drop, and auto-save drafts to `sop_sections.layout_data` (JSONB, `layout_version = 1`) via the Phase 3 sync-engine pattern — while workers continue to render every existing SOP via a linear fallback when `layout_data` is null or the version is unsupported.

## Background

Phase 11 landed the schema groundwork: `section_kinds` catalog with canonical seeds (hazards, ppe, steps, emergency, signoff, content, custom), `sop_sections.section_kind_id` advisory FK, and the `blocks` + `sop_section_blocks` + `block_versions` tables (migration 00019). The runtime resolver and fallback-on-NULL branch are in place.

What does not exist yet:
- No `@measured/puck` package — `package.json` has no builder dependency
- No `layout_data` or `layout_version` columns on `sop_sections`
- No admin builder route — `/admin/sops/` has `page.tsx`, `[sopId]/page.tsx`, `[sopId]/review/`, but no `/builder/` path
- No blank-page wizard — SOPs today only come from `/admin/sops/upload`
- No `sops.source_type` column
- Stub tests at `tests/sb-layout-editor.test.ts` enumerate all 6 SB-LAYOUT requirements as `test.fixme`

Worker side: `src/components/sop/SectionContent.tsx` is the current linear renderer used in the walkthrough. It will gain a branching check for `layout_data`/`layout_version` but its legacy rendering path must remain byte-identical for SOPs that have no layout.

## Requirements

1. **Blank-page wizard** (SB-AUTH-01): Admin can start a new SOP from a wizard without uploading a source document.
   - Current: SOPs can only be created via `/admin/sops/upload`; no blank-start path exists.
   - Target: `/admin/sops/new/blank` renders a 4-step wizard — (1) title + optional SOP code, (2) canonical-kind checklist (hazards/ppe/steps/emergency/signoff), (3) review selections, (4) create draft and redirect to `/admin/sops/builder/[sopId]`.
   - Acceptance: Playwright test completes the 4 steps with 3 canonical kinds selected and lands at `/admin/sops/builder/[sopId]` with 3 rows in `sop_sections` carrying the corresponding `section_kind_id`.

2. **Unified builder surface** (SB-AUTH-04): One builder UI regardless of entry point.
   - Current: No builder UI exists. Future entry points (AI/template) do not exist yet.
   - Target: `/admin/sops/builder/[sopId]` is the single builder route. Blank-wizard redirects there after creating the draft; future AI (Phase 14) and template (Phase 15) entry points will also redirect there. A new `sops.source_type` column (enum: `uploaded | blank | ai | template`) records the origin.
   - Acceptance: `grep -r "admin/sops.*builder" src/app` returns exactly one route directory. `sops.source_type` column exists with the enum values; blank-wizard writes `blank` to it.

3. **Library source-type chip** (SB-AUTH-05): Builder-authored drafts are visually distinguishable in the admin library; both paths use the same publish gate.
   - Current: All drafts render identically in `/admin/sops` — no origin indicator.
   - Target: The admin library list renders an `AUTHORED IN BUILDER` chip when `source_type != 'uploaded'`. Both upload and builder paths call the same `publishSop` server action.
   - Acceptance: Library test shows the chip present for a `source_type = 'blank'` draft and absent for a `source_type = 'uploaded'` draft. Grep confirms one `publishSop` export, used by both UI surfaces.

4. **Section drag-reorder** (SB-SECT-05): Admin can reorder sections; order persists as `sort_order`.
   - Current: `sop_sections.sort_order` column exists from Phase 1; no UI to reorder.
   - Target: Builder exposes a section list with drag handles. Drop calls a `reorderSections` server action that writes a new contiguous `sort_order` sequence atomically within a transaction.
   - Acceptance: E2E test drags section at index 3 to index 1 in the builder, verifies `sort_order` values update transactionally, and loads the worker walkthrough to confirm the new order.

5. **Block palette** (SB-LAYOUT-01): 7 draggable blocks; linear or 2-column grid layouts.
   - Current: No Puck, no block palette; `SectionContent.tsx` renders a fixed section template.
   - Target: Puck config exposes exactly 7 block types — `TextBlock`, `HeadingBlock`, `PhotoBlock`, `CalloutBlock`, `StepBlock`, `HazardCardBlock`, `PPECardBlock`. Each block carries Zod-validated props. On `lg:` (≥1024px) the layout supports 1-column or 2-column grid. `DiagramHotspotBlock` is deferred to Phase 16 and must NOT appear in the palette.
   - Acceptance: All 7 blocks render in the Puck palette at `/admin/sops/builder/[sopId]`. `DiagramHotspotBlock` is absent. A block drags into both a 1-column and a 2-column grid on a ≥1024px viewport and the layout persists in `layout_data`.

6. **Shared block components** (SB-LAYOUT-02): Each block renders identically in admin editor and worker walkthrough via a single component tree.
   - Current: Worker walkthrough uses `SectionContent.tsx`; no shared block vocabulary exists between admin and worker.
   - Target: Block components live at `src/components/sop/blocks/{Text,Heading,Photo,Callout,Step,HazardCard,PPECard}Block.tsx`. The same component is imported by the Puck config (admin editor) and the worker `<Render>` path. Zero duplication.
   - Acceptance: `grep -r "export function TextBlock\|export const TextBlock" src/` returns exactly one match per block type. Playwright asserts a section rendered in `/admin/sops/builder/[sopId]` and in `/sops/[id]/walkthrough` produces matching block HTML (ignoring Puck editor chrome).

7. **Tailwind reflow — no mobile variant** (SB-LAYOUT-03): Layout reflows to a 5.5" phone viewport without a separate mobile authoring step.
   - Current: No layout to test.
   - Target: All block components use pure Tailwind responsive classes (`md:`, `lg:`). At `<md:` (<768px), 2-column grids collapse to single column; HazardCard/PPECard stack vertically; touch targets remain ≥44×44 px. Zero JS-based user-agent/media-query branching inside block components.
   - Acceptance: Playwright at viewport 393×852 (iPhone 15 Pro) loads a 2-column SOP and asserts each block's `getBoundingClientRect().width` ≈ viewport width. `grep -rE "isMobile|useMediaQuery|navigator\\.userAgent" src/components/sop/blocks/` returns no matches.

8. **`layout_data` persistence with `layout_version`** (SB-LAYOUT-04): Layout persists as JSONB with a monotonic-integer version pin, auto-saved via the Phase 3 sync-engine.
   - Current: `sop_sections` has no `layout_data` or `layout_version` columns.
   - Target: Migration `00020_section_layout_data.sql` adds `layout_data JSONB NULL` and `layout_version INT NULL` on `sop_sections` (additive only — no backfill of existing rows). Builder writes go through the existing Phase 3 sync-engine (`src/lib/offline/sync-engine.ts`): ~750 ms debounce to Dexie, ~3 s flush to Supabase, last-write-wins (no optimistic locking — collab is Phase 17). All Phase 12 writes set `layout_version = 1`.
   - Acceptance: Migration applies cleanly. Edit in the builder → within 5 s the section row has `layout_version = 1` and non-null `layout_data` JSONB. Airplane-mode edit queues in Dexie; reconnect flushes to Supabase.

9. **Legacy linear fallback** (SB-LAYOUT-06): Worker falls back to a linear step-list renderer when `layout_data` is null or `layout_version` is unsupported.
   - Current: `SectionContent.tsx` already renders sections as a linear step list. No branching exists.
   - Target: `SectionContent.tsx` gains a single branch: if `section.layout_data != null && supportedLayoutVersions.includes(section.layout_version)` → render via Puck `<Render>` + shared block components. Else → fall through to the existing linear renderer unchanged. Unsupported versions emit a `console.warn('[layout] unsupported version', version)` exactly once per page load.
   - Acceptance: Three scenarios verified by E2E:
     - Legacy SOP with `layout_data IS NULL` renders byte-identically to pre-Phase-12.
     - SOP with `layout_version = 999` falls back to linear renderer; warning logged.
     - SOP with `layout_version = 1` renders via block components.

## Boundaries

**In scope:**
- `@measured/puck` install + Next.js 16 integration (`'use client'` + `next/dynamic({ ssr: false })`)
- Admin builder route `/admin/sops/builder/[sopId]` with Puck editor
- 7 block components at `src/components/sop/blocks/` (Text, Heading, Photo, Callout, Step, HazardCard, PPECard) with shared admin/worker rendering
- Migration `00020_section_layout_data.sql` — additive `layout_data JSONB` + `layout_version INT` on `sop_sections`
- Blank-page wizard at `/admin/sops/new/blank` (4 steps, canonical-kind checklist)
- `sops.source_type` column (enum `uploaded|blank|ai|template`)
- `reorderSections` server action for section drag-reorder
- Draft auto-save via reused Phase 3 sync-engine (Dexie + Supabase, LWW)
- Worker branching in `SectionContent.tsx` to fall back to linear renderer when `layout_data` is null or version is unsupported
- `AUTHORED IN BUILDER` chip in admin library for `source_type != 'uploaded'`

**Out of scope:**
- **AI-drafted SOPs** — Phase 14; the unified builder router is designed to accept future AI entry points, but the prompt UI and Claude verification ship in Phase 14
- **NZ template library** — Phase 15; template catalog, picker, and cloning are deferred
- **Reusable block library (save/browse hazards, PPE, steps)** — Phase 13; Phase 12 ships blocks as inline content only, not drawn from a library
- **DiagramHotspotBlock + Konva annotation editor** — Phase 16; explicitly omitted from the Phase 12 palette to avoid half-built affordances
- **Collaborative/multi-admin editing** — Phase 17; Phase 12 uses last-write-wins with no presence indicators or version fences
- **Pipeline integration and bundle isolation** — Phase 18; Phase 12 does not modify the existing upload/parse pipeline or `parse_jobs` flow
- **New worker walkthrough redesign** (immersive mobile step view, voice input, one-step-at-a-time) — explored in the `sketch/sop-blueprint-redesign` branch; a separate future phase will spec it

## Constraints

- **Library**: Must use `@measured/puck` (not a custom DnD editor) — mandated by the roadmap.
- **Rendering**: Puck must load client-only via `next/dynamic({ ssr: false })` to avoid Next.js 16 App Router hydration mismatches.
- **Sync pattern**: Auto-save reuses `src/lib/offline/sync-engine.ts` (Phase 3) — no new sync infrastructure. Debounce ~750 ms to Dexie, flush ~3 s to Supabase, last-write-wins.
- **Version scheme**: `layout_version` is a monotonic positive integer. Phase 12 writes `1`. Any breaking schema change in a future phase increments the integer. Worker keeps a `supportedLayoutVersions` array; unsupported versions fall back to linear rendering with a single warning.
- **Migration discipline**: `00020_section_layout_data.sql` is additive only — no UPDATEs against existing rows beyond column default (which is NULL).
- **Responsive purity**: Block components must NOT use `isMobile`, `useMediaQuery`, `navigator.userAgent`, or any JS-based viewport branching. Tailwind breakpoints (`md:`, `lg:`) only.
- **Mobile-preview breakpoint**: Tailwind `md:` = 768 px. Verification viewport: 393×852 (iPhone 15 Pro).
- **Library chip copy**: `AUTHORED IN BUILDER` (uppercase, tracking-wider). Subject to product copy review; locked as the Phase 12 placeholder.
- **Route shape**: `/admin/sops/builder/[sopId]` is the single builder route for Phase 12 and all future entry points; variance is represented by `sops.source_type`, not by separate URLs.

## Acceptance Criteria

- [ ] `npm install @measured/puck` resolves; `npm run build` succeeds on Windows and Linux (Railway).
- [ ] Migration `00020_section_layout_data.sql` adds `layout_data JSONB NULL` and `layout_version INT NULL` to `sop_sections`; `sops.source_type` column added with enum `uploaded|blank|ai|template`. Migration applied to an existing v2.0 DB leaves legacy rows unmodified.
- [ ] `/admin/sops/new/blank` wizard completes the 4 steps and creates a draft SOP with the chosen canonical kinds, landing the admin at `/admin/sops/builder/[sopId]`.
- [ ] `/admin/sops/builder/[sopId]` renders the Puck editor with exactly 7 blocks in the palette (no DiagramHotspotBlock).
- [ ] Adding a block and waiting 5 s: the target `sop_sections` row has `layout_version = 1` and non-null `layout_data`.
- [ ] Airplane-mode edit queues in Dexie; reconnect flushes to Supabase within 10 s.
- [ ] A 2-column grid on ≥1024 px reflows to single column on 393×852 viewport with touch targets ≥44×44 px.
- [ ] Section drag-reorder updates `sort_order` atomically; worker walkthrough reflects the new order on next load.
- [ ] Legacy SOP (no `layout_data`) renders byte-identically in worker walkthrough compared to pre-Phase-12 baseline.
- [ ] SOP with `layout_version = 999` renders via the linear fallback and logs `[layout] unsupported version` exactly once per page load.
- [ ] SOP with `layout_version = 1` renders via Puck `<Render>` and shared block components.
- [ ] `sops.source_type` column has value `blank` for wizard-created drafts and `uploaded` for upload-path drafts.
- [ ] Admin library shows `AUTHORED IN BUILDER` chip for `source_type != 'uploaded'`; chip absent for `uploaded`.
- [ ] `grep -rE "export (function|const) (Text|Heading|Photo|Callout|Step|HazardCard|PPECard)Block" src/components/sop/blocks/` returns exactly 7 matches total (one per block).
- [ ] `grep -rE "isMobile|useMediaQuery|navigator\.userAgent" src/components/sop/blocks/` returns zero matches.
- [ ] Stub tests in `tests/sb-layout-editor.test.ts` and `tests/sb-builder-infrastructure.test.ts` flip from `test.fixme` to `test(...)` and pass.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes                                                              |
|--------------------|-------|-------|--------|--------------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75  | ✓      | 9 requirements with explicit Current/Target/Acceptance             |
| Boundary Clarity   | 0.78  | 0.70  | ✓      | Diagram block omitted; wizard scope locked; deferred phases named |
| Constraint Clarity | 0.80  | 0.65  | ✓      | Sync pattern, version scheme, breakpoint, route shape all locked  |
| Acceptance Criteria| 0.75  | 0.70  | ✓      | 16 pass/fail criteria, all falsifiable                             |
| **Ambiguity**      | 0.19  | ≤0.20 | ✓      | Gate passed after 2 interview rounds                               |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                                    |
|-------|-----------------|-------------------------------------------|--------------------------------------------------------------------|
| 0     | Scout           | What exists from Phase 11? What's missing? | Phase 11 schema landed; no Puck, no layout_data, no builder route |
| 1     | Researcher      | DiagramHotspotBlock in Phase 12 scope?     | Omit from palette until Phase 16                                   |
| 1     | Researcher      | Blank-wizard section seeding?              | Admin picks canonical kinds via checklist                          |
| 2     | Constraint      | Draft auto-save pattern?                   | Reuse Phase 3 sync-engine; debounce ~750 ms, flush ~3 s, LWW       |
| 2     | Constraint      | `layout_version` pin scheme?               | Monotonic positive integer starting at 1                           |
| 2     | Simplifier      | Block palette scope — trim or full?        | Full 7 blocks (Text, Heading, Photo, Callout, Step, HazardCard, PPECard) |
| Gate  | —               | Proceed with 3 minor opens as assumptions? | Yes — route `/admin/sops/builder/[sopId]`, breakpoint md=768px, chip `AUTHORED IN BUILDER` |

---

*Phase: 12-builder-shell-blank-page-authoring*
*Spec created: 2026-04-24*
*Next step: /gsd-discuss-phase 12 — implementation decisions (Puck config shape, Dexie table design, migration SQL, reorder atomicity, block Zod schemas, etc.)*
