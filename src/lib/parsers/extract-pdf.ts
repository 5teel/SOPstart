import { extractText } from 'unpdf'

export interface PdfExtractionResult {
  text: string
  pageCount: number
}

export async function extractPdf(buffer: ArrayBuffer): Promise<PdfExtractionResult> {
  const { text, totalPages } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  })

  return {
    text: typeof text === 'string' ? text.trim() : (text as string[]).join('\n').trim(),
    pageCount: totalPages ?? 0,
  }
}
