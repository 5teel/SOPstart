'use client'

/**
 * Phase 21 (Plan 21-02, Task 1) — DOM-overlay primitive for the PDF
 * source viewer. One absolute-positioned `<div>` per active bbox region,
 * mounted as a sibling of the `<canvas>` inside a relatively-positioned
 * page wrapper.
 *
 * Style contract (Spike 002 visual proof):
 *   - 2px solid yellow border (`#facc15`).
 *   - 35% alpha fill (`rgba(250, 204, 21, 0.35)`).
 *   - When `active`, a 1s ease-in-out infinite pulse on box-shadow so the
 *     admin's eye snaps to the right region.
 *
 * Coordinate contract:
 *   - `bbox` is in viewport-pixel space already — the caller (PdfCanvasPage)
 *     does the `viewport.convertToViewportRectangle(pdfBbox)` mapping plus
 *     min/max normalisation (Spike 002 discovery #1).
 *   - Layout shape: `[xMin, yMin, xMax, yMax]`. Width / height are derived
 *     and clamped non-negative.
 *
 * Reverse-channel click (SCP-VIEWER-03): the overlay carries `pointer-events:
 * auto` and surfaces a click → `onClick(blockId)`. The canvas is the
 * fallback click target underneath, but it's `pointer-events: none` for
 * the bbox region so the overlay always wins (otherwise a user click on a
 * bbox would not register as "select this block").
 */
import { useMemo, type CSSProperties } from 'react'

const BORDER_COLOR = '#facc15' // Tailwind yellow-400
const FILL_COLOR = 'rgba(250, 204, 21, 0.35)' // yellow-400 @ 35% alpha
const BORDER_WIDTH_PX = 2

export type BboxOverlayProps = {
  /** Pre-converted viewport-space bbox: [xMin, yMin, xMax, yMax]. */
  bbox: [number, number, number, number]
  /** Stable identifier for the source block this overlay represents. */
  blockId: string
  /** Pulse animation + raised z-index when true. */
  active: boolean
  /** Reverse-channel: source-side click → builder-side highlight. */
  onClick?: (blockId: string) => void
  className?: string
}

export function BboxOverlay({
  bbox,
  blockId,
  active,
  onClick,
  className,
}: BboxOverlayProps): React.JSX.Element {
  const [x0, y0, x1, y1] = bbox
  const left = Math.min(x0, x1)
  const top = Math.min(y0, y1)
  const width = Math.max(0, Math.abs(x1 - x0))
  const height = Math.max(0, Math.abs(y1 - y0))

  const style = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: `${BORDER_WIDTH_PX}px solid ${BORDER_COLOR}`,
      backgroundColor: FILL_COLOR,
      pointerEvents: 'auto',
      cursor: onClick ? 'pointer' : 'default',
      boxSizing: 'border-box',
      zIndex: active ? 20 : 10,
      animation: active ? 'sv-bbox-pulse 1s ease-in-out infinite' : 'none',
    }),
    [left, top, width, height, active, onClick]
  )

  return (
    <div
      data-testid="source-viewer-bbox"
      data-block-id={blockId}
      data-active={active ? 'true' : 'false'}
      className={className}
      style={style}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation()
              onClick(blockId)
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Source region for block ${blockId}` : undefined}
    />
  )
}

/**
 * Module-level keyframes injector. Mounted once per browser session via the
 * `<BboxOverlayStyles>` component below. Pulses box-shadow rather than
 * opacity or transform so the bbox keeps its exact position (no layout
 * thrash) and the surrounding canvas isn't blurred.
 */
export function BboxOverlayStyles(): React.JSX.Element {
  return (
    <style>{`
      @keyframes sv-bbox-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.55); }
        50% { box-shadow: 0 0 0 6px rgba(250, 204, 21, 0); }
      }
    `}</style>
  )
}
