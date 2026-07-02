# Phase 26: SOP Builder Redesign - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A **full bespoke inline SOP builder** that replaces Puck as the editing engine: one surface for create / convert / edit where the admin edits the exact document a worker reads, inserts blocks through a tiered context-aware menu with auto-dismissing smart-suggestion ghosts, works with a unified **Visual** block (photo · diagram · video) **including full Konva diagram annotation (Phase 17 pulled forward)** — all while preserving the existing parse → `layout_data` → junction → provenance → AI-review → verify → publish spine unchanged.

The invisible **agent-metadata layer** (memory/learning/review) is **split out** to a follow-on phase (26.5); this phase only exposes the read/write *contract hooks* the builder must not block.

This phase **opens milestone v5.0** (v4.0 is archived first).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked (R1–R8).** See `26-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read `26-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**The four open forks in SPEC.md are now RESOLVED (see Implementation Decisions D-01..D-04). The SPEC's "Recommendation to carry into discuss-phase" (Option C hybrid) is SUPERSEDED by D-01 (Full bespoke).**

**In scope (from SPEC.md, as amended by decisions):**
- Unified create/convert/edit surface (R1); inline WYSIWYG edit==worker render (R2)
- Tiered context-aware inserter (R3) + smart-next auto-dismiss ghosts (R4)
- Unified Visual block with tagged media (R5) **+ full Konva diagram annotation (Phase 17 absorbed — D-03)**
- Full preservation of the parse/review/publish spine + parity tests (R6, Preservation Checklist P1–P18)
- Agent-metadata **contract hooks only** (R7 surfacing deferred to 26.5 — D-02)

**Out of scope (this phase):**
- Rebuilding the parse pipeline, AI reviewer, or publish gate (KEEP as-is)
- Full agent memory/learning/review implementation + surfacing → **Phase 26.5 / v5.0** (D-02)
- Worker walkthrough redesign; multi-language (English-only continues)

</spec_lock>

<decisions>
## Implementation Decisions

### D-01 — Editing engine: FULL BESPOKE (Puck removed)
- **Replace Puck entirely.** Build a bespoke inline canvas that renders blocks with the *same components as the worker view*, plus a bespoke editor for every one of the 16 block types' structured fields (Decision branches, Measurement units, Inspect items, SignOff role, HazardCard severity, PPE items, etc.). No Puck field components retained.
- Consequence: the SPEC Preservation Checklist item **P14 becomes RE-IMPLEMENT (all 16 field editors)**, not "keep via Puck popover." **P13** (AI-flag overlays / `componentOverlay`) and **P17** (unknown-block `UnsupportedBlockPlaceholder` guard) are RE-IMPLEMENT in the new canvas. **P11** (autosave) and **P12** (source-viewer selection-sync) are RE-WIRE to the new editor's change/selection events.
- **The `layout_data` JSON schema, `sop_section_blocks` junctions, and `block_provenance` are FROZEN contracts** — the bespoke editor reads/writes the identical shapes so the parse pipeline, AI reviewer, verify-checklist, and publish gate are untouched. This is the hard line that makes "full bespoke" safe.
- The 3-place AI contract survives: `BLOCK_REGISTRY` (`src/actions/introspection.ts`) + Zod (`src/lib/validators/blocks.ts`) + `/api/schema` stay; the "renderer" place moves from `puck-config.tsx` to the new bespoke block renderer.
- **Highest effort/risk of the three options — chosen deliberately for the highest interface ceiling and a clean end-state.** Planner MUST wave this heavily and gate on behavioural parity tests (not source-contract) for every RE-WIRE/RE-IMPLEMENT item.

### D-02 — Agent-metadata layer: SPLIT to Phase 26.5 (contract hooks only here)
- This phase ships R1–R6 + R8 (the builder). It exposes only the metadata **contract**: the bespoke editor must not block per-SOP / per-block machine-readable access, and it must preserve/emit the tags the agent layer will consume (block type, medium tags from R5, provenance).
- Full memory / learning-proposals / review-state / embeddings / cross-SOP graph traversal + the `⚇ Agent layer` surfacing → **Phase 26.5**, built on Phase 23 X-03 (AI field layer) and graphify. Add 26.5 to the roadmap under v5.0.

