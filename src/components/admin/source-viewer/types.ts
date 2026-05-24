/**
 * Phase 21 (Plan 21-02, Task 1) — Source viewer UI types.
 *
 * Re-exports the parser-side provenance types from Wave 1
 * (`src/lib/parsers/source-viewer/types.ts`) and adds UI-layer types that
 * live only in the admin source-viewer component family.
 */

export type {
  SourceProvenanceRegion,
  ExtractedSourceBlock,
} from '@/lib/parsers/source-viewer'

import type { SourceProvenanceRegion } from '@/lib/parsers/source-viewer'

/**
 * Subset of pdfjs's PageViewport surface we actually consume in the canvas
 * + overlay code. Mirrors the shape returned by `page.getViewport({scale})`
 * — kept narrow so we don't drag the pdfjs type bundle into the
 * component file.
 */
export type CanvasViewport = {
  width: number
  height: number
  transform: number[]
  scale: number
  convertToViewportRectangle: (b: number[]) => number[]
}

/**
 * A currently-active bbox highlight on a canvas page. `createdAt` is used
 * by the pulse animation cleanup heuristic.
 */
export type ActiveBbox = {
  blockId: string
  region: SourceProvenanceRegion
  createdAt: number
}

/**
 * Source kinds the pane can render. Matches the discriminated union on
 * `SourceProvenanceRegion` minus `ai_prompt` (which renders no pane —
 * CONV-12 carve-out). The mapping from `sops.source_file_type` →
 * `SourcePaneKind` happens in `BuilderWithSourceViewer.tsx`.
 */
export type SourcePaneKind = 'pdf' | 'docx' | 'scan' | 'video'

/**
 * API contract for `GET /api/sops/[sopId]/source-url`.
 *  - `url`: 5-minute signed URL into the private bucket.
 *  - `expires_at`: ISO 8601 expiry timestamp for the URL.
 *  - `source_type`: client-derived hint matching `SourcePaneKind`. May be
 *    null when the SOP has no `source_file_path` (pre-Phase-20 SOPs or
 *    AI-prompt SOPs) — viewer shows "no source available" placeholder.
 */
export type SourceUrlResponse = {
  url: string | null
  expires_at: string | null
  source_type: SourcePaneKind | null
}
