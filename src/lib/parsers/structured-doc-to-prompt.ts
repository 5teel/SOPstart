import type { StructuredDoc, StructuredBlock } from './structural-doc'

/**
 * Serialise a StructuredDoc into a compact text form for the LLM parser.
 *
 * Design constraints:
 *   - GPT/Claude must be able to tell from the input that step text and its
 *     images live in the SAME table row. Stream proximity is NOT a signal.
 *   - Token-efficient — large SOPs can have 300+ blocks; we don't ship raw
 *     JSON-stringified output (too verbose, too many braces).
 *   - Readable enough that a human can sanity-check it.
 *
 * Format:
 *   - Each block is one line (heading/paragraph/listItem/caption) OR a
 *     multi-line block (table).
 *   - Image references inline as `[IMG 12]` tokens. The LLM uses these to
 *     populate step.image_indexes.
 *   - Tables are explicitly delimited with TABLE / ROW / END markers so the
 *     LLM can detect row boundaries. Procedural tables also carry a hint
 *     line naming the step/images/comments columns.
 */
export function structuredDocToPrompt(doc: StructuredDoc): string {
  const lines: string[] = []
  for (const block of doc.blocks) {
    serializeBlock(block, lines)
  }
  return lines.join('\n')
}

function serializeBlock(block: StructuredBlock, lines: string[]): void {
  switch (block.kind) {
    case 'heading':
      lines.push(`HEADING L${block.level}: ${block.text}`)
      return
    case 'paragraph':
      lines.push(`PARA: ${block.text}${formatImageTail(block.images)}`)
      return
    case 'listItem':
      lines.push(
        `LIST (depth=${block.depth}): ${block.text}${formatImageTail(block.images)}`
      )
      return
    case 'caption':
      lines.push(
        `CAPTION${block.forImage != null ? ` (for IMG ${block.forImage})` : ''}: ${block.text}`
      )
      return
    case 'table':
      lines.push(`TABLE #${block.tableIndex} (${block.rows.length} rows)`)
      if (block.isProcedural && block.roleHint) {
        const { stepCol, imagesCol, commentsCol } = block.roleHint
        lines.push(
          `  -- PROCEDURAL: stepCol=${stepCol} imagesCol=${imagesCol} commentsCol=${commentsCol ?? 'none'}`
        )
        lines.push(
          `  -- For each row below, the step instruction is in cell c${stepCol},`
        )
        lines.push(
          `  -- and any images attached to that step are listed in cell c${imagesCol} of the SAME row.`
        )
      }
      for (const row of block.rows) {
        const rowLabel = row.isHeader ? 'HEADER' : `ROW ${row.rowIndex}`
        const cellSummaries = row.cells.map((c) => {
          const text = c.text.trim()
          const imgs = formatImageTail(c.images)
          return `c${c.colIndex}=«${text || '(empty)'}»${imgs}`
        })
        lines.push(`  ${rowLabel}: ${cellSummaries.join(' | ')}`)
      }
      lines.push(`END TABLE #${block.tableIndex}`)
      return
  }
}

function formatImageTail(images: number[]): string {
  if (images.length === 0) return ''
  return ' ' + images.map((i) => `[IMG ${i}]`).join(' ')
}
