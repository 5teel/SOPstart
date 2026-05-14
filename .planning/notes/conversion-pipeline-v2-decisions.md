---
title: Conversion Pipeline V2 — exploration decisions
date: 2026-05-14
context: /gsd-explore session before /gsd-spec-phase 20
source_conversation: post-Phase-15 wrap, Simon asked to "move on to SOP conversion"
---

# Conversion Pipeline V2 — Decisions Captured Pre-Spec

These decisions were reached in a Socratic exploration session on 2026-05-14. They are the inputs to `/gsd-spec-phase 20`. The spec agent should treat them as locked unless explicitly re-opened — they were chosen against the safety-critical constraint that "every SOP is fundamentally responsible for safety; we can never afford any mistakes."

## D-CV2-01 — Fidelity bar: restructured for line work

**Decision:** Conversion extracts the *intent* of every visual element and reflows into SafeStart-native blocks. NOT a pixel-faithful re-skin of the source document.

**Implication:** Worker sees a SafeStart-native experience that may not visually resemble the source. Admin can use the side-by-side source viewer (D-CV2-04) to verify the intent was captured correctly.

**Applies to:** Photos, diagrams, charts, tables, embedded SVG/EMF — uniformly. No format-specific fidelity tiers.

## D-CV2-02 — Coverage scope: all upload paths

**Decision:** V2 upgrades all conversion entry points uniformly:
- DOCX (Phase 2)
- PDF (Phase 2 — resolves the 2-02 D `@napi-rs/canvas` deferral that dropped embedded images)
- Scans / photos of printed SOPs (Phase 5)
- Video upload + YouTube URL (Phase 6)
- AI prompt (Phase 14, partial — see open question 1 in roadmap entry)

**Implication:** Five extractor paths converge on a single `layout_data` + provenance output contract. The parser refactor (Plan 20-02) is the integration point.

## D-CV2-03 — Review surface: Rung C (full builder)

**Decision:** Parsed drafts land directly in the Phase 12 builder with `layout_data` pre-populated. The legacy `/admin/sops/[sopId]/review` ReviewClient retires. Admin has full builder power on the parse output (block swap, re-anchor, add/remove sections, run library picker, etc.).

**Why:** Safety-critical conversion means admin must be able to fix any AI mistake, not just toggle approval per section. Rungs A (inline edits only) and B (block swap only) were rejected — they leave structural mistakes un-fixable without a re-upload.

