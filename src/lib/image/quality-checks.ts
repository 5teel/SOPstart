export interface QualityResult {
  status: 'pass' | 'warn'
  blurScore: number
  resolution: { width: number; height: number }
  issues: string[]
}

const BLUR_THRESHOLD = 100    // Laplacian variance below this = blurry
const MIN_RESOLUTION = 600     // Minimum pixels on shorter dimension

/**
 * Compute Laplacian variance on a grayscale image to detect blur.
 * Uses Canvas API — runs in browser only.
 * The Laplacian kernel [-1,-1,-1; -1,8,-1; -1,-1,-1] detects edges.
 * Variance of the result: high = sharp, low = blurry.
 */
export function measureBlur(imageElement: HTMLImageElement): number {
  const canvas = document.createElement('canvas')
  const w = Math.min(imageElement.naturalWidth, 512) // downsample for speed
  const h = Math.round((w / imageElement.naturalWidth) * imageElement.naturalHeight)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imageElement, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  // Convert to grayscale
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Apply Laplacian kernel and compute variance
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const lap = -gray[idx - w - 1] - gray[idx - w] - gray[idx - w + 1]
                  - gray[idx - 1]     + 8 * gray[idx] - gray[idx + 1]
                  - gray[idx + w - 1] - gray[idx + w] - gray[idx + w + 1]
      sum += lap
      sumSq += lap * lap
      count++
    }
  }
  const mean = sum / count
  const variance = sumSq / count - mean * mean
  return variance
}

/**
 * Run all client-side quality checks on a captured image.
 * Must complete within ~300ms for responsive UX.
 */
export async function checkImageQuality(imageElement: HTMLImageElement): Promise<QualityResult> {
  const issues: string[] = []
  const width = imageElement.naturalWidth
  const height = imageElement.naturalHeight
  const shortSide = Math.min(width, height)

  // Resolution check
  if (shortSide < MIN_RESOLUTION) {
    issues.push(`Low resolution (${width}x${height})`)
  }

  // Blur check
  const blurScore = measureBlur(imageElement)
  if (blurScore < BLUR_THRESHOLD) {
    issues.push('Image appears blurry')
  }

  return {
    status: issues.length > 0 ? 'warn' : 'pass',
    blurScore,
    resolution: { width, height },
    issues,
  }
}
