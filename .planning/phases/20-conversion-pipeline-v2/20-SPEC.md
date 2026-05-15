# Phase 20: Conversion Pipeline V2 — Specification

**Created:** 2026-05-15
**Ambiguity score:** 0.129 (gate: ≤ 0.20)
**Requirements:** 12 locked

## Goal

An admin uploading a Word / PDF / scan / video SOP that contains photos, diagrams, charts, and tables receives a structured draft where every visual element is preserved AND anchored to the correct step/section, and the review surface IS the Phase 12 builder — with persistent side-by-side source viewing, an AI reviewer that runs five verification jobs (auto on first parse + manual re-run), and a mandatory per-block verify checklist at the publish gate.

## Background

**What exists today (post-Phase-15):**

- Phase 2 parser (`src/lib/parsers/`): DOCX via `mammoth`, PDF text via `unpdf`; **PDF embedded image extraction is deferred** (Phase 2-02 D decision: `@napi-rs/canvas` rejected for 50 MB+ bundle risk on Vercel)
- Parser output: `sop_sections` + `sop_steps` table rows, NOT Puck `layout_data`
- Review surface: `/admin/sops/[sopId]/review` (ReviewClient.tsx) — section-toggle approval UI, distinct from the Phase 12 builder at `/admin/sops/builder/[sopId]`
- AI verifier: `src/lib/parsers/verify-sop.ts` runs **Job A only** (hallucination check against transcript or prompt source) using `claude-haiku-4-5-20251001` via Anthropic SDK with lazy-init + fetch indirection
- Publish gate: counts unapproved sections server-side, blocks publish if any remain (`POST /publish`)
- Block schema: Phase 11 shipped `blocks` / `block_versions` / `sop_section_blocks` tables
- Block library: Phase 13 shipped 65 NZ-industry global blocks + `is_platform_admin()` SECURITY DEFINER helper + library-pick UI in the builder wizard
- Source provenance: **does not exist** — no `block_provenance` column anywhere

**What's broken or missing:**

1. **Embedded images dropped from PDFs entirely** — Phase 2-02 D acknowledges this; safety-critical SOPs lose the diagrams that show workers WHERE the lockout switch is
2. **No source-region anchoring** — admin reviewing a parsed SOP has no way to verify "did this hazard come from page 4 or did the AI hallucinate it"
3. **Two review surfaces** — `/admin/sops/[sopId]/review` (parse review) and `/admin/sops/builder/[sopId]` (Puck builder) drift apart; structural mistakes in parse are NOT fixable from the review surface, only via re-upload
4. **Single-layer verification** — Phase 6's `verify-sop.ts` has Job A (hallucination); Jobs B (omission), C (anchoring), D (safety completeness), E (clarity) are absent

**Spike outcomes (all four VALIDATED 2026-05-15, see `.planning/spikes/00X-*/README.md`):**

- 001: `unpdf.extractImages` (bytes) + `pdfjs` op-list+CTM walk (bbox) → 0 MB bundle Δ; resolves Phase 2-02 D
- 002: pdfjs render + DOM bbox overlay → 33 ms click→overlay on 17-page PDF (6× under 200 ms budget)
- 003: Sonnet 4.5 Jobs B+C caught injected defects exactly; $0.06 differential spend; 100% prompt-cache hit on follow-up calls
- 004: 50-block verify checklist → 2.5 min careful pace; Visy 5 000-SOP onboarding ~6 person-weeks distributed

**Exploration decisions (locked 2026-05-14, `.planning/notes/conversion-pipeline-v2-decisions.md`):**

D-CV2-01 fidelity bar = restructured (semantic), NOT pixel-faithful · D-CV2-02 coverage = all upload paths (DOCX/PDF/scan/video; AI-prompt partial — see CONV-12) · D-CV2-03 review surface = full builder (Rung C) · D-CV2-04 verification = three independent layers · D-CV2-05 reviewer = all five jobs · D-CV2-06 provenance = required on every block · D-CV2-07 library matching = parser proposes link-vs-write-new

## Requirements

