# Phase 26: SOP Builder Redesign — Inline Surface + Agent Metadata Layer — Specification

**Created:** 2026-07-02
**Status:** DRAFT — approach decision (A/B/C) is the primary open fork; resolve in discuss-phase
**Ambiguity score:** 0.34 (gate: ≤ 0.20) — **above gate on purpose**; the engine decision is unresolved and must be decided before planning.

## Goal

One SOP surface for **create-from-scratch**, **convert-an-existing-doc**, and **edit-existing**, where the admin edits the *exact document a worker reads* (inline WYSIWYG), inserts blocks through a *tiered, context-aware* menu with confident auto-dismissing smart suggestions, works with a unified **Visual** block (photo · diagram · video), and where every SOP carries a **human-invisible agent-metadata layer** (context · memory · learning · review) that agents can read, write, and traverse individually and collectively — **all while preserving the existing parse → `layout_data` → junction → provenance → AI-review → verify → publish spine unchanged.**

## Background

### What ships today (and works)
Two systems are already built and mostly solid:

1. **The convert pipeline (robust — do not disturb).** `POST /api/sops/parse` orchestrates: structural DOCX extraction with table-row containment (`extract-docx-structural.ts`), PDF image+bbox extraction (spike 001/002, 0 MB bundle cost), GPT triage→parse routing (Haiku/Sonnet, `gpt-parser.ts`), per-block **provenance** (page+bbox for PDF, paragraph_id+run for DOCX), Zod validation at every boundary, atomic **junction materialization** (`sop_section_blocks`), a 5-job **AI reviewer** with ephemeral-cache cost control (~$0.15 for all five), confidence gating, orphan-image capture, and **provenance lineage** (`parser_run_id` + `parser_version`). Output is **Puck `layout_data` per `sop_sections` row.**

2. **The edit UI (already reconfigured in 21.6 — still unsatisfying).** Phase 21.6 already delivered a single `＋ Add` menu with humanised grouped labels (`AddMenu.tsx`), a step-centric left tree (`BuilderTreeRail`), inline `contentEditable` for text, a `StructuredFieldPopover` for complex fields, and a 3-stage Build → Review → Publish shell with a side-by-side source viewer and a server-enforced verify gate. **Jargon, the double list, and no-inline-edit are already fixed.** Yet the builder is still judged "terrible."

### Why it still fails (the real gaps 21.6 did not close)
- **Edit ≠ worker view.** The admin builder is a *separate surface* (Puck canvas + rails) from what a worker actually reads. You edit an abstraction, not the thing. This is the biggest unaddressed complaint.
- **Insertion is dumb.** The `＋` menu is grouped but **not filtered by section context**, has **no prediction**, and no keyboard/ghost fast-path. Every insert is a full menu hunt.
- **Media is fragmented.** Separate `PhotoBlock` / `PhotoGridBlock` / `ModelBlock`; no unified, tagged **Visual** concept; diagrams/video are not first-class.
- **The machine layer is thin.** `BLOCK_REGISTRY` + `/api/schema` + `block_provenance` + `ai_review_results` exist, but there is no per-SOP **memory / learning / review** layer agents can accumulate into and reason from across SOPs.

### The architectural pivot this phase must decide
Because **`layout_data` + junctions + provenance are the data contract the whole spine speaks**, a new editor does **not** have to abandon the pipeline. It can read and write the identical JSON. The decision is therefore narrow and specific: **do we keep reconfiguring Puck (21.6 path), or replace only the editing engine with a bespoke inline renderer over the same data contract?** This spec exists to force that decision with eyes open.

---

## ⭐ Approach Comparison (the requested research)

Three viable options. All three **keep the convert pipeline, `layout_data` schema, junctions, provenance, AI reviewer, and publish gate**. They differ only in the *editing engine* and how much UI must be rebuilt.

