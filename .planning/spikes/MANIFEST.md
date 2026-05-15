# Spike Manifest

## Idea

Phase 20 Conversion Pipeline V2 — safety-critical overhaul of the document → SOP conversion path. Semantic extraction of photos / diagrams / charts / tables with step-level provenance anchoring; parsed drafts land as Puck `layout_data` directly in the Phase 12 builder (review surface retires); three-layer verification (persistent side-by-side source viewer + AI reviewer running 5 jobs auto/manual + mandatory per-block verify checklist at publish gate). Spikes here gate Phase 20 planning.

## Spikes

| # | Name | Validates | Verdict | Tags |
|---|------|-----------|---------|------|
| 001 | [pdf-image-extraction-bundle-safe](001-pdf-image-extraction-bundle-safe/README.md) | Bundle-safe PDF embedded-image extraction with `{page, bbox}` provenance on Railway under Node 20 | ✓ VALIDATED — `unpdf.extractImages` for bytes + `pdfjs-direct` op-list+CTM walk for bbox; 0 MB bundle Δ; clears all thresholds | phase-20, conversion-pipeline-v2, pdf, extraction, plan-20-01-gate |
| 002 | [source-viewer-bbox-highlight](002-source-viewer-bbox-highlight/README.md) | Click block in builder → side-by-side PDF viewer scrolls + paints bbox highlight in ≤ 200 ms | ✓ VALIDATED — pdfjs render + DOM overlay + `viewport.convertToViewportRectangle`; 33 ms click→overlay on 17-page PDF (6× under budget); 0 MB new deps | phase-20, conversion-pipeline-v2, source-viewer, layer-1-verification, plan-20-03-gate |