1. **PDF image extraction with provenance**: PDF embedded images are extracted with `{page, bbox}` provenance during parse.
   - Current: PDF parse uses `unpdf` for text only; embedded images are dropped (Phase 2-02 D deferral). No `block_provenance` exists.
   - Target: Parser extracts every `paintImageXObject` + `paintInlineImageXObject` from a PDF via `unpdf.extractImages` (bytes) correlated by `(page, index-on-page)` with `pdfjs` op-list+CTM-derived `{page, bbox, pageWidth, pageHeight}`. Image masks (`paintImageMaskXObject`) explicitly skipped. Fresh `new Uint8Array(buf)` per `extractImages` call (Spike 001 gotcha).
   - Acceptance: Re-running the spike's `large-rondot-probe.pdf` corpus through the production parser yields ≥ 37 PhotoBlocks with `block_provenance.region = {page, bbox: [x0,y0,x1,y1], pageWidth, pageHeight}`; image-mask ops produce no blocks; no `@napi-rs/canvas`, `gm`, or `pdf2pic` appears in the dependency tree.

2. **Unified provenance schema**: Every parser-produced block carries source-provenance metadata.
   - Current: No `block_provenance` column on `sop_section_blocks` or `block_versions`.
   - Target: New JSONB column `block_provenance` on `sop_section_blocks` with shape `{source_type: 'docx'|'pdf'|'scan'|'video'|'ai_prompt', source_ref: 'storage://…', region, ai_confidence: 0..1, ai_reasoning: string}`. Region shape varies by source: PDF = `{page, bbox, pageWidth, pageHeight}` · DOCX = `{paragraph_id, run_start, run_end}` · scan = `{image_crop: [x0,y0,x1,y1]}` · video = `{timestamp_start, timestamp_end}` · ai_prompt = `{prompt_text}`.
   - Acceptance: Migration adds the column with a NOT NULL default `{}` and a `CHECK` constraint that `source_type` is one of the five allowed values; Zod validator `BlockProvenanceSchema` parses every region shape; existing pre-Phase-20 blocks tolerated (`source_type='unknown'` fallback OR backfill task documented).

3. **Parser emits Puck `layout_data` with provenance**: Parsed drafts land directly in the Phase 12 builder.
   - Current: Parser writes `sop_sections` + `sop_steps` rows; the Phase 12 builder is a separate authoring surface entered via wizard. `/admin/sops/[sopId]/review` (ReviewClient.tsx) is the review surface.
   - Target: Parse-completion writes Puck `layout_data` JSONB on `sops` row with `block_provenance` stamped on every Puck item's props. Tables → `HazardCard[]` / `SopTable`; diagrams → `PhotoBlock` or `DiagramHotspotBlock` (Phase 17 dep — fallback to plain `PhotoBlock`); charts → `PhotoBlock` + extracted-data block. ReviewClient.tsx retires; parse-complete redirect lands the admin on `/admin/sops/builder/[sopId]` with a parse-status banner.
   - Acceptance: A parse of a real Visy industrial PDF produces a `layout_data` payload that loads cleanly in the builder; every block in `layout_data` has `props.junctionId` linking to a `sop_section_blocks` row with `block_provenance`; `/admin/sops/[sopId]/review` either 410-redirects to the builder or is removed from the route tree; no UI regression in the existing builder for non-parse-sourced SOPs.

4. **Persistent side-by-side source viewer**: Admin sees the source document beside the builder at all times on desktop.
   - Current: ReviewClient.tsx has a side-by-side view but it's parse-review-only and does not support click-to-highlight bbox provenance.
   - Target: New `SourceViewerPane` component, persistent right-pane on desktop (drawer on tablet, hidden on mobile per D-CV2 desktop-only). Click any block in the builder canvas → viewer scrolls to that page and paints a bbox overlay at `block_provenance.region.bbox` within 200 ms. Implementation uses `pdfjs.getDocument` + per-page `<canvas>` render + DOM overlay positioned via `viewport.convertToViewportRectangle` (Spike 002 pattern). Works for DOCX, PDF, scan image, and video sources (timestamp range for video, see CONV-11).
   - Acceptance: Playwright test on the Spike 001 corpus: load builder for a parsed PDF, click block #5, viewer scrolls to the correct page and overlay covers the block's bbox; click→overlay ≤ 200 ms p95 across 50 clicks.

5. **AI reviewer Job A (hallucination)**: Extends existing Phase 6 verifier with conversion-pipeline-aware framing.
   - Current: `verify-sop.ts` Job A runs on transcript / prompt sources via `claude-haiku-4-5-20251001`; output shape `VerificationFlag[]`.
   - Target: Job A also runs on DOCX/PDF/scan-source parses; same flag shape; cited source quote includes `source_location_hint` (page number for PDF, paragraph index for DOCX, timestamp for video).
   - Acceptance: Running the reviewer on a parse of a PDF with one known hallucination injected (test fixture) produces a `severity:critical` flag whose `source_location_hint` matches the page that the hallucinated claim does NOT appear on.

