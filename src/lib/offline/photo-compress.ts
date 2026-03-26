/**
 * photo-compress.ts
 *
 * Canvas API-based image compression targeting ~200KB output.
 * Uses a binary-search over JPEG quality to hit the target byte size.
 *
 * Pattern from 04-RESEARCH.md Pattern 2.
 */

/**
 * Compress a photo file using the Canvas API.
 *
 * @param file           The source File object (any image MIME type)
 * @param maxDimension   Maximum width or height in pixels (default: 1200)
 * @param targetBytes    Target output size in bytes (default: 200_000 = ~200KB)
 * @returns              A compressed Blob in image/jpeg format
 */
export async function compressPhoto(
  file: File,
  maxDimension = 1200,
  targetBytes = 200_000
): Promise<Blob> {
  // 1. Load the image via object URL
  const objectUrl = URL.createObjectURL(file)
  const img = await loadImage(objectUrl)
  URL.revokeObjectURL(objectUrl)

  // 2. Calculate scaled dimensions
  const { width, height } = scaleDimensions(img.naturalWidth, img.naturalHeight, maxDimension)

  // 3. Draw to canvas at scaled size
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  ctx.drawImage(img, 0, 0, width, height)

  // 4. Binary search quality to hit target bytes
  const blob = await binarySearchQuality(canvas, targetBytes)
  return blob
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function scaleDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (naturalWidth <= maxDimension && naturalHeight <= maxDimension) {
    return { width: naturalWidth, height: naturalHeight }
  }
  const ratio = Math.min(maxDimension / naturalWidth, maxDimension / naturalHeight)
  return {
    width: Math.round(naturalWidth * ratio),
    height: Math.round(naturalHeight * ratio),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      },
      'image/jpeg',
      quality
    )
  })
}

async function binarySearchQuality(
  canvas: HTMLCanvasElement,
  targetBytes: number
): Promise<Blob> {
  let lo = 0.1
  let hi = 0.9
  let best: Blob | null = null

  // Up to 6 iterations is sufficient for quality precision
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2
    const blob = await canvasToBlob(canvas, mid)

    if (blob.size <= targetBytes) {
      best = blob
      lo = mid  // try higher quality
    } else {
      hi = mid  // try lower quality
    }
  }

  // If no quality was small enough, use the lowest quality
  if (!best) {
    best = await canvasToBlob(canvas, lo)
  }

  return best
}
