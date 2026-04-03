import { parseOffice } from 'officeparser'

export interface XlsxExtractionResult {
  text: string
}

/**
 * Extracts text from Excel (.xlsx) files using officeparser.
 *
 * Officeparser returns an AST — call toText() to get plain text.
 * Tab-delimited cell output is converted to GitHub-flavored markdown
 * table syntax so GPT-4o can better recognise tabular SOP data
 * (calibration parameters, tolerance ranges, checklists).
 */
export async function extractXlsx(buffer: ArrayBuffer): Promise<XlsxExtractionResult> {
  const ast = await parseOffice(Buffer.from(buffer))
  const raw = ast.toText()

  const lines = raw.split('\n')
  const processedLines: string[] = []
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('\t')) {
      // Convert tab-separated cells to markdown pipe format
      const cells = line.split('\t').map((c) => c.trim())
      const pipeRow = '| ' + cells.join(' | ') + ' |'
      processedLines.push(pipeRow)

      // Insert header separator after first row of a new table block
      if (!inTable) {
        const separator = '| ' + cells.map(() => '---').join(' | ') + ' |'
        processedLines.push(separator)
        inTable = true
      }
    } else {
      inTable = false
      processedLines.push(line)
    }
  }

  return { text: processedLines.join('\n').trim() }
}