6. **AI reviewer Job B (omission)**: Reverse-scan the source for safety-critical content missing from the draft.
   - Current: Does not exist.
   - Target: New Anthropic call with the Spike 003 system prompt pattern (top-5 cap, ≤ 100-char descriptions); output `{severity, kind:'omission', source_quote, source_location_hint, missing_from, description}[]`. Cap at most 5 flags per run; max_tokens 2 000.
   - Acceptance: The Spike 003 fixture's corrupted draft (one critical safety step deliberately dropped) re-run through the production reviewer flags the dropped step with `severity:critical` and a `source_location_hint` citing at least one of the source pages where the warning appears.

7. **AI reviewer Job C (anchoring)**: Verify every photo's caption/subject relates to its anchored step.
   - Current: Does not exist.
   - Target: New Anthropic call; output `{severity, kind:'anchoring', photo_id, current_step_id, photo_caption, description, suggested_step_id|null}[]`. Runs cheap (~9 output tokens when no errors).
   - Acceptance: The Spike 003 fixture's swapped photo (cycle switch on bottom-plate step) is flagged with the correct `photo_id`, `current_step_id`, and `suggested_step_id`.

8. **AI reviewer Jobs D + E (safety completeness, clarity)**: Pattern-match safety minimums + line-worker readability.
   - Current: Do not exist.
   - Target: Job D pattern-matches against Phase 13 global block library (hazards + PPE + emergency) — flags absent block categories vs NZ-industry expected baseline. Job E flags jargon density + sentence length > 30 words. Both produce same flag shape.
   - Acceptance: A draft with no Hazards section flags `severity:critical` from Job D citing the absent category; a step with a 60-word sentence flags `severity:warning` from Job E.

9. **Reviewer auto-trigger + manual re-run + per-block flag rendering**: Reviewer fires once on parse, again on admin click; flags surface per-block in the builder.
   - Current: Phase 6 verifier runs once on parse-completion only; flags surface via `AdversarialFlagBanner` at top of ReviewClient, not per-block.
   - Target: Reviewer runs all five jobs in one HTTP session (prompt-cache reuse) after parse-completion. Admin gets a "Re-run AI reviewer" button on the builder toolbar. Flags surface inline beneath each affected block via `ReviewerFlagsPanel` component; clicking a flag scrolls the block into view AND the source viewer to the flag's `source_location_hint`. Per-day re-run cap = **5 per SOP**; per-org daily token budget = unlimited (revisit after Visy pilot).
   - Acceptance: Re-running the reviewer 6 times on a single SOP in one calendar day returns a `429 Too Many Requests` on attempt 6 with a clear admin-facing error; flags render in the builder under their target blocks, not in a separate panel.

10. **Per-block verify checklist publish gate**: Publish blocked until every block is explicitly approved.
    - Current: Publish gate counts `approved` sections only.
    - Target: New `sop_publish_verifications` table with one row per `(sop_id, version_id, sop_section_blocks.id, admin_user_id, action: 'approved'|'declined', flags_acknowledged: jsonb, decided_at)`. `VerifyChecklistGate` component on the builder rendered as a sidebar pane: every block listed, keyboard-driven flow (`j`/`k`/`a`/`d`/`Enter` per Spike 004), publish button disabled until `(approved_count === total_blocks) AND (every flagged block has been approved OR declined)`. **No bulk-tick. No trust-score skip. Single admin per pass.**
    - Acceptance: Spike 004's measured flow ports cleanly: a Playwright test approves all 50 blocks via keyboard, publish-button-disabled flips to enabled at 50/50, server-side publish endpoint rejects publish with `400` when any `sop_publish_verifications` row is missing for the current version.

11. **Video provenance via timestamp range**: Video-source blocks anchor to a timestamp range; source viewer scrubs to it.
    - Current: Phase 6 video parser captures transcript per segment with timestamps; no per-block timestamp anchor.
    - Target: `block_provenance.region = {timestamp_start, timestamp_end}` on every block produced from a video source. Source viewer embeds the existing video player + transcript pane (Phase 6 `VideoReviewPanel`); click block → scrub to `timestamp_start`, highlight transcript line(s) in range. Frame-grab thumbnails explicitly deferred (Plan 20-02 enhancement only if pilot reveals need).
    - Acceptance: A Phase 6 transcribed video parses through the V2 pipeline; clicking a step block in the builder scrubs the embedded `<video>` element to `currentTime = timestamp_start`; transcript line at that timestamp gains a `data-active="true"` attribute within 200 ms.

