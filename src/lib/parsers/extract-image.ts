import OpenAI from 'openai'
import sharp from 'sharp'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI() // reads OPENAI_API_KEY from env
  }
  return openai
}

const MAX_BYTES = 4 * 1024 * 1024 // 4MB — GPT-4o vision limit

export interface ImageExtractionResult {
  text: string
}

/**
 * Extracts text from image files (jpg, png, heic, heif) using GPT-4o vision.
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

  const base64 = processed.toString('base64')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this SOP document image. Preserve numbered lists, table structures (use | pipe separators for columns), headings, warnings, cautions, and section titles. If you see page numbers, note them. Output the raw text content only — no commentary.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
  })

  return { text: response.choices[0]?.message?.content ?? '' }
}
