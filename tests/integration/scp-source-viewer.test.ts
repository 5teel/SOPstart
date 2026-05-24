/**
 * SCP-VIEWER-01..05 — Side-by-side source viewer (Phase 21, Wave 0 stubs).
 *
 * Wave 0 contract:
 *   - All cases are `test.fixme` so CI stays green.
 *   - Each case names its SCP-XX requirement in the title.
 *   - Each body documents the acceptance criteria so the Wave 2 executor can
 *     flip `fixme` → live by reading this file alone (no need to chase the
 *     spec while implementing).
 *
 * Pre-locked design contract (see `.planning/phases/21-safety-critical-parsing/21-CONTEXT.md`):
 *   - D-CV2-03: review surface = full builder (legacy /admin/sops/[sopId]/review retires).
 *   - D-CV2-04: verification = three independent layers (viewer + AI reviewer + per-block checklist).
 *   - Spike 002 validated: pdfjs.getDocument + per-page <canvas> + DOM overlay via
 *     `viewport.convertToViewportRectangle`. **33 ms click → overlay** (6× under
 *     200 ms p95 budget).
 *
 * Implementing per D-21-10 (Wave 0 stubs land first, all test.fixme).
 */
import { test, expect } from '@playwright/test'

test.describe('SCP-VIEWER — side-by-side source viewer (Phase 21)', () => {
  test.fixme('SCP-VIEWER-01: source PDF / DOCX / image rendered alongside parsed blocks in builder', async ({ page }) => {
    // Acceptance (from REQUIREMENTS.md § v4.0 → SCP-VIEWER-01 and 20-SPEC § 3.1):
    //   - Builder route `/admin/sops/builder/[sopId]` renders a two-pane layout:
    //     left pane = parsed Puck blocks, right pane = original source document.
    //   - Source document rendered via pdfjs.getDocument + per-page <canvas>
    //     (Spike 002 production approach).
    //   - DOCX sources render via the same pdfjs canvas pipeline after server-side
    //     DOCX → PDF conversion (or DOCX page-rasterisation fallback).
    //   - Image-only SOPs render the original bitmap with annotation overlay support.
    expect(page).toBeDefined()
  })

  test.fixme('SCP-VIEWER-02: clicking parsed block scrolls source viewer to exact passage', async ({ page }) => {
    // Acceptance (from 20-SPEC § 3.2 + Spike 002 perf budget):
    //   - Click on a parsed block in the left pane scrolls the right pane to the
    //     source region recorded in `block_provenance.region` (page + bbox).
    //   - Highlight overlay drawn via `viewport.convertToViewportRectangle` on the
    //     pdfjs canvas — same DOM-overlay approach validated in Spike 002.
    //   - p95 click → overlay visible MUST be ≤ 200 ms (Spike 002 measured 33 ms,
    //     6× under budget — this is the regression watermark).
    const clickToOverlayBudgetMs = 200
    expect(clickToOverlayBudgetMs).toBeGreaterThan(0)
    expect(page).toBeDefined()
  })

  test.fixme('SCP-VIEWER-03: clicking source region highlights corresponding parsed block', async ({ page }) => {
    // Acceptance (from 20-SPEC § 3.3, bidirectional linkage):
    //   - Click on any region of the source document (right pane) finds the parsed
    //     block whose `block_provenance.region` contains the click coordinates
    //     and applies a highlight class to that block in the left pane.
    //   - Multiple blocks claiming overlapping regions: pick the smallest containing
    //     region (most-specific match wins).
    //   - Clicking source whitespace (no block claims it) clears any active highlight.
    expect(page).toBeDefined()
  })

  test.fixme('SCP-VIEWER-04: source viewer persistent throughout review (not modal, not dismissible)', async ({ page }) => {
    // Acceptance (from 20-SPEC § 3.4 — anti-pattern protection):
    //   - Source viewer renders as a fixed pane in the builder layout, NOT as a
    //     dialog/modal/popover that can be dismissed.
    //   - No "Close viewer" or "Hide source" button exists in the builder chrome.
    //     This is a hard UX gate: an admin who can dismiss the source can verify
    //     blocks without ever reading the original — defeats the verification layer.
    //   - Assert: `await page.locator('[data-testid="source-viewer-close"]').count() === 0`
    //   - Assert: source viewer pane is visible on initial builder load AND remains
    //     visible after scrolling, after block edits, and after AI reviewer runs.
    const closeButtons = 0
    expect(closeButtons).toBe(0)
    expect(page).toBeDefined()
  })

  test.fixme('SCP-VIEWER-05: source viewer works uniformly for DOCX, PDF, image, and video-transcript formats', async ({ page }) => {
    // Acceptance (from 20-SPEC § 3.5 + CONV-11 video provenance carve-out):
    //   - DOCX source: server converts to PDF (or page-rasterises) and viewer
    //     uses pdfjs canvas pipeline — same UX as native PDF.
    //   - PDF source: pdfjs.getDocument direct render (Spike 002 path).
    //   - Image source: <img> with annotation overlay (no pdfjs needed).
    //   - Video-transcript source: timestamp-range provenance (CONV-11) renders
    //     as scrollable transcript pane with timestamp anchors. Frame-grab
    //     viewer is DEFERRED — Phase 21 video sources are optional.
    //   - All four format viewers expose the same `data-testid="source-viewer"`
    //     contract so the click-to-scroll and click-to-highlight interactions
    //     (SCP-VIEWER-02, -03) are format-agnostic at the test layer.
    expect(page).toBeDefined()
  })
})
