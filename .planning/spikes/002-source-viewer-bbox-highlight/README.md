---
spike: 002
name: source-viewer-bbox-highlight
validates: "Given a parsed SOP block carrying {page, bbox} provenance from Spike 001, when admin clicks the block in the builder sidebar, then the side-by-side PDF viewer scrolls to that page and paints a visible bbox highlight in ≤ 200 ms."
verdict: VALIDATED
related: ["001-pdf-image-extraction-bundle-safe"]
tags: [phase-20, conversion-pipeline-v2, source-viewer, layer-1-verification, plan-20-03-gate]
date_completed: 2026-05-15
gates: phase-20-plan-20-03
---

# Spike 002: Source-Viewer BBox Highlight

## What This Validates

D-CV2-04 Layer 1 of Conversion Pipeline V2 verification is the persistent side-by-side source viewer with click-to-highlight provenance. If pdfjs (already a dep via `unpdf`) can't render the PDF + overlay a bbox + scroll-into-view fast enough that an admin notices no latency, the whole "human eyes Layer 1" collapses and Phase 20 needs a different review surface.

This spike answers: **can a vanilla pdfjs-dist + DOM overlay implementation hit the ≤ 200 ms click-to-highlight target on every corpus PDF Spike 001 produced?**

## How to Run

```powershell
cd C:\Development\SOPstart; node .planning/spikes/002-source-viewer-bbox-highlight/experiment/measure.mjs
```

The runner spawns a tiny static server (`server.mjs`) on port 4321 that serves the harness page, the local pdfjs build, the Spike 001 corpus, and the Spike 001 `_report.json` files (which already carry real `{page, bbox}` extracted from real industrial-SOP PDFs). It then drives Playwright with system Chrome (`channel: "chrome"` or fallback `executablePath`) — no chromium download needed, sidesteps the corporate TLS cert intercept that blocks `npx playwright install`.

For each corpus PDF, Playwright:

1. Opens the harness with the right `?pdf=&report=` query
2. Waits for `window.__spike002.ready` (= all pages rendered as canvas + sidebar populated)
3. Clicks 5 evenly-spread blocks programmatically
4. Records `clickToOverlayMs` from the harness's per-click timing instrumentation
5. Captures a settle-screenshot for human inspection

## What to Expect

- `results/results.csv` — one row per PDF with `pageReadyMs`, `avgClickToOverlayMs`, `maxClickToOverlayMs`
- `screenshots/<pdf>.png` — visual proof the yellow bbox highlight lands on the right region on the right page

## Results

### Per-PDF measurements

| PDF | Pages | Blocks | Page-ready ms | Avg click→overlay ms | Max click→overlay ms | Threshold ≤ 200 ms |
|---|---:|---:|---:|---:|---:|:---:|
| `large-rondot-probe.pdf` (4.4 MB) | 17 | 37 | 606 | **33.3** | 33.4 | ✅ |
| `medium-forming-swabbing.pdf` (1.6 MB) | 19 | 44 | 586 | **33.2** | 33.4 | ✅ |
| `real-plenum-chamber.pdf` (0.4 MB) | 2 | 7 | 314 | **33.3** | 33.3 | ✅ |
| `small-forming-safety.pdf` (0.14 MB) | 6 | 0 | 307 | — (no images) | — | ✅ |

### Visual proof

`screenshots/medium-forming-swabbing.png` shows the harness with the yellow `border + 35 %-alpha fill` overlay correctly landed on a step's swab-cycle photo on a mid-document page. Sidebar shows all 44 extracted blocks with their `(page, bbox)` provenance, viewer is scrolled to the right page, overlay is on the right region of the right image.

### Methodology note on the 33 ms figure

`clickToOverlayMs` is measured via `performance.now()` between the click and a `requestAnimationFrame(() => requestAnimationFrame(...))` after the overlay is appended + `scrollIntoView` is called. **33 ms ≈ 2 × 16.6 ms = 2 frame budgets at 60 Hz** — which is exactly what the measurement instrument enforces. The *real* underlying click→paint cost is lower than 33 ms; the measurement intentionally rounds up to 2 RAFs to mark "the user can definitely see the highlight now." For the threshold question (`≤ 200 ms`), it doesn't matter — every result is 6× under budget.

