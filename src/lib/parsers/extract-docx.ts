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
    { buffer: Buffer.from(buffer) },
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

  // Strip HTML tags for plain text (fed to GPT-4o), BUT first replace each
  // <img src="__IMAGE_N__" .../> with a visible `[IMAGE N]` token so the
  // image positions survive HTML stripping. GPT can then attribute each token
  // to the step it appears in via the `image_indexes` field.
  const htmlWithImageTokens = result.value.replace(
    /<img\b[^>]*src=["']__IMAGE_(\d+)__["'][^>]*\/?>/gi,
    '[IMAGE $1]'
  )
  const text = htmlWithImageTokens
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
