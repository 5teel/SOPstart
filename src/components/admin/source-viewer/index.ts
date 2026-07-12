/**
 * Phase 21 (Plan 21-02, Task 2) — admin source-viewer barrel.
 *
 * Public surface — consumed by the admin builder shell chain
 * (BuilderStageShell → ReviewStation); pdfjs stays out of the worker bundle
 * (D-21-09 — enforced by scripts/check-bundle-size.ts marker scan).
 *
 * DO NOT statically import this module from any worker-side route.
 */
export { SourceViewerPane, type SourceViewerPaneProps } from './SourceViewerPane'
export {
  useSelectionSync,
  SourceViewerSelectionContext,
  SourceViewerSelectionProvider,
  type SourceViewerSelectionContextValue,
  type BlockClickHandler,
} from './useSelectionSync'
export type {
  SourceProvenanceRegion,
  ExtractedSourceBlock,
  CanvasViewport,
  ActiveBbox,
  SourcePaneKind,
  SourceUrlResponse,
} from './types'
export { BboxOverlay, BboxOverlayStyles } from './BboxOverlay'
export { PdfCanvasPage } from './PdfCanvasPage'
export { DocxPreview } from './DocxPreview'
export { VideoSourcePreview, type TranscriptSegment } from './VideoSourcePreview'
