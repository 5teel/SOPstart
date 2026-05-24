/**
 * Phase 21 (Plan 21-01 Task 2) — DOCX paragraph anchor extraction.
 *
 * Wraps the existing `extractDocxStructural` walk (commit `7b9151e` already
 * structurally anchors images by table-row containment) and emits one
 * `ExtractedSourceBlock` per paragraph-bearing source row. The wrapper does
 * NOT modify `extract-docx-structural.ts` — Wave 2 source viewer consumes
 * `ExtractedSourceBlock[]` (the same envelope shape used by the PDF path)
 * via this thin adapter.
 *
 * `run_start` / `run_end` are currently character-index offsets within the
 * concatenated paragraph text (one offset pair per paragraph as a whole). A
 * future pass can split inside the run-level XML if Wave 2 needs sub-paragraph
 * highlighting — for now the paragraph is the highlight unit and this is
 * enough to satisfy `BlockProvenanceRecordSchema`.
 */

import { extractDocxStructural } from '@/lib/parsers/extract-docx-structural'
import type { StructuredBlock } from '@/lib/parsers/structural-doc'
import type { ExtractedSourceBlock } from './types'

/**
 * Walk a DOCX file and emit one anchor per text-bearing paragraph (heading,
 * paragraph, listItem, caption, and each cell of every table).
 *
 * @param buf raw DOCX bytes (.docx is a zip; pass the file contents)
 */
export async function extractDocxParagraphAnchors(
  buf: Buffer,
): Promise<ExtractedSourceBlock[]> {
  const { doc } = await extractDocxStructural(buf)

  const anchors: ExtractedSourceBlock[] = []
  let sourceIndex = 0

  for (const block of doc.blocks as StructuredBlock[]) {
    if (block.kind === 'table') {
      // One anchor per cell so the source viewer can highlight a single cell
      // (which is the natural source unit for a procedural-table step).
      for (const row of block.rows) {
        for (const cell of row.cells) {
          const len = cell.text.length
          anchors.push({
            source_index: sourceIndex++,
            region: {
              kind: 'docx',
              paragraph_id: `${block.paragraphId}::r${row.rowIndex}c${cell.colIndex}`,
              run_start: 0,
              run_end: len,
            },
          })
        }
      }
      continue
    }

    // heading / paragraph / listItem / caption — single anchor per block.
    const text =
      'text' in block && typeof block.text === 'string' ? block.text : ''
    anchors.push({
      source_index: sourceIndex++,
      region: {
        kind: 'docx',
        paragraph_id: block.paragraphId,
        run_start: 0,
        run_end: text.length,
      },
    })
  }

  return anchors
}
