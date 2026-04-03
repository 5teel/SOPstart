import Tesseract from 'tesseract.js'

/**
 * Lightweight client-side page number detection.
 * Crops the top and bottom 15% of the image (where page numbers typically appear)
 * and runs Tesseract on just those regions for speed.
 * Returns detected page number or null if none found.
 */
export async function detectPageNumber(imageBlob: Blob): Promise<number | null> {
  try {
    // Create an image element to get dimensions
    const url = URL.createObjectURL(imageBlob)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const w = Math.min(img.naturalWidth, 800)
    const h = Math.round((w / img.naturalWidth) * img.naturalHeight)

    // Crop bottom 15% (most common page number location)
    const cropHeight = Math.round(h * 0.15)
    canvas.width = w
    canvas.height = cropHeight
    ctx.drawImage(img, 0, h - cropHeight, w, cropHeight, 0, 0, w, cropHeight)

    URL.revokeObjectURL(url)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
    })

    const { data } = await Tesseract.recognize(blob, 'eng', {
      logger: () => {},
    })

    // Search for standalone numbers (likely page numbers)
    // Match patterns like "Page 3", "3", "- 3 -", "3 of 10"
    const text = data.text.trim()
    const patterns = [
      /page\s+(\d+)/i,
      /^\s*-?\s*(\d{1,3})\s*-?\s*$/m,
      /(\d{1,3})\s+of\s+\d+/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const num = parseInt(match[1], 10)
        if (num > 0 && num < 999) return num
      }
    }

    return null
  } catch {
    return null
  }
}