12. **AI-prompt source: Jobs D+E only, no verify checklist**: Phase 14 AI-prompt SOPs flow through a narrower V2 pipeline.
    - Current: Phase 14 AI-drafted SOPs run through `verify-sop.ts` Job A (hallucination) only; publish via existing review surface.
    - Target: AI-prompt SOPs route into the builder (D-CV2-03) but skip Jobs A/B/C (no source document to compare against), run only Jobs D + E, AND **skip the per-block verify checklist gate entirely** — Phase 14's hallucination check + the builder's normal publish flow remain the gate. `source_type='ai_prompt'` is the discriminator.
    - Acceptance: An AI-prompt SOP reaches the builder with `block_provenance.source_type='ai_prompt'` on every block; the `VerifyChecklistGate` component does not render; the reviewer panel shows only D + E flags; publish proceeds via the existing AI-draft path.

## Boundaries

**In scope:**

- PDF embedded-image extraction with `{page, bbox, pageWidth, pageHeight}` provenance (resolves Phase 2-02 D)
- DOCX `{paragraph_id, run_start, run_end}` provenance capture
- Scan `{image_crop}` provenance capture (already partial in Phase 5 PhotoScanner)
- Video `{timestamp_start, timestamp_end}` provenance (timestamp-only; frame-grab deferred)
- Unified `block_provenance` JSONB column on `sop_section_blocks`
- Parser refactor to emit Puck `layout_data` with provenance per block (DOCX, PDF, scan, video sources)
- Semantic extraction: tables → HazardCard[]/SopTable, diagrams → PhotoBlock or DiagramHotspotBlock (fallback to PhotoBlock if Phase 17 not landed), charts → PhotoBlock + extracted-data
- Block-library matching during extraction (parser proposes link-to-existing alongside write-new; threshold tunable in Plan 20-02 — start at cosine similarity ≥ 0.78 per Phase-13 picker default)
- Retiring `/admin/sops/[sopId]/review` route in favour of `/admin/sops/builder/[sopId]` for ALL parse outputs
- `SourceViewerPane` component (persistent right-pane on desktop) with click-to-highlight bbox/paragraph/timestamp via provenance
- Builder ↔ source bidirectional selection sync
- AI reviewer extension: Jobs B (omission), C (anchoring), D (safety completeness), E (clarity); Job A re-framed for PDF/DOCX/scan sources
- Reviewer auto-trigger on parse + manual re-run button + per-day re-run cap (5/SOP/day)
- `ReviewerFlagsPanel` component surfacing flags per-block in the builder
- `VerifyChecklistGate` component + `sop_publish_verifications` audit table
- Single-admin sign-off per pass (NO multi-role split)
- Backward-compatibility for pre-Phase-20 SOPs: missing `block_provenance` tolerated; viewer pane shows "no source available" placeholder

**Out of scope:**

- **Pixel-faithful PDF/DOCX rendering** — D-CV2-01 chose semantic extraction; reproducing the source layout exactly is explicitly rejected
- **Bulk migration of existing pre-Phase-20 SOPs to layout_data** — separate concern; Phase 20 upgrades the single-SOP path forward, backward-compat tolerates absence of provenance
- **Rung A / Rung B review surfaces** (inline-edit-only / block-swap-only) — D-CV2-03 chose Rung C (full builder); do not re-introduce
- **Bulk-tick or trust-score skip on verify checklist** — D-CV2-04 explicitly forbids
- **Multi-role split sign-off (hazards by safety_manager, steps by supervisor)** — single-pass for Phase 20; Plan 21+ scope
- **AI-prompt source full pipeline** — CONV-12 limits AI-prompt to D+E reviewer + skip verify-checklist; Phase 14 hallucination check remains the publish gate for those
- **Frame-grab thumbnails for video provenance** — timestamp range only in v1; frame-grab is Plan 20-02 enhancement only on pilot demand
- **Mobile/tablet verify-checklist UX** — desktop-only per 2026-05-05 Visy interview; tablet acceptable but no responsive optimisation work
- **Per-org configurable reviewer prompts** — Plan 20-04 ships one universal prompt set; per-tenant customisation is a Phase 21+ enhancement
- **Re-extracting images from already-published pre-Phase-20 SOPs** — only new parses use V2 extraction
- **DiagramHotspotBlock auto-placement of hotspots** — Phase 17 deliverable; Phase 20 falls back to plain `PhotoBlock` if Phase 17 not landed
- **Streaming reviewer flags into the UI** — Plan 20-04 ships flags after full response; streaming is post-MVP