## Key discoveries

| # | Discovery |
|---|---|
| 1 | **`viewport.convertToViewportRectangle(bbox)` is the right primitive** for converting a PDF user-space bbox into canvas-pixel coordinates. pdfjs already handles the y-axis flip (PDF origin is bottom-left, DOM is top-left) and rotation. The mapping output may have reversed x or y depending on rotation — always normalise with `min`/`max` over the 4 components. |
| 2 | A vanilla `<canvas>` per page in a flex-column scrollable container is fast enough on the real corpus — no virtualisation needed for a 17-page document. If Phase 20 admin SOPs grow to 100+ pages, revisit (e.g. only render visible pages, render placeholders for off-screen pages). |
| 3 | `scrollIntoView({behavior: "auto"})` happens synchronously enough that the next-RAF overlay paint sits in the same animation tick as the scroll — there is no perceivable "scroll first, highlight second" stutter. Plan 20-03 can rely on this. |
| 4 | The Playwright + system-Chrome (`channel: "chrome"`) approach **works around the corporate TLS cert intercept** that blocks `npx playwright install chromium`. This is a re-usable harness pattern for any future browser-driven UI spike on this machine — landed alongside the Spike 001 mammoth+Chrome corpus-conversion pattern. |
| 5 | When fetching nested paths through a query-string-encoded URL parameter, **encode each path segment separately** — `encodeURIComponent("dir/_report.json")` escapes the slash to `%2F` and breaks downstream routing. The pattern: `path.split("/").map(encodeURIComponent).join("/")`. Plan 20-03 will hit this whenever it routes block IDs / page indices through URL state. |

## Feasibility assessment

Phase 20 D-CV2-04 Layer 1 (persistent side-by-side viewer with click-to-highlight) is feasible with the existing dependency set. **Zero new prod deps required** — pdfjs-dist already ships via `unpdf`. The 33 ms click-to-overlay budget is 6× under the 200 ms threshold; even an admin laptop with a 30 Hz refresh would clear it.

## Signal for the build (Plan 20-03)

1. Use `pdfjs.getDocument(url).promise` + per-page `getViewport({scale: 1.25})` + `<canvas>` render. Scale 1.25 trades a small RAM cost for legible rendering on a typical 1080p monitor — Plan 20-03 should make scale a setting (1.0–2.0 range).
2. **DO NOT** render all pages eagerly if expected admin SOPs exceed ~50 pages — bail to an intersection-observer-driven lazy-render approach. The corpus today (max 19 pages) doesn't need this; a Visy 100-step SOP might.
3. Block→bbox mapping uses `viewport.convertToViewportRectangle(bbox)` exactly as in `harness.js`. Normalise min/max over the returned 4 components — don't assume directionality.
4. Plan 20-01 emits provenance shaped `{page, bbox: [x0, y0, x1, y1]}`; Plan 20-03 stores `pageWidth`/`pageHeight` from `page.getViewport({scale: 1})` on either the block (per D-CV2-06) or — preferably — derives it live at render time so a re-rendered PDF doesn't need backfill on a CTM change.
5. Overlay = `position: absolute` `<div>` inside a relatively-positioned `page-wrap` containing the canvas. **Do not** draw the overlay onto the canvas — keep it in DOM so it can carry hover state, click handlers, animations, and accessibility hooks (Plan 20-03 wants click-on-overlay-from-PDF-side to reverse-highlight the block in the sidebar, which is much easier as a DOM event).
6. The two-RAF settle pattern in `harness.js` is the right way to wait for "user can see it" before measuring or auto-scrolling secondary state — keep it in the production code path.

## Out-of-scope for this spike (deferred to Plan 20-03)

- Reverse highlight (click bbox in PDF → highlight block in sidebar)
- Hover state on overlay
- Multi-page block (block whose bbox spans page boundaries — unlikely in practice but possible for tables)
- Annotation persistence (Spike addresses real-time interaction only)
- Mobile-responsive layout (D-CV2-04 Layer 1 is desktop-only by design — per 2026-05-05 Visy interview, admin work is desktop)
- Accessibility audit on overlay (Plan 20-03 owns AA-compliant focus indicators)
