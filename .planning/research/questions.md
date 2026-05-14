# Open Research Questions

Open questions surfaced during planning/exploration that need investigation before specific phases can commit to an approach. Resolved questions are removed (their answer lands in the relevant phase's decisions or CLAUDE.md learnings).

---

## RQ-2026-05-14-01 — Unified provenance metadata shape across source formats

**Surfaced:** /gsd-explore session 2026-05-14 — Conversion Pipeline V2
**Gates:** Phase 20 Plan 20-01 (provenance schema + extraction)

**Question:** What is the right provenance metadata shape to anchor a parsed block back to its source region, given that "source region" means radically different things across the five upload paths?

| Source | What "source region" means | Storable as |
|---|---|---|
| DOCX | A run/range inside a paragraph | `{paragraph_id, run_start, run_end}` |
| PDF (text) | A character range on a page | `{page, char_start, char_end}` or `{page, bbox: [x0,y0,x1,y1]}` |
| PDF (image) | A page region with embedded image | `{page, bbox: [x0,y0,x1,y1], image_ref}` |
| Scan | A crop region in a single bitmap | `{image_crop: [x0,y0,x1,y1]}` — but multi-page scans? Per-page index too? |
| Video | A timestamp range, plus optionally a frame | `{timestamp_start_ms, timestamp_end_ms, frame_thumb?}` |
| AI prompt | The prompt text — no source region exists | `{prompt_text}` or degenerate `null` |

**Sub-questions:**

1. **Single unified JSONB schema or per-source-format adapter?** Unified means every consumer (source viewer, AI reviewer, verify checklist) has one shape to read. Adapter means each format gets a typed sub-shape and a discriminator. Trade-off: schema discipline vs. consumer-side ergonomics.

2. **What's the click-to-highlight contract?** SourceViewerPane needs to map a provenance record back to a visible highlight. For DOCX run-ids that means rendering the DOCX as styled HTML and tagging runs. For PDF bbox that means overlay rects on a `pdfjs` canvas. For video that means seeking to timestamp. Each is a different renderer — does provenance schema dictate which renderer to load?

3. **Storage placement** — on `sop_section_blocks` (per-junction, one provenance per SOP usage) or on `block_versions` (block-level, same provenance regardless of which SOP uses the block)? Phase 13 follow-latest semantics mean blocks can be re-used across SOPs — provenance is intrinsically tied to *this* parse of *this* source, not to the block itself, so `sop_section_blocks` looks right. Confirm.

4. **AI prompt source** — does it need a provenance record at all? Jobs A (hallucination) and B (omission) are degenerate when "source" IS the prompt. Could justify a `source_type: 'ai_prompt'` marker that signals AI reviewer to skip A/B/C and only run D/E. See open scope decision 1 in `ROADMAP.md` § Phase 20.

**Suggested investigation path:** Short research pass (~30 min) comparing how Notion, Airtable, and Coda model "source link" metadata across multi-format ingestion. They've all solved similar shape problems. Then a 1-hour design doc proposing the unified shape, validated against the SourceViewerPane consumer contract.

**Status:** Open. Resolve before Plan 20-01 commits.
