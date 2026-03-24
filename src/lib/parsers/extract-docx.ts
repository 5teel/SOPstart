import mammoth from 'mammoth'

export interface ExtractedImage {
  base64: string
  contentType: string
  index: number
}

export interface DocxExtractionResult {
  text: string
  html: string
  images: ExtractedImage[]
  warnings: string[]
}

export async function extractDocx(buffer: ArrayBuffer): Promise<DocxExtractionResult> {
  const images: ExtractedImage[] = []
  let imageIndex = 0

  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read('base64')
        images.push({
          base64,
          contentType: image.contentType,
          index: imageIndex++,
        })
        return { src: `__IMAGE_${imageIndex - 1}__` }
      }),
    }
  )

  // Strip HTML tags for plain text (fed to GPT-4o)
  const text = result.value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    text,
    html: result.value,
    images,
    warnings: result.messages.map((m) => m.message),
  }
}
