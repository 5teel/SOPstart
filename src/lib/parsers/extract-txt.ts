export interface TxtExtractionResult {
  text: string
}

/**
 * Plain text passthrough — decodes buffer as UTF-8 and returns trimmed text.
 */
export async function extractTxt(buffer: ArrayBuffer): Promise<TxtExtractionResult> {
  const text = Buffer.from(buffer).toString('utf-8')
  return { text: text.trim() }
}
