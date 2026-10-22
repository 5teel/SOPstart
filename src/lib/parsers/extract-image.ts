import sharp from 'sharp'
import { transcribeScan } from './ocr-fallback'

const MAX_BYTES = 3.5 * 1024 * 1024 // Claude takes 5MB of base64 per image; 3.5MB raw stays under it

export interface ImageExtractionResult {
  text: string
}

/**
 * Extracts text from image files (jpg, png, heic, heif) with Claude (transcribeScan).
 *
 * Server-side preprocessing with sharp:
 * - Auto-rotate from EXIF
 * - Normalize contrast
 * - Convert to JPEG
 * - Resize if over 4MB limit
 *
 * Returns extracted text, preserving numbered lists, table structures,
 * headings, warnings, cautions, and section titles.
 */
export async function extractImage(buffer: ArrayBuffer): Promise<ImageExtractionResult> {
  // Preprocess: auto-rotate, normalize, convert to JPEG
  let processed = await sharp(Buffer.from(buffer))
    .rotate()       // auto-rotate from EXIF
    .normalize()    // normalize contrast
    .jpeg({ quality: 90 })
    .toBuffer()

  // Resize if still over limit
  if (processed.length > MAX_BYTES) {
    processed = await sharp(processed)
      .resize({ width: 2048, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  return { text: await transcribeScan(processed, 'image/jpeg') }
}
