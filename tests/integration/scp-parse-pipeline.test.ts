/**
 * SCP-PARSE-01..04 — Phase 20 conversion-pipeline contract (Phase 21, Wave 0 stubs).
 *
 * These four cases lock the integration contract between the Phase 20-shipped
 * parser pieces (commits 7b9151e, c4f9b9a, e33669e, c47baa7, 064e819 — see
 * 21-CONTEXT.md "Already shipped") and the Phase 21 verification layers.
 *
 * Wave 0 contract:
 *   - All cases are `test.fixme` so CI stays green.
 *   - Wave 1 (Plan 21-01) flips PARSE-01 + PARSE-02 to live as `block_provenance`
 *     migration 00032 ships.
 *   - Wave 2 (Plan 21-02) flips PARSE-03 live as the source-viewer mounts in the
 *     builder review surface.
 *   - Wave 3 (Plan 21-03) flips PARSE-04 live as AI reviewer auto-invocation lands.
 *
 * Implementing per D-21-10 (Wave 0 stubs land first, all test.fixme).
 */
import { test, expect } from '@playwright/test'

test.describe('SCP-PARSE — Phase 20 contract integration (Phase 21)', () => {
  test.fixme('SCP-PARSE-01: photos/diagrams/charts/tables extracted with step-level provenance metadata', async () => {
    // Acceptance (from REQUIREMENTS.md § v4.0 → SCP-PARSE-01, 20-SPEC § 2.6, D-CV2-06):
    //   - Every extracted block (photo, diagram, chart, table, text) carries a
    //     `block_provenance` JSONB column on `sop_section_blocks`.
    //   - Shape: { source_type, region: { page, bbox: [x0,y0,x1,y1] }, parser_run_id, parser_version }
    //   - source_type ∈ { 'docx' | 'pdf' | 'image' | 'video-transcript' }
    //   - Migration 00032 (Plan 21-01 Task 1) creates the nullable column —
    //     existing rows survive with NULL.
    //   - Step-level granularity: a block's provenance.region MUST resolve to the
    //     specific step/paragraph in the source, NOT just the page/document.
    //   - Spike 001 production approach: `unpdf.extractImages(freshUint8Array, p)`
    //     for bytes + pdfjs op-list + CTM for bbox derivation. **Fresh new
    //     Uint8Array(buf) per call** (CLAUDE.md learning — pdfjs structured-clone bug).
    const provenance = {
      source_type: 'pdf',
      region: { page: 1, bbox: [0, 0, 100, 100] },
    }
    expect(provenance).toMatchObject({
      source_type: expect.any(String),
      region: expect.any(Object),
    })
  })

  test.fixme('SCP-PARSE-02: parsed drafts land directly as Puck layout_data in builder', async () => {
    // Acceptance (from REQUIREMENTS.md § v4.0 → SCP-PARSE-02, D-CV2-03):
    //   - After a successful parse, the SOP appears in the builder route
    //     `/admin/sops/builder/[sopId]` with `sop_sections.layout_data` populated
    //     with Puck-compatible block tree (StepWithPhotosBlock, PhotoGridBlock, etc.
    //     from commit c47baa7).
    //   - Legacy `/admin/sops/[sopId]/review` redirects to the builder (D-CV2-03).
    //   - No intermediate "review then promote" step — parsed = draft = builder-editable.
    //   - layout_data photo URLs MUST be signed via the private `sop-images`
    //     bucket flow (commit 064e819).
    expect(true).toBe(true)
  })

  test.fixme('SCP-PARSE-03: side-by-side source viewer integrated into builder review surface', async ({ page }) => {
    // Acceptance (from REQUIREMENTS.md § v4.0 → SCP-PARSE-03, D-CV2-04):
    //   - The builder route mounts the source viewer pane defined by SCP-VIEWER-01..05
    //     directly into its layout — NOT as a separate /review-source/ route.
    //   - First-load JS budget for the builder route MUST NOT regress more than
    //     5 KB versus pre-Phase-21 baseline (Spike 001 + 002 measured 0 KB Δ).
    //   - The viewer pane is mounted by the builder shell so PARSE-03 = SCP-VIEWER-01
    //     observed at the route boundary (not at the component boundary).
    expect(page).toBeDefined()
  })

  test.fixme('SCP-PARSE-04: AI reviewer auto-runs as part of parse pipeline', async () => {
    // Acceptance (from REQUIREMENTS.md § v4.0 → SCP-PARSE-04, SCP-AI-06, D-CV2-05):
    //   - On successful parse completion, the AI reviewer (all five jobs A–E
    //     per D-CV2-05) auto-invokes WITHOUT admin clicking "run reviewer".
    //   - Reviewer results land in `sop_review_runs` keyed by `parse_run_id`
    //     BEFORE the SOP transitions out of `parsing` status.
    //   - Per-org daily spend cap (CONV-09: 5 re-runs/SOP/day) governs the
    //     auto-run too — if cap exhausted, parse pipeline records reviewer
    //     status='skipped:cap_exceeded' and continues.
    //   - This is the contract that SCP-AI-06 verifies from the UI side; this
    //     case verifies it from the pipeline side.
    expect(true).toBe(true)
  })
})
