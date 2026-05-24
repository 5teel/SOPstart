/**
 * Phase 21 (Plan 21-01 Task 2) — PDF block bbox extraction.
 *
 * Spike 001 production-ised. Walks pdfjs operator list and tracks the CTM
 * (current transformation matrix) via save/restore/transform ops to derive
 * a page-coordinate bbox for every paintImageXObject / paintInlineImageXObject
 * call. paintImageMaskXObject ops are skipped (Spike 001 finding #3 — masks
 * are layout effects, not source images).
 *
 * CRITICAL — [2026-05-15] CLAUDE.md learning:
 *   `unpdf.extractImages` / pdfjs requires a fresh `Uint8Array` per call.
 *   Reusing the same `Uint8Array` view across successive `extractImages(data, p)`
 *   calls (or after a prior `getDocumentProxy(data)` call) crashes with
 *   `DataCloneError: Cannot transfer object of unsupported type` at
 *   `LoopbackPort.postMessage`. pdfjs holds internal worker state on the input
 *   ArrayBuffer; the second call hits a structured-clone boundary that rejects
 *   the mutated buffer. Fix: read the file once to a `Buffer`, then construct
 *   `new Uint8Array(buf)` inside the per-page loop. Same applies if you need
 *   both `numPages` (via `getDocumentProxy`) and images (via `extractImages`)
 *   — use one fresh `Uint8Array` per call, never reuse.
 *
 * 0 MB bundle Δ — `unpdf` is already a project dep; this module imports
 * `getResolvedPDFJS` and uses pdfjs directly, no new dependency.
 */

import { getResolvedPDFJS } from 'unpdf'
import type { ExtractedSourceBlock } from './types'

// 6-element CTM multiply: result = a · b where each is [a, b, c, d, e, f].
// Standard PDF page coordinate transform composition.
function mulCtm(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ]
}

/**
 * Image objects in PDF are positioned by drawing a unit square [0,0]→[1,1]
 * under the current CTM. After applying CTM `m`, the four corners map to:
 *   (m[4], m[5])
 *   (m[0]+m[4], m[1]+m[5])
 *   (m[2]+m[4], m[3]+m[5])
 *   (m[0]+m[2]+m[4], m[1]+m[3]+m[5])
 *
 * Take bbox = [minX, minY, maxX, maxY] — this is rotation-invariant.
 */
function ctmBbox(m: number[]): [number, number, number, number] {
  const corners: Array<[number, number]> = [
    [m[4], m[5]],
    [m[0] + m[4], m[1] + m[5]],
    [m[2] + m[4], m[3] + m[5]],
    [m[0] + m[2] + m[4], m[1] + m[3] + m[5]],
  ]
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/**
 * Extract block bboxes (image-bearing regions) for a single PDF page.
 *
 * @param buf raw PDF bytes — pass a Node Buffer; a fresh Uint8Array is created
 *            inside on every call. DO NOT reuse a Uint8Array between calls
 *            (see file-level comment).
 * @param pageNum 1-based page index.
 *
 * @returns one `ExtractedSourceBlock` per painted image, sorted by render
 *          order (the order pdfjs emits operator-list ops in).
 */
export async function extractPdfBlockBboxes(
  buf: Buffer,
  pageNum: number,
): Promise<ExtractedSourceBlock[]> {
  const pdfjs = await getResolvedPDFJS()

  // Fresh Uint8Array — Spike 001 gotcha. Each call to getDocument MUST receive
  // its own view; reuse crashes the pdfjs worker on the 2nd call.
  const data = new Uint8Array(buf)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await (pdfjs as any).getDocument({ data, disableFontFace: true }).promise

  if (pageNum < 1 || pageNum > pdf.numPages) {
    pdf.destroy?.()
    return []
  }

  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })
  const pageWidth: number = viewport.width
  const pageHeight: number = viewport.height
  const ops = await page.getOperatorList()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OPS = (pdfjs as any).OPS
  const PAINT_IMAGE = OPS.paintImageXObject
  const PAINT_INLINE = OPS.paintInlineImageXObject
  const PAINT_MASK = OPS.paintImageMaskXObject
  const TRANSFORM = OPS.transform
  const SAVE = OPS.save
  const RESTORE = OPS.restore

  const blocks: ExtractedSourceBlock[] = []
  let sourceIndex = 0

  // Track CTM via save/restore stack and incremental transform composition.
  let ctm: number[] = [1, 0, 0, 1, 0, 0]
  const ctmStack: number[][] = []

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]

    if (fn === SAVE) {
      ctmStack.push(ctm.slice())
    } else if (fn === RESTORE) {
      ctm = ctmStack.pop() ?? [1, 0, 0, 1, 0, 0]
    } else if (fn === TRANSFORM) {
      ctm = mulCtm(args, ctm)
    } else if (fn === PAINT_IMAGE || fn === PAINT_INLINE) {
      // Spike 001 finding #3 — skip paintImageMaskXObject. Masks are layout
      // effects (drop-shadow, alpha), not source content images.
      blocks.push({
        source_index: sourceIndex++,
        region: {
          kind: 'pdf',
          page: pageNum,
          bbox: ctmBbox(ctm),
          pageWidth,
          pageHeight,
        },
      })
    } else if (fn === PAINT_MASK) {
      // explicit skip; no-op
    }
  }

  page.cleanup?.()
  pdf.destroy?.()

  return blocks
}
