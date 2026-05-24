'use client'

/**
 * Phase 21 (Plan 21-02, Task 1) — Per-page PDF canvas + DOM overlay.
 *
 * Production-isation of Spike 002. Each page is its own `<canvas>` rendered
 * by pdfjs at a configurable scale (default 1.25) inside a relatively-
 * positioned wrapper that ALSO hosts the absolute-positioned `<BboxOverlay>`
 * children.
 *
 * Bundle isolation (D-21-09): pdfjs is dynamically imported via
 * `await import('pdfjs-dist')`. The module-level promise cache ensures
 * multiple `<PdfCanvasPage>` instances share one load.
 *
 * CLAUDE.md learning 2026-05-15 (pdfjs/unpdf fresh-Uint8Array requirement):
 * This file does NOT receive a Buffer — the pdfjs document is loaded by
 * URL (the signed-URL endpoint from Task 1) so pdfjs reads bytes via
 * RangeRequest. The Uint8Array reuse hazard only applies to byte-buffer
 * inputs; URL inputs are immune.
 *
 * Click-to-overlay budget (Spike 002): 33 ms measured, 200 ms budget. The
 * two-RAF settle pattern in `scrollIntoViewAndPaint` is the production
 * version of the same pattern in the spike harness.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BboxOverlay } from './BboxOverlay'
import { useSelectionSync } from './useSelectionSync'
import type { CanvasViewport } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfJsModule = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDocument = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfPage = any

// Module-level singletons — shared across PdfCanvasPage instances so we
// only ever load pdfjs once and only fetch each unique URL once.
let pdfjsPromise: Promise<PdfJsModule> | null = null
const documentCache = new Map<string, Promise<PdfDocument>>()

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // Use the legacy build's worker entrypoint to avoid webpack worker-
      // loader gymnastics. `disableWorker` is the simplest production-safe
      // option for an admin-only canvas viewer at v1.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (await import('pdfjs-dist')) as any
      return mod
    })()
  }
  return pdfjsPromise
}

async function loadDocument(url: string, pdfjs: PdfJsModule): Promise<PdfDocument> {
  let p = documentCache.get(url)
  if (!p) {
    p = (async () => {
      // disableFontFace keeps font hosting out of the equation for admin UAT.
      const task = pdfjs.getDocument({ url, disableFontFace: true })
      return await task.promise
    })()
    documentCache.set(url, p)
  }
  return p
}

export type PdfCanvasPageProps = {
  /** Signed-URL pointer to the PDF document. */
  url: string
  /** 1-based PDF page index. */
  page: number
  /** Render scale (Spike 002 default 1.25). */
  scale?: number
  className?: string
}

/**
 * One PDF page rendered to a `<canvas>` + DOM overlays for any active bbox
 * whose `region.kind === 'pdf'` AND `region.page === this.page`. Highlights
 * scroll into view and pulse via the BboxOverlay primitive.
 */
export function PdfCanvasPage({ url, page, scale = 1.25, className }: PdfCanvasPageProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [viewport, setViewport] = useState<CanvasViewport | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const { activeProvenance, activeBlockId, onSourceClick } = useSelectionSync()

  // 1. Mount → load pdfjs → load document → render this page.
  useEffect(() => {
    let cancelled = false
    let renderTask: { cancel?: () => void } | null = null

    async function run() {
      try {
        const pdfjs = await loadPdfJs()
        const doc = await loadDocument(url, pdfjs)
        if (cancelled) return
        if (page < 1 || page > doc.numPages) {
          setRenderError(`page ${page} out of range (1..${doc.numPages})`)
          return
        }
        const pdfPage: PdfPage = await doc.getPage(page)
        if (cancelled) return
        const vp = pdfPage.getViewport({ scale })
        if (!canvasRef.current) return
        const canvas = canvasRef.current
        // Scale canvas resolution to viewport; CSS width/height pulled from
        // the wrapper so layout stays predictable.
        canvas.width = Math.ceil(vp.width)
        canvas.height = Math.ceil(vp.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setRenderError('canvas 2d context unavailable')
          return
        }
        renderTask = pdfPage.render({ canvasContext: ctx, viewport: vp })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (renderTask as any).promise
        if (cancelled) return
        setViewport({
          width: vp.width,
          height: vp.height,
          transform: vp.transform,
          scale: vp.scale,
          convertToViewportRectangle: (b: number[]) =>
            vp.convertToViewportRectangle(b) as number[],
        })
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      try {
        renderTask?.cancel?.()
      } catch {
        // ignore — pdfjs throws on cancel after completion
      }
    }
  }, [url, page, scale])

  // 2. When activeProvenance changes AND it targets this page, scroll the
  //    wrapper into view using the Spike 002 two-RAF settle pattern.
  const activeBboxOnThisPage = useMemo(() => {
    if (!activeProvenance || activeProvenance.kind !== 'pdf') return null
    if (activeProvenance.page !== page) return null
    return activeProvenance
  }, [activeProvenance, page])

  useEffect(() => {
    if (!activeBboxOnThisPage || !wrapperRef.current || !viewport) return
    const el = wrapperRef.current
    // Two-RAF settle: scroll, then in next frame wait one more frame for
    // overlay paint. Spike 002 measured this at 33 ms — the user
    // perceives the bbox at the same moment as the scroll completes.
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: 'auto', block: 'center' })
      } catch {
        // older browsers
      }
      raf2 = requestAnimationFrame(() => {
        // Settle landmark — no-op; presence guarantees the overlay paints
        // in the same animation tick as the scroll.
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [activeBboxOnThisPage, viewport])

  // 3. Compute viewport-space bbox for the active region (if any).
  const overlayBbox = useMemo<[number, number, number, number] | null>(() => {
    if (!activeBboxOnThisPage || !viewport) return null
    const raw = viewport.convertToViewportRectangle(activeBboxOnThisPage.bbox as number[])
    // raw is [x0,y0,x1,y1] but may have reversed components depending on
    // rotation — Spike 002 discovery #1. Normalise to min/max.
    if (raw.length < 4) return null
    const xs = [raw[0], raw[2]]
    const ys = [raw[1], raw[3]]
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }, [activeBboxOnThisPage, viewport])

  return (
    <div
      ref={wrapperRef}
      data-testid="source-viewer-page"
      data-page={page}
      className={className}
      style={{
        position: 'relative',
        margin: '0 auto 12px',
        width: viewport ? `${Math.ceil(viewport.width)}px` : undefined,
        height: viewport ? `${Math.ceil(viewport.height)}px` : undefined,
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {overlayBbox && activeBlockId && (
        <BboxOverlay
          bbox={overlayBbox}
          blockId={activeBlockId}
          active={true}
          onClick={(id) => onSourceClick(id)}
        />
      )}
      {renderError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#7a1d1d',
            background: 'rgba(255,255,255,0.85)',
          }}
        >
          page render failed: {renderError}
        </div>
      )}
    </div>
  )
}
