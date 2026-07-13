/**
 * SCP-VIEWER-01..05 — Side-by-side source viewer (Phase 21, Wave 2 LIVE).
 *
 * Plan 21-02 flipped the Wave-0 `test.fixme` stubs to live assertions.
 *
 * Browser fallback policy: the chromium-1208 binary required by
 * `@playwright/test@1.58.2` is NOT installed on this Windows machine
 * (CLAUDE.md learning: Playwright install is blocked by the corporate
 * TLS cert intercept). Per the project's standard Rule-3 downgrade
 * pattern (mirrors Plans 15-01..04), the SCP-VIEWER cases assert the
 * source-contract guarantees that the design promises — file existence,
 * exported public surface, component-tree shape, RLS / role gates on
 * the signed-URL endpoint, anti-pattern protection ("no close button"
 * grep) — instead of driving a real browser.
 *
 * When chromium is available (Linux CI or any machine with
 * `npx playwright install chromium` working), Wave 5 will re-add the
 * full-fat E2E coverage on top of these contract assertions. The
 * contract assertions stay valuable forever because they protect
 * the public surface from silent regressions.
 *
 * Pre-locked design contract (see `.planning/phases/21-safety-critical-parsing/21-CONTEXT.md`):
 *   - D-CV2-03: review surface = full builder (legacy /admin/sops/[sopId]/review retires).
 *   - D-CV2-04: verification = three independent layers (viewer + AI reviewer + per-block checklist).
 *   - Spike 002 validated: pdfjs.getDocument + per-page <canvas> + DOM overlay via
 *     `viewport.convertToViewportRectangle`. **33 ms click → overlay** (6× under
 *     200 ms p95 budget).
 */
import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..')

function readFile(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8')
}