## Constraints

- **Bundle**: ≤ +5 MB to production `next start` bundle for the entire phase (Spike 001 confirms `unpdf.extractImages` + `pdfjs` direct → 0 MB Δ; mupdf-wasm explicitly rejected to keep this margin)
- **Worker RAM**: ≤ 256 MB peak RSS on a 50-page PDF parse (Spike 001 measured 152 MB; budget includes Job A–E reviewer overhead)
- **Parse-pipeline time**: ≤ 30 s per file for the full PDF→layout_data extraction (current Phase 2 budget; unchanged)
- **Reviewer latency**: Job B ≤ 15 s p95, Job C ≤ 8 s p95, total all-five-jobs ≤ 60 s wall (Spike 003 measured B=13 s / C=5 s on Sonnet 4.5; Haiku 4.5 likely faster — Plan 20-04 A/B before lock)
- **Reviewer cost**: ≤ $0.15 USD per SOP per all-five-jobs run on Sonnet pricing; ≤ $0.03 on Haiku (Spike 003 measured $0.06 for B+C alone)
- **Source viewer click-to-highlight**: ≤ 200 ms p95 (Spike 002 measured 33 ms)
- **Verify checklist**: ≤ 4 minutes per 50-block SOP at careful admin pace (Spike 004 measured 2.5 min; budget allows 60 % overhead for real-admin pace)
- **Bundle-safe libraries only**: No `@napi-rs/canvas`, no `gm`/`pdf2pic`, no Python sidecar, no external extraction services (D-CV2-02 + Spike 001 rationale)
- **Anthropic SDK**: Reuse the existing `verify-sop.ts` lazy-init singleton + `fetch` indirection pattern (Phase 15 fix preserved)
- **Prompt caching**: All reviewer jobs that share a source-content prefix MUST use `cache_control: {type: 'ephemeral'}` on the source block; system prompts may differ across jobs (cache miss intra-run is acceptable, inter-run cache hits required)
- **Railway**: Pure-JS implementation, no manual nixpack pkg pins added (per Spike 001 verdict)
- **Backwards compatibility**: Pre-Phase-20 SOPs without `block_provenance` open in the builder without error; source viewer renders "no source available" placeholder; verify checklist computes against current block set (no historic backfill required)
- **Phase 17 dependency**: `DiagramHotspotBlock` is consumed if landed; Plan 20-02 falls back to `PhotoBlock` if not

## Acceptance Criteria