| Dimension | **A — Keep iterating Puck in place** (21.6 continued) | **B — Bespoke inline editor over the same `layout_data`** | **C — Hybrid: bespoke canvas, Puck retained for structured-field editing** |
|---|---|---|---|
| Edit == worker render | ✗ Hard — Puck imposes its own canvas/overlay chrome; parity is faked, never exact | ✓ Native — the editor *is* the worker renderer with edit affordances layered on | ◐ Mostly — worker renderer for display, Puck popover for deep fields |
| Context-aware / smart inserter | ◐ Possible but fights Puck's drawer model | ✓ Full control (sketch already proves it) | ✓ Full control (insertion is bespoke) |
| Convert-from-existing fidelity | ✓ Unchanged (pipeline untouched) | ✓ Unchanged (reads same `layout_data`) | ✓ Unchanged |
| Autosave / offline (Dexie→Supabase) | ✓ Keep as-is | ◐ Re-wire editor change events → same hook | ◐ Re-wire for canvas edits; Puck path stays for fields |
| junctionId stamping + publish gate | ✓ Untouched | ✓ Untouched (junctions are data, not Puck) | ✓ Untouched |
| Source-viewer provenance highlight | ✓ Working | ◐ Re-bind selection-sync to new canvas nodes | ◐ Re-bind for canvas |
| AI-flag overlays (`componentOverlay`) | ✓ Working | ◐ Re-implement badge overlay in new canvas | ◐ Re-implement |
| Structured-field editing (Decision/Measurement) | ✓ Puck fields + popover | ✗ Must rebuild every field editor | ✓ Reuse Puck fields via popover |
| New block types (Visual etc.) | ◐ 3-place contract each | ◐ 2-place (renderer + registry + Zod) | ◐ 3-place |
| Build effort | **Low** | **High** | **Medium-High** |
| Risk of losing a valuable method | **Low** | **Medium** (re-earn overlays/sync/autosave wiring) | **Medium** |
| Ceiling on the interface | **Low** (21.6 already near Puck's ceiling; "still terrible") | **High** (this is what the sketch demonstrates) | **High** |

**Assessment.** Option A is cheapest but has already been run once and produced the "still terrible" verdict — its ceiling is Puck's, and the edit≠worker-view problem is *structural* to using a separate editor framework. Option B has the highest interface ceiling and is what the sketches validate, but it must **re-earn** three UI-level bindings that today come free from Puck (autosave wiring, provenance selection-sync, AI-flag overlay). Option C hedges: bespoke display + insertion (the parts that make it feel bad), Puck retained behind a popover for the fiddly structured-field forms (the parts Puck does fine) — lowering the "rebuild every field editor" cost of B.

**Recommendation to carry into discuss-phase:** **Option C (hybrid), with an explicit migration path to B.** Rebuild the canvas + inserter + Visual + agent-layer surfacing (where the value is); keep Puck's field components alive inside the structured-field popover so we don't rebuild 16 field editors on day one. Revisit full-B once the bespoke canvas is proven. This preserves every pipeline method while giving the high interface ceiling, at medium (not high) risk.

---

## Preservation Checklist — valuable methods that MUST survive

Every item below is a hard-won method from the existing system. Tag = **KEEP** (upstream/data — untouched), **RE-WIRE** (same logic, reconnect to new editor), **RE-IMPLEMENT** (UI must be rebuilt in the new surface), **VERIFY** (regression-test only). Nothing here is allowed to silently disappear.

| # | Valuable method | Source | Disposition |
|---|---|---|---|
| P1 | Structural DOCX extraction (table-row containment → image↔step mapping) | `extract-docx-structural.ts` (`7b9151e`) | **KEEP** |
| P2 | Image-index alignment via `[IMG N]` tokens (not stream proximity) | `gpt-parser.ts` | **KEEP** |
| P3 | GPT triage→parse routing (Haiku SIMPLE / Sonnet COMPLEX) + format hints | `gpt-parser.ts` | **KEEP** |
| P4 | Per-block provenance (PDF page+bbox / DOCX paragraph_id+run) | `parsed-sop-to-layout-data.ts`, `source-viewer/*` | **KEEP** data · **RE-WIRE** highlight binding to new canvas nodes |
| P5 | Zod validation at every boundary (`BlockContentSchema`, `BlockProvenanceSchema`, `LayoutDataSchema`) | `validators/blocks.ts` | **KEEP** — the new editor writes the same validated shapes |
| P6 | Atomic junction materialization (sequential, throw-on-any-fail, no partial junctions) | `materializeJunctionsForLayout()` | **KEEP** |
| P7 | 5-job AI reviewer + single-session ephemeral cache + per-org spend cap | `ai-reviewer/orchestrator.ts` | **KEEP** |
| P8 | Confidence gating (section + block) and the **per-block verify checklist publish gate** (server 400 `unverified_blocks`) | `useVerifyChecklist`, `/api/sops/[sopId]/publish` | **KEEP** server gate · **RE-IMPLEMENT** the per-block verify UI in the new surface |
| P9 | Orphan-image capture (never silently drop unattributed images) | `parsed-sop-to-layout-data.ts:334-361` | **KEEP** · **RE-IMPLEMENT** as "Reference images" gallery |
| P10 | Provenance lineage (`parser_run_id`, `parser_version`) for future reparse | Phase 21-04 | **KEEP** |
| P11 | Autosave path (Puck onChange → Dexie `draftLayouts` → Supabase) + offline queue + SAVED pill | `useBuilderAutosave`, `useDraftLayoutSync` | **RE-WIRE** the new editor's change events into the same hook |
| P12 | Side-by-side source viewer + cross-stage selection sync (canvas↔source) | `SourceViewerPane`, `useSelectionSync` | **KEEP** component · **RE-WIRE** to new canvas |
| P13 | AI-flag overlays (`ReviewerFlagsPanel` inline; `componentOverlay` badges; update-available badges) | Phase 21.5/13-04 | **RE-IMPLEMENT** overlay/badge in new canvas |
| P14 | Structured-field editors for Decision/Measurement/Inspect/SignOff/etc. | Puck fields + `StructuredFieldPopover` | **RE-IMPLEMENT** (Option B) **or KEEP via Puck popover** (Option C) |
| P15 | 3-place AI-accessibility contract (Puck config + `BLOCK_REGISTRY` + Zod) + `/api/schema` | `introspection.ts` | **KEEP** registry + Zod + endpoint; the "renderer" place moves from Puck to the bespoke renderer |
| P16 | Humanised labels single-source (`humanizeBlockType` / `BLOCK_TYPE_LABELS`) | 21.5 | **KEEP** |
| P17 | Unknown-block safety (`sanitizeLayoutContent` → `UnsupportedBlockPlaceholder`) | `puck-config.tsx` | **RE-IMPLEMENT** equivalent guard in new renderer |
| P18 | Append-only completion records / immutable sign-off (worker side) | Phase 4 | **KEEP** (unaffected) |

**Rule:** no plan in this phase is "done" until each RE-WIRE / RE-IMPLEMENT item has a test proving parity with the behaviour it replaces (source-contract tests are insufficient — behavioural, per CLAUDE.md 2026-06-05).

---

## Requirements

1. **R1 — One surface, three on-ramps.** Create-from-scratch, convert-a-document, and edit-existing all resolve into the *same* builder; the differences are the on-ramp and the seed content, not a different editor.
   - Current: separate wizard on-ramps; the admin builder is a distinct surface from the worker render.
   - Target: a single builder reached by all three flows; convert seeds it from the parse pipeline (unchanged), create seeds it empty/templated, edit opens the live SOP.
   - Acceptance: all three entry paths land on the same component; convert path still produces identical `layout_data`/junctions/provenance to today.

2. **R2 — Inline WYSIWYG: edit == worker render.** The edit canvas renders blocks identically to the worker Read view, with edit affordances layered on (click-to-edit text, hover tools, drag reorder).
   - Current: 21.6 gives inline `contentEditable` but inside Puck's separate canvas chrome, not the worker renderer.
   - Target: the editing canvas *is* the worker block renderer; what the admin sees is what the worker gets, edited in place.
   - Acceptance: a given SOP renders visually equivalent in edit canvas and worker view (same block components); text edits persist via P11 autosave.

3. **R3 — Tiered, context-aware inserter.** The `＋` menu is a paged command menu: a short home (section-relevant "Fits here" + drill rows for All / Reuse / AI), type-to-filter, keyboard nav.
   - Current: single grouped `AddMenu`, not context-filtered, no keyboard/paging.
   - Target: menu content is a function of (section type, preceding block); home stays short; deeper tiers are one step away; library reuse is department-scoped with an all-org toggle.
   - Acceptance: opening `＋` in Hazards vs Steps yields different "Fits here" lists; keyboard ↑↓/↵ operate the menu; Reuse step filters by department with a toggle.

4. **R4 — Smart-next predictions with auto-dismissing ghosts.** Confident, content-adjacent predictions (e.g. Hazard→PPE, Measurement→Decision, Step→Measurement) surface as an inline ghost (Tab/click to accept) that self-suppresses when the predicted block already follows and dismisses on scroll-past or typing elsewhere.
   - Current: none.
   - Target: at most one "live" ghost near the viewport; others dim; redundant ones never render.
   - Acceptance: a ghost appears after a qualifying block, accepts on Tab, does not appear when the predicted block already follows, and clears on scroll/typing.

5. **R5 — Unified Visual block (photo · diagram · video).** Replace/absorb the separate photo blocks into one **Visual** block whose items each carry a medium tag (`visual:photo` / `visual:diagram` / `visual:video`); a single Visual block may hold mixed media.
   - Current: `PhotoBlock`, `PhotoGridBlock`, `ModelBlock` are separate; no video block; diagram = plain image.
   - Target: a Visual block with a medium sub-picker; each item tagged by medium and exposed to the agent layer (R7) and `/api/schema`.
   - Acceptance: inserting Visual offers photo/diagram/video; each stored item carries its medium tag; the convert pipeline's images map into Visual items with `visual:photo` without losing provenance (P4).
   - **Fork:** "Diagram" overlaps deferred **Phase 17 (Konva annotation)** and "3D" overlaps `ModelBlock` — decide in discuss-phase whether Visual just *tags/holds* these now and annotation lands later, or pulls Phase 17 forward.

6. **R6 — Pipeline spine preserved (the whole Preservation Checklist).** The convert→`layout_data`→junction→provenance→AI-review→verify→publish spine behaves identically; only the editing engine and surfacing change.
   - Acceptance: every P-item is KEEP/RE-WIRE/RE-IMPLEMENT/VERIFY-tagged and each non-KEEP item has a behavioural parity test; the convert golden-path produces byte-equivalent `layout_data` + junctions to pre-phase.

7. **R7 — Human-invisible agent-metadata layer.** Every SOP and every block carries a machine-readable layer — id, type, semantic tags, entities, embeddings, cross-SOP links, **memory**, **learning proposals**, **review state** — that agents can read, write, and traverse individually (per-SOP) and collectively (cross-SOP summarisation). Invisible to workers.
   - Current: partial — `BLOCK_REGISTRY`/`/api/schema`, `block_provenance`, `ai_review_results`, Phase 23 X-03 AI field layer, confidence scores. No memory/learning accumulation, no embeddings/graph traversal surface.
   - Target: a first-class per-SOP metadata document (extending X-03) + per-block twin; agents read for context, write memory, propose learning-driven edits (human-reviewed), and record review state; cross-SOP links ride the graphify graph.
   - Acceptance: an authenticated agent endpoint returns per-SOP + per-block metadata; agent writes are org-scoped and audited; a "collective" query summarises across ≥2 SOPs via shared blocks/links; nothing in this layer renders in the worker UI.
   - **Fork:** R7 is large enough to be **its own phase (26.5 / v5.0 opener)** built on X-03. Default: split R1–R6 (builder) from R7 (agent layer); keep R7 here only as the contract the builder must not block.

8. **R8 — No regression to safety, autosave, offline, gates.** Publish gate (server 400), no-bulk-verify lint guard, junctionId stamping, autosave/offline, AI overlays, and append-only worker records all continue to function.
   - Acceptance: existing gate + lint guards pass; `layout_data` schema unchanged; autosave + junction stamping verified intact; worker walkthrough/completion unaffected.

## Boundaries

**In scope**
- Unified create/convert/edit surface (R1); inline WYSIWYG edit==worker render (R2)
- Tiered context-aware inserter (R3) + smart-next auto-dismiss ghosts (R4)
- Unified Visual block with tagged media (R5)
- Full preservation of the parse/review/publish spine + parity tests (R6, P1–P18)
- The agent-metadata *contract* the builder must expose/not block (R7 hooks)

**Out of scope (this phase)**
- Rebuilding the parse pipeline, AI reviewer, or publish gate (KEEP as-is)
- Full agent memory/learning/review implementation → **candidate split to its own phase** (R7)
- Konva diagram annotation editing → Phase 17 (Visual may *hold/tag* diagrams now)
- Worker walkthrough redesign (separate workstream)
- Multi-language (English-only continues; Phase 22 deferral stands)

## Constraints

- **`layout_data` schema, `sop_section_blocks` junctions, and `block_provenance` are frozen contracts** — the new editor reads/writes them unchanged (this is what preserves the pipeline).
- `humanizeBlockType` / `BLOCK_TYPE_LABELS` remain the single label source (P16).
- Autosave must flow through the existing `useBuilderAutosave` → Dexie → Supabase path (P11); no new persistence path for drafts.
- The 3-place AI contract stays: `BLOCK_REGISTRY` + Zod + `/api/schema` (P15); the renderer place may move off Puck.
- Any new `tests/lint/*` or stub spec MUST be registered in a `playwright.config.ts` project regex (CLAUDE.md 2026-05-25).
- `'use server'` files export only async functions; pure helpers live in non-server modules (CLAUDE.md 2026-06-27). Run a real `npm run build` as the final gate for any `src/actions/*` change.
- Agent-layer writes use service-role only with self-enforced org-scoping (CLAUDE.md 2026-06-15/2026-06-26).
- Admin builder is desktop-first; must not break ≥768px. Preserve the SB-LINE bundle-isolation discipline (dynamic imports; `/sops/[sopId]` bundle budget).

## Acceptance Criteria

- [ ] All three on-ramps resolve to one builder; convert path yields identical `layout_data`/junctions/provenance to pre-phase (golden-file test)
- [ ] Edit canvas renders blocks with the same components as the worker view; text edits autosave + persist after reload
- [ ] `＋` menu content changes by section context; keyboard nav works; Reuse is department-scoped with all-org toggle
- [ ] Smart ghost appears only for confident, non-redundant predictions; Tab accepts; dismisses on scroll/typing
- [ ] Visual block holds tagged photo/diagram/video; converted images become `visual:photo` items retaining provenance
- [ ] Every Preservation-Checklist P-item is dispositioned; each RE-WIRE/RE-IMPLEMENT has a behavioural parity test (not source-contract only)
- [ ] Server publish gate + no-bulk-verify lint guard still pass; `layout_data` schema unchanged; junction stamping + AI overlays intact
- [ ] Agent-metadata contract endpoint returns per-SOP + per-block data, org-scoped, invisible to workers (if R7 kept here; else deferred with the contract stubbed)

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---|---|---|---|
| Goal Clarity | 0.80 | 0.75 | ✓ | Inline surface + inserter + Visual + agent layer are well-described (sketch-validated) |
| Boundary Clarity | 0.55 | 0.70 | ⚠ | Engine decision (A/B/C) and R7 split unresolved — must decide in discuss-phase |
| Constraint Clarity | 0.85 | 0.65 | ✓ | Data contracts frozen; preservation checklist explicit |
| Acceptance Criteria | 0.70 | 0.70 | ✓ | Pass/fail checks incl. golden-file convert parity |
| **Ambiguity** | **0.34** | ≤0.20 | ⚠ | Intentionally above gate: two decisions (engine A/B/C, R7 split) are for the human, not the planner |

## Open Forks (resolve in discuss-phase, do not let the planner assume)

1. **Editing engine: A (iterate Puck) / B (bespoke) / C (hybrid).** Spec recommends **C** with a path to B. This is the load-bearing decision.
2. **R7 agent layer: in this phase or its own (26.5 / v5.0 opener)?** Recommend **split**; keep only the contract here.
3. **Visual "Diagram"/"3D": tag-and-hold now vs pull Phase 17 (Konva) / revive `ModelBlock` forward.**
4. **Milestone placement:** is this the closer of v4.0 UX-debt or the opener of v5.0? (Affects roadmap + STATE.)

---

*Phase: 26-sop-builder-redesign*
*Spec created: 2026-07-02*
*Sketch: `sketches/sop-builder-redesign/index.html` (validated interactively 2026-07-02)*
*Grounding: existing-edit-UI + convert-pipeline code inventories (2026-07-02)*
*Next step: `/gsd-discuss-phase 26` — resolve the 4 open forks (engine A/B/C, R7 split, Visual/Phase-17, milestone) before planning.*