### D-03 — Visual block: PULL PHASE 17 FORWARD (full Konva annotation)
- The Visual block holds/tags/displays **photo · diagram · video** (each medium-tagged `visual:photo|diagram|video` for agents), AND includes the **full Konva diagram-annotation editor** from the deferred Phase 17 plan.
- **Absorb Phase 17's three planned slices** (do not reinvent — they are fully specced in ROADMAP.md §Phase 17, lines ~618–641, and `.planning/research/v3.0-image-annotation.md`): (1) Konva foundation (`konva`+`react-konva`, `serverExternalPackages:['canvas']`, `sop_image_annotations` migration with scene jsonb + natural dims + baked path + RLS); (2) annotation primitives (Arrow/Rect/Ellipse/Text/numbered-callout/freehand, Transformer, undo/redo via scene snapshots, stylus palm-rejection); (3) bake-on-publish (client `stage.toDataURL()` → baked PNG to `sop-images/baked/...`, worker read path serves baked PNG).
- **HARD CONSTRAINT (from Phase 17 acceptance #2): workers NEVER download Konva.** The worker read path loads a baked flattened PNG via `<img>`; Konva + `react-konva` are admin-only, dynamic-imported, and must NOT grow the worker route First Load JS. Preserve the SB-LINE bundle-isolation discipline.
- `DiagramHotspotBlock` (numbered callouts at freeform x/y) is the **only freeform-positioning exception** in the otherwise block-reflow builder — fold it into the Visual/diagram medium.
- Reconcile with the existing `ModelBlock` (3D) — decide during planning whether 3D stays a separate block or becomes a Visual medium; not blocking.
- **Mark Phase 17 as ABSORBED into Phase 26 in ROADMAP.md** so it isn't double-built.

### D-04 — Milestone: OPEN v5.0
- Archive v4.0 (Phases 21–25 shipped) via `/gsd-complete-milestone`, then open **v5.0** with Phase 26 (builder redesign) as its opener, followed by Phase 26.5 (agent layer) → the conversational/AI-native builds X-03 was framed for.
- Roadmap work: add Phase 26 + 26.5 under a new v5.0 section; mark Phase 17 absorbed.

### Claude's Discretion
- Wave/slice breakdown of this (large) phase — planner decides, but expect: (W0) bespoke render+edit of existing blocks reading `layout_data`; (W1) tiered inserter + ghosts; (W2) re-wire autosave/provenance-sync/AI-overlays/verify-UI with parity tests; (W3) Visual block + Konva annotation (absorbed Phase 17 slices); (W4) convert-golden-path parity + publish-gate regression.
- Exact bespoke field-editor UX per block type (inline vs anchored panel) — discretion, provided no field that was editable under Puck becomes unreachable (SPEC acceptance).
- 3D `ModelBlock` disposition (keep separate vs fold into Visual).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase — locked scope + validated design
- `.planning/phases/26-sop-builder-redesign/26-SPEC.md` — Locked requirements R1–R8, Approach Comparison, **Preservation Checklist P1–P18** (MUST read before planning). Note: SPEC's Option-C recommendation is superseded by D-01 full-bespoke.
- `sketches/sop-builder-redesign/index.html` — the validated interactive sketch (inline canvas, paged tiered inserter, smart ghosts, Visual sub-types, agent-layer preview). Design target for R1–R5/R7.
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` + `references/*` — paper/ink design tokens, layout primitives, block-type visual language, AI-accessibility three-place contract.

### Konva diagram annotation (Phase 17 — ABSORBED via D-03)
- `.planning/ROADMAP.md` §"Phase 17: Image & Diagram Annotation" (~lines 618–641) — the 3 planned slices (Konva foundation / primitives / bake-on-publish) + 6 acceptance criteria. Reuse verbatim.
- `.planning/research/v3.0-image-annotation.md` — Konva research (dual-store, DiagramHotspotBlock, stylus/palm rejection, bake-on-publish, worker-never-loads-Konva bundle isolation).

### The frozen data contract + pipeline to preserve (P1–P18)
- `src/lib/builder/puck-config.tsx` — 16 block definitions + `sanitizeLayoutContent` + `UnsupportedBlockPlaceholder` (the renderer place moving off Puck) + 3-place contract note.
- `src/actions/introspection.ts` — `BLOCK_REGISTRY` (AI-facing schema) consumed by `/api/schema`; KEEP.
- `src/lib/validators/blocks.ts` — `BlockContentSchema` / `BlockProvenanceSchema` / `LayoutDataSchema`; the bespoke editor writes these same validated shapes.
- `src/lib/builder/block-type-labels.ts` — `humanizeBlockType` single label source; KEEP.
- `src/lib/parsers/parse` pipeline: `src/app/api/sops/parse/route.ts`, `extract-docx-structural.ts`, `gpt-parser.ts`, `parsed-sop-to-layout-data.ts`, `materializeJunctionsForLayout()`; KEEP (upstream of editor).
- `src/lib/parsers/ai-reviewer/orchestrator.ts` + `jobs/job-{a..e}-*.ts`, `verify-sop.ts` (`VERIFY_MODEL`); KEEP.
- `src/lib/parsers/source-viewer/extract-docx-paragraph.ts`, `extract-pdf-bbox.ts` + `useSelectionSync`; RE-WIRE to new canvas.
- Builder handoff + autosave: `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`, `BuilderStageShell.tsx`, `useBuilderAutosave`, `useDraftLayoutSync`, `/api/sops/[sopId]/draft-layouts`, `/api/sops/[sopId]/publish`; RE-WIRE / KEEP gate.
- `src/components/sop/blocks/ModelBlock.tsx` — 3D block to reconcile with Visual (D-03).

### Agent-layer contract (surfacing → Phase 26.5)
- Phase 23 artifacts (X-03 AI field layer / universal read-write) — the write path the 26.5 agent layer builds on. `src/lib/ai-fields/registry.ts`, `src/lib/supabase/jwt.ts` (`parseJwtPayload`).
- graphify (`graphify-out/`) — collective cross-SOP traversal backbone for 26.5.

### CLAUDE.md learnings the planner MUST honour
- 2026-06-05 (source-contract ≠ behavioural — parity tests required), 2026-05-25 (register lint/stub specs in a playwright project regex), 2026-06-27 (`'use server'` async-only; run real `next build`), 2026-06-15 / 2026-06-26 (service-role writes self-enforce org-scope; `parseJwtPayload` not `atob`), 2026-05-13 (no `router.push` on hot paths — `useState` + `history.replaceState`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (KEEP — the bespoke editor sits ON these)
- The entire parse → `layout_data` → junction → provenance → AI-review → verify → publish spine is reusable unchanged; the bespoke editor only swaps the render/edit engine over the same `layout_data` JSON.
- `humanizeBlockType` / `BLOCK_TYPE_LABELS`, `BLOCK_REGISTRY` + `/api/schema`, all Zod schemas, `useBuilderAutosave` + Dexie sync, `SourceViewerPane`, `useVerifyChecklist` + server publish gate.
- Worker block renderer components (`src/components/sop/blocks/*`) — R2 requires the edit canvas to render *these same* components, so they are the shared surface between edit and worker views.
- Phase 17's fully-specced Konva plan (absorb, don't reinvent).

### Established Patterns (constraints)
- `layout_data` is flat `{content: PuckItem[]}` per `sop_sections` row; junctionId + block_provenance ride on `props`. Bespoke editor must keep stamping these.
- SB-LINE bundle isolation (dynamic imports, worker-route First Load JS budget) — Konva must stay admin-only (baked PNG for workers).
- 3-place block contract; adding the Visual block = renderer + `BLOCK_REGISTRY` + Zod (+ label map).

### Integration Points
- New editor ← reads `layout_data` from `sop_sections`; → writes via `useBuilderAutosave` path.
- New canvas selection ↔ `SourceViewerPane` via re-wired `useSelectionSync` (provenance regions).
- AI reviewer flags + verify checklist point at junctions → the new canvas must surface per-block flag overlays + verify state.
- Visual/Konva ← new `sop_image_annotations` table + baked-PNG storage path; worker read path ← baked PNG.

</code_context>

<specifics>
## Specific Ideas

- "Edit === worker render" is the north star — the biggest unaddressed failure of 21.6 was that you edit an abstraction, not the thing a worker sees.
- Tiered inserter feel: paged command menu (short home → All / Reuse / AI drill), type-to-filter, keyboard ↑↓/↵; smart-next ghost accepts on Tab, self-suppresses when redundant, auto-dismisses on scroll/typing (validated in the sketch).
- Visual block: one block, mixed media, each item medium-tagged; convert-pipeline images become `visual:photo` retaining provenance.
- Diagram annotation is the only freeform-positioning surface; everything else reflows.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 26.5 — Agent-metadata layer** (memory / learning proposals / review state / embeddings / cross-SOP graph traversal + `⚇ Agent layer` surfacing) on X-03 + graphify. This phase only wires the contract hooks. (D-02)
- **3D `ModelBlock` disposition** — keep separate vs fold into Visual as a `visual:3d` medium; decide in planning, not blocking. (D-03)
- **Full-bespoke migration cleanup** — remove Puck dependency entirely once all 16 field editors are re-implemented and parity-tested (may trail into a cleanup slice).

None of the above is scope creep into this phase — they are explicit follow-ons.

</deferred>

---

*Phase: 26-sop-builder-redesign*
*Context gathered: 2026-07-02*