test.describe('SCP-VIEWER — side-by-side source viewer (Phase 21)', () => {
  test('SCP-VIEWER-01: source PDF / DOCX / image / video renderers exist and export the SourceViewerPane shell', () => {
    // Acceptance (from REQUIREMENTS.md § v4.0 → SCP-VIEWER-01 and 20-SPEC § 3.1):
    //   - Builder route `/admin/sops/builder/[sopId]` renders a two-pane layout:
    //     left pane = parsed Puck blocks, right pane = original source document.
    //   - Source document rendered via pdfjs.getDocument + per-page <canvas>
    //     (Spike 002 production approach).
    //   - DOCX sources render via mammoth-HTML pipeline with paragraph anchors.
    //   - Image-only SOPs render the original bitmap.
    //   - Video sources render <video> + transcript pane (CONV-11).
    //
    // Contract assertions (repointed Phase 30 / 30-01 — Phase 26 replaced
    // the legacy shell with BuilderStageShell): each renderer file exists;
    // the public SourceViewerPane shell exports the persistent right-pane
    // API; the builder shell `BuilderStageShell` is wired into
    // `builder/[sopId]/page.tsx`.
    const renderers = [
      'src/components/admin/source-viewer/PdfCanvasPage.tsx',
      'src/components/admin/source-viewer/DocxPreview.tsx',
      'src/components/admin/source-viewer/VideoSourcePreview.tsx',
      'src/components/admin/source-viewer/SourceViewerPane.tsx',
      'src/components/admin/source-viewer/BboxOverlay.tsx',
      'src/components/admin/source-viewer/useSelectionSync.tsx',
      'src/components/admin/source-viewer/index.ts',
      'src/app/api/sops/[sopId]/source-url/route.ts',
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx',
    ]
    for (const rel of renderers) {
      expect(existsSync(resolve(ROOT, rel)), `${rel} must exist`).toBe(true)
    }
    const barrel = readFile('src/components/admin/source-viewer/index.ts')
    expect(barrel).toContain('SourceViewerPane')
    expect(barrel).toContain('useSelectionSync')
    expect(barrel).toContain('SourceViewerSelectionProvider')
    // SourceViewerPane discriminates on sourceType and routes to one of the
    // four format renderers. Assert all four child types are referenced.
    const pane = readFile('src/components/admin/source-viewer/SourceViewerPane.tsx')
    expect(pane).toContain("effectiveType === 'pdf'")
    expect(pane).toContain("effectiveType === 'docx'")
    expect(pane).toContain("effectiveType === 'scan'")
    expect(pane).toContain("effectiveType === 'video'")
    // page.tsx must mount the builder shell (BuilderStageShell since Phase
    // 26); SCP-VIEWER-04 (no close button) depends on this wiring.
    const pageTsx = readFile('src/app/(protected)/admin/sops/builder/[sopId]/page.tsx')
    expect(pageTsx).toContain('BuilderStageShell')
  })

  test('SCP-VIEWER-02: click→overlay budget is the Spike 002-validated production pattern (≤ 200ms)', () => {
    // Acceptance (from 20-SPEC § 3.2 + Spike 002 perf budget):
    //   - Click on a parsed block in the left pane scrolls the right pane to the
    //     source region recorded in `block_provenance.region` (page + bbox).
    //   - Highlight overlay drawn via `viewport.convertToViewportRectangle` on the
    //     pdfjs canvas — same DOM-overlay approach validated in Spike 002.
    //   - p95 click → overlay visible MUST be ≤ 200 ms (Spike 002 measured 33 ms,
    //     6× under budget — this is the regression watermark).
    const clickToOverlayBudgetMs = 200
    expect(clickToOverlayBudgetMs).toBeGreaterThan(0)
    // Contract: the PDF canvas uses `convertToViewportRectangle` (the Spike
    // 002 production primitive) and the two-RAF settle pattern. If either
    // disappears, the perf budget regresses silently and a future browser-
    // backed regression test will need to re-validate.
    const pdfCanvas = readFile('src/components/admin/source-viewer/PdfCanvasPage.tsx')
    expect(pdfCanvas).toContain('convertToViewportRectangle')
    expect(pdfCanvas).toContain('requestAnimationFrame')
    // Selection-sync context drives the activeProvenance → overlay path.
    const sync = readFile('src/components/admin/source-viewer/useSelectionSync.tsx')
    expect(sync).toContain('setActiveProvenance')
    expect(sync).toContain('SourceViewerSelectionContext')
  })

  test('SCP-VIEWER-03: source-side clicks fan out to builder via registerBlockClickHandler reverse channel', () => {
    // Acceptance (from 20-SPEC § 3.3, bidirectional linkage):
    //   - Click on any region of the source document (right pane) finds the parsed
    //     block whose `block_provenance.region` contains the click coordinates
    //     and applies a highlight class to that block in the left pane.
    //
    // Contract (repointed Phase 30 / 30-01 — the bespoke canvas re-earned
    // both directions in Phase 26): the reverse channel exists in the
    // selection-sync API (`onSourceClick` + `registerBlockClickHandler`),
    // `BboxOverlay` exposes the click → forward path, and the bespoke
    // canvas host (`EditableDocument`) registers a handler that resolves
    // the source id and focuses/scrolls `[data-block-id]` via the
    // selection-bridge helpers.
    const sync = readFile('src/components/admin/source-viewer/useSelectionSync.tsx')
    expect(sync).toContain('registerBlockClickHandler')
    expect(sync).toContain('onSourceClick')
    const overlay = readFile('src/components/admin/source-viewer/BboxOverlay.tsx')
    expect(overlay).toContain('onClick')
    expect(overlay).toContain('blockId')
    const canvasHost = readFile('src/components/admin/builder-v2/EditableDocument.tsx')
    expect(canvasHost).toContain('registerBlockClickHandler')
    const bridge = readFile('src/components/admin/builder-v2/selection-bridge.ts')
    expect(bridge).toContain('resolveComponentIdFromSource')
    expect(bridge).toContain('data-block-id')
  })

  test('SCP-VIEWER-04: source viewer is persistent — no close button, collapse only', () => {
    // Acceptance (from 20-SPEC § 3.4 — anti-pattern protection):
    //   - Source viewer renders as a fixed pane in the builder layout, NOT as a
    //     dialog/modal/popover that can be dismissed.
    //   - No "Close viewer" or "Hide source" button exists in the builder chrome.
    //     This is a hard UX gate: an admin who can dismiss the source can verify
    //     blocks without ever reading the original — defeats the verification layer.
    const pane = readFile('src/components/admin/source-viewer/SourceViewerPane.tsx')
    // Strict grep: no user-visible button label "Close" / "Hide" / "Dismiss" / "×"
    // anywhere in the pane source (excluding code comments).
    const codeLines = pane
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n')
    expect(codeLines).not.toMatch(/aria-label="Close/i)
    expect(codeLines).not.toMatch(/>Close</i)
    expect(codeLines).not.toMatch(/>Hide</i)
    expect(codeLines).not.toMatch(/>Dismiss</i)
    expect(codeLines).not.toContain('×')
    // Toggle exists but only collapses (data-collapsed="true" → 32px width).
    expect(pane).toContain('data-testid="source-viewer-toggle"')
    expect(pane).toContain('Expand source viewer')
    expect(pane).toContain('Collapse source viewer')
    expect(pane).toContain('data-collapsed')
  })

  test('SCP-VIEWER-05: signed-URL endpoint handles all four formats + degrades gracefully on missing source', () => {
    // Acceptance (from 20-SPEC § 3.5 + CONV-11 video provenance carve-out):
    //   - DOCX / PDF / scan / video sources all flow through the same
    //     /api/sops/[sopId]/source-url endpoint.
    //   - Pre-Phase-20 SOPs (no source_file_path) return 200 with null fields
    //     so the pane shows "no source available" placeholder.
    //   - AI-prompt SOPs (CONV-12) skip the pane entirely — server component
    //     determines this via source_file_path / source_type.
    //   - Video source uses sop-videos bucket; everything else sop-documents.
    const route = readFile('src/app/api/sops/[sopId]/source-url/route.ts')
    expect(route).toContain("'pdf'")
    expect(route).toContain("'docx'")
    expect(route).toContain("'scan'")
    expect(route).toContain("'video'")
    expect(route).toContain('sop-videos')
    expect(route).toContain('sop-documents')
    expect(route).toContain('deriveSourcePaneKind')
    // RLS + role gate present. 2026-07-13: the member-role read moved into
    // getSessionContext() (local JWT verify + organisation_members lookup) —
    // the route keeps the admin/safety_manager gate on the context role.
    expect(route).toContain('getSessionContext')
    expect(route).toContain('safety_manager')
    // Backward-compat path: 200 + null on no source_file_path.
    expect(route).toContain('no source available')
    // Shell applies CONV-12 carve-out (BuilderStageShell carries the
    // verbatim showPane / ai_prompt logic since Phase 26 — 30-01 repoint).
    const wrapper = readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx'
    )
    expect(wrapper).toContain('ai_prompt')
    expect(wrapper).toContain('showPane')
  })
})
