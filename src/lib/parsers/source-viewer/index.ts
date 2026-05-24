/**
 * Phase 21 (Plan 21-01 Task 2) — source-viewer barrel export.
 *
 * Public surface consumed by:
 *  - Wave 2 admin source-viewer panel (pdfjs DOM overlay UI)
 *  - Wave 3 AI reviewer Job C anchoring (bbox-aware step-image alignment)
 *  - The parser write path (populates sop_section_blocks.block_provenance)
 */

export type {
  SourceProvenanceRegion,
  ExtractedSourceBlock,
} from './types'

export { extractPdfBlockBboxes } from './extract-pdf-bbox'
export { extractDocxParagraphAnchors } from './extract-docx-paragraph'
