/**
 * Phase 21 (Plan 21-01 Task 2) — source-viewer extraction types.
 *
 * Shared between the parser write path (sop_section_blocks.block_provenance)
 * and the admin-side source-viewer UI (Wave 2). The Zod equivalents live in
 * `src/lib/validators/sop.ts` — keep these TS types in sync.
 *
 * The discriminated union matches the 5 source kinds in CONV-02 / CONV-11 /
 * CONV-12 and the `BlockProvenanceRecordSchema` shape.
 */

export type SourceProvenanceRegion =
  | {
      kind: 'pdf'
      page: number
      bbox: [number, number, number, number]
      pageWidth: number
      pageHeight: number
    }
  | {
      kind: 'docx'
      paragraph_id: string
      run_start: number
      run_end: number
    }
  | {
      kind: 'scan'
      image_crop: [number, number, number, number]
    }
  | {
      kind: 'video'
      timestamp_start: number
      timestamp_end: number
    }
  | {
      kind: 'ai_prompt'
      prompt_text: string
    }

/**
 * One image-bearing region detected on a single source page (PDF) or in a
 * single source paragraph (DOCX). `source_index` is render-order on page or
 * position in source — Wave 2 uses it as a stable key when overlaying bboxes.
 */
export type ExtractedSourceBlock = {
  source_index: number
  region: SourceProvenanceRegion
  ai_confidence?: number
}
