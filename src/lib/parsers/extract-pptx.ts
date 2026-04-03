import { parseOffice } from 'officeparser'

export interface PptxExtractionResult {
  text: string
}

/**
 * Extracts text from PowerPoint (.pptx) files using officeparser.
 *
 * Officeparser concatenates slide text and speaker notes into a single
 * text stream. The GPT-4o prompt hint (in gpt-parser.ts) tells the model
 * to treat slide titles as section headings and combine notes with slide text.
 */
export async function extractPptx(buffer: ArrayBuffer): Promise<PptxExtractionResult> {
  const ast = await parseOffice(Buffer.from(buffer))
  const text = ast.toText()
  return { text: text.trim() }
}