- [ ] PDF parse of a 17-page real industrial-SOP PDF produces ≥ 37 PhotoBlocks each with `block_provenance.region = {page, bbox: [x0,y0,x1,y1], pageWidth, pageHeight}`
- [ ] `sop_section_blocks.block_provenance` column added with `CHECK (source_type IN ('docx','pdf','scan','video','ai_prompt'))` constraint
- [ ] DOCX parse populates `block_provenance.region = {paragraph_id, run_start, run_end}` per block
- [ ] Scan parse populates `block_provenance.region = {image_crop: [x0,y0,x1,y1]}` per block
- [ ] Video parse populates `block_provenance.region = {timestamp_start, timestamp_end}` per block
- [ ] Parser writes Puck `layout_data` on `sops` row; opening a parsed SOP in `/admin/sops/builder/[sopId]` loads the canvas without re-parsing
- [ ] `/admin/sops/[sopId]/review` route returns 410 OR redirects to the builder; ReviewClient.tsx is removed or marked deprecated with a console warning
- [ ] `SourceViewerPane` renders on desktop alongside the builder canvas; mobile-responsive collapses to drawer
- [ ] Click any block in the builder → source viewer scrolls + paints bbox overlay in ≤ 200 ms p95 (Spike 002 fixture, 50 clicks)
- [ ] Reviewer Job B catches the Spike 003 dropped-safety-step injection with `severity:critical` and `source_location_hint` citing at least one source page where the warning appears
- [ ] Reviewer Job C catches the Spike 003 swapped-photo injection with correct `photo_id` + `suggested_step_id`
- [ ] Reviewer Job D flags a draft with zero Hazards-category blocks as `severity:critical`
- [ ] Reviewer Job E flags a step containing a 60-word sentence as `severity:warning`
- [ ] All five reviewer jobs run in one HTTP session with `cache_control: 'ephemeral'` on the source block; the second job onward hits cache (`cache_read_input_tokens > 0`)
- [ ] Per-day reviewer re-run on a single SOP returns 429 on the 6th attempt within a calendar day
- [ ] `ReviewerFlagsPanel` renders inline beneath each affected block in the builder; clicking a flag scrolls both panes (builder + source viewer) to the flag's target
- [ ] `sop_publish_verifications` table created; every approve/decline writes one row with `{block_id, admin_user_id, action, flags_acknowledged, decided_at}`
- [ ] `VerifyChecklistGate` keyboard flow: `j`/`k` navigate, `a` approve, `d` decline, `Enter` view source; all wired
- [ ] Publish endpoint returns 400 when any `sop_publish_verifications` row is missing for the current version's blocks
- [ ] Publish endpoint returns 400 if any flagged block lacks an approve OR decline entry
- [ ] No bulk-tick UI affordance exists in the checklist; no "approve all flagged" or "trust score ≥ N skips block" button anywhere
- [ ] AI-prompt SOP routes into the builder with `block_provenance.source_type='ai_prompt'` on every block; `VerifyChecklistGate` does NOT render for AI-prompt source; reviewer panel shows only D + E flags
- [ ] No new prod dependency beyond what's already in package.json (`unpdf`, `pdfjs-dist` via unpdf, `@anthropic-ai/sdk` all present)
- [ ] Postbuild bundle-size CI gate (`scripts/check-bundle-size.ts`) shows Δ ≤ +5 MB after the phase merges
- [ ] No reference to `@napi-rs/canvas`, `pdf2pic`, or `gm` appears in `package.json`, `package-lock.json`, or `next.config.ts` `serverExternalPackages`
- [ ] Pre-Phase-20 SOPs (with no `block_provenance`) open in the builder without error; source viewer renders "no source available" placeholder

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                |
|--------------------|-------|------|--------|----------------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | 8 roadmap success criteria + 7 locked D-CV2-* decisions + 4 spikes   |
| Boundary Clarity   | 0.92  | 0.70 | ✓      | Explicit out-of-scope across 3 layers + 3 spec-time scope decisions  |
| Constraint Clarity | 0.78  | 0.65 | ✓      | All four spikes provided numeric constraint floors                   |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 25 pass/fail criteria, each traceable to a Requirement or constraint |
| **Ambiguity**      | 0.129 | ≤0.20| ✓      | Comfortably under gate                                               |

## Interview Log

| Round | Perspective                | Question summary                                                          | Decision locked                                                                                                  |
|-------|----------------------------|---------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| 0     | Pre-interview synthesis    | Initial ambiguity from ROADMAP + exploration notes + 4 VALIDATED spikes  | Goal/Boundary/Constraint/Acceptance all ≥ minimum; ambiguity = 0.202 (just over gate)                            |
| 1     | Boundary Keeper + Closer   | AI-prompt source scope: which Phase 20 layers apply?                      | Skip A/B/C, run D+E only, SKIP verify-checklist gate (CONV-12); Phase 14 hallucination check remains publish gate |
| 1     | Boundary Keeper + Closer   | Video-source provenance: timestamp range, frame-grab, or both?            | Timestamp range only (CONV-11); frame-grab deferred to Plan 20-02 enhancement only on pilot demand               |
| 1     | Boundary Keeper + Closer   | Verify-checklist role split (Visy multi-role admin chain)                 | Single-pass for Phase 20 (CONV-10); multi-role split flagged as Phase 21+ scope-out                              |

**Open scope decisions deferred to Plan 20-XX (tunable parameters, not feasibility):**

- Block-library matching threshold (open decision #3 in ROADMAP) — Plan 20-02 implementation: start at cosine similarity ≥ 0.78 per Phase 13 picker default; tune empirically against Visy corpus
- Reviewer cost cap policy (open decision #5 in ROADMAP) — CONV-09 sets per-day 5 re-runs/SOP; per-org token budget unlimited until pilot reveals abuse

---

*Phase: 20-conversion-pipeline-v2*
*Spec created: 2026-05-15*
*Next step: /gsd-discuss-phase 20 — implementation decisions (extractor library wiring, parser refactor architecture, builder ↔ source sync mechanism, reviewer job orchestration, audit-table schema details)*
