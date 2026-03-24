import Tesseract from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
}

/**
 * Best-effort OCR for scanned PDFs and photographed pages.
 * Called when text extraction yields fewer than 50 characters.
 * Per D-08: flag low-quality OCR results for admin attention.
 */
export async function ocrFallback(imageBuffer: ArrayBuffer, contentType: string): Promise<OcrResult> {
  try {
    const buffer = Buffer.from(imageBuffer)
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {}, // silence progress logs
    })

    return {
      text: data.text.trim(),
      confidence: data.confidence / 100, // normalise to 0-1
    }
  } catch (error) {
    console.error('OCR fallback error:', error)
    return { text: '', confidence: 0 }
  }
}