**Implication:**
- Parser output format changes — emit `layout_data` JSONB on parse-completion, not just `sop_sections` + `sop_steps` rows
- All five conversion entry points (Word, PDF, scan, video, AI prompt) converge on one surface
- Phase 13 block-library reuse and 12.5/14.5 blueprint styling become free
- Granular edits in the new design style (Simon's original ask) is satisfied implicitly by routing through the existing blueprint builder

## D-CV2-04 — Verification: three independent layers

**Decision:** Safety requires three independent verification layers, all non-bypassable.

| Layer | Mechanism | When |
|---|---|---|
| 1. Human eyes | Persistent side-by-side source viewer with click-to-highlight provenance | During editing (always visible on desktop builder) |
| 2. AI eyes | Claude reviewer runs jobs A–E (see D-CV2-05) | Auto on 1st parse + admin-triggered manual re-run |
| 3. Procedural gate | Per-block verify checklist — every block has a checkbox tied to its source; no bulk-tick; publish blocked until 100% | Publish gate |

**Why:** Each layer catches a different failure mode. Side-by-side surfaces structural errors. AI reviewer surfaces semantic errors (hallucination, omission, mis-anchoring). Verify checklist surfaces "admin rubber-stamped" errors.

**Trade-off accepted:** Admin labour cost is high (verify-each-block on a 200-step SOP = 200 sign-offs). This is intentional. The phase explicitly does NOT allow bulk-tick or "trust score above N skips this block." If labour cost makes 100-site Visy rollout infeasible, the answer is more admins, not weaker verification.

## D-CV2-05 — AI reviewer scope: all five jobs

**Decision:** The AI reviewer runs all five jobs, not a subset:

- **A. Hallucination check** — every claim in the builder must trace to source (extends existing Phase 6 `verify-sop.ts`)
- **B. Omission check** — reverse-scan: flag anything in the source missing from the draft
- **C. Anchoring check** — verify each photo/diagram/table is on the correct step
- **D. Safety completeness** — pattern-match against NZ-industry minimums (hazards + PPE + emergency) using block library globals as benchmark
- **E. Clarity / readability** — flag jargon and long sentences for line-worker audience

**Re-run model:** Reviewer runs automatically on first parse completion. Admin can manually re-trigger after edits — UI exposes a "Re-run AI reviewer" button. Open question: per-day cap on re-runs (see open scope decision 5 in roadmap entry).

**Implication:** Jobs B and C are net-new (Phase 6 only had A). They require the reviewer to re-read the source document each call — token cost is higher than Phase 6's verifier. Cost budget needs to be set during spec/discuss.

## D-CV2-06 — Provenance metadata: required on every block

**Decision:** Every block produced by the parser must carry source-provenance metadata sufficient for the source viewer to highlight on click.

**Shape:** Unified `block_provenance` JSONB column on `sop_section_blocks` (or `block_versions` — TBD during spec):
```
{
  source_type: 'docx' | 'pdf' | 'scan' | 'video' | 'ai_prompt',
  source_ref: 'storage://path/to/source.pdf',
  region: {
    // shape varies by source_type:
    // docx: { paragraph_id, run_start, run_end }
    // pdf:  { page, bbox: [x0, y0, x1, y1] }
    // scan: { image_crop: [x0, y0, x1, y1] }
    // video:{ timestamp_start, timestamp_end }
    // ai_prompt: { prompt_text } — degenerate, no source region
  },
  ai_confidence: 0.0..1.0,
  ai_reasoning: string  // short justification from extractor
}
```

**Open:** Whether to land this on `sop_section_blocks` (per-junction-row, scoped to one SOP instance) or `block_versions` (shared across all uses of the block) — resolved during spec.

## D-CV2-07 — Phase 13 block-library reuse during extraction

**Decision:** Parser proposes link-to-existing-block when semantic similarity to a global/org block exceeds threshold. Admin chooses link vs. write-new.

**Why:** NZ industrial SOPs share a lot of structure (LOTO, confined-space entry, forklift ops) — Phase 13 seeded 65 globals exactly for this. Re-using globals during extraction reduces drift and lets admin updates flow through `update_available` badging from Phase 13-04.

**Threshold:** TBD during spec (open scope decision 3 in roadmap entry).

---

## Out of Scope (Explicitly)

- **Pixel-faithful PDF/DOCX rendering** — D-CV2-01 explicitly chose semantic extraction
- **Bulk-migration tooling** — separate concern; conversion V2 upgrades the single-SOP path; bulk migration could be a future phase that wraps this one
- **Rung A/B review surfaces** — D-CV2-03 chose Rung C; do not re-introduce a "lite" review path
- **Bulk-tick on verify checklist** — D-CV2-04 explicitly forbids this
- **Trust-score bypass** — D-CV2-04 explicitly forbids "high confidence skips this block"
- **Phase 17 image annotation** — DiagramHotspotBlock is consumed by conversion V2 if/when Phase 17 lands; conversion V2 does not block on Phase 17 (uses plain PhotoBlock as fallback)

## Dependencies Landed Before This Phase

- Phase 11 — `blocks` / `block_versions` / `sop_section_blocks` schema (provenance metadata adds to this)
- Phase 12 — Puck builder shell + `layout_data` JSONB (parser now emits into this)
- Phase 13 — Block library + `update_available` mechanism (extraction proposes library links)
- Phase 14.5 — Paper/ink blueprint shell (builder already wears this; review surface inherits)
- Phase 6 — `verify-sop.ts` Claude verifier (extended for jobs B–E)

## Next Steps

1. Run the PDF-image-extraction spike (`/gsd-spike` — see `.planning/todos/pending/spike-pdf-image-extraction.md`) — gates Plan 20-01
2. Run `/gsd-spec-phase 20` to convert these decisions into falsifiable requirements
3. Run `/gsd-discuss-phase 20` to surface remaining gray areas (token cost cap, video provenance shape, block-matching threshold)
4. Run `/gsd-plan-phase 20` to break into the 5 plans sketched in `ROADMAP.md`
