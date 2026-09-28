'use client'

/**
 * Phase 51 / Plan 51-04 (D-02, D-08, D-09) — the Konva site editor canvas.
 *
 * Presentational only: renders the scene at natural pixel size inside a
 * pannable/zoomable world, and (Task 2) draws/selects/edits machine polygons,
 * emitting scene-pixel coordinates through the SceneEditorProps callbacks.
 * Owns no data and calls no server action — SiteWorkspace (51-05) owns state
 * and saving.
 *
 * HARD CONSTRAINT (D-08 / T-51-02): this module statically imports
 * react-konva and MUST only be reached through `SiteEditorLoader` (dynamic
 * ssr:false) — never the worker `/sops/[sopId]` bundle. The
 * `konva-worker-isolation` lint enforces it.
 */
import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text } from 'react-konva'
import type Konva from 'konva'
import { fitView, zoomAt, type View, type SceneEditorProps } from '@/lib/site/scene'

// Zoom clamps to [fit * VIEW_ZOOM_MIN_FACTOR, VIEW_ZOOM_MAX] (D-09 discretion).
const VIEW_ZOOM_MIN_FACTOR = 0.5
const VIEW_ZOOM_MAX = 4

interface ColourTokens {
  zone: string
  step: string
  ink: string
  paper1: string
}

export default function SiteEditor({
  sceneUrl,
  sceneWidth,
  sceneHeight,
  machines,
  selectedId,
  drawing,
  onSelect,
  onCreate,
  onPolygonChange,
}: SceneEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 })
  const fitScaleRef = useRef(1)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  // Read theme tokens once, client-side only (this module never SSRs — D-08).
  const [tokens] = useState<ColourTokens>(() => {
    const style = getComputedStyle(document.body)
    return {
      zone: style.getPropertyValue('--accent-zone').trim(),
      step: style.getPropertyValue('--accent-step').trim(),
      ink: style.getPropertyValue('--ink-900').trim(),
      paper1: style.getPropertyValue('--paper-1').trim(),
    }
  })

  // Container size via ResizeObserver — re-measure on every fit (Pitfall 5:
  // a stage built while hidden measures 0x0, so this also fires the first
  // real measurement once the container becomes visible).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Fit whenever the measured size or the scene's natural size changes.
  useEffect(() => {
    const fit = fitView(size.w, size.h, sceneWidth, sceneHeight)
    if (!fit) return
    fitScaleRef.current = fit.s
    setView(fit)
  }, [size.w, size.h, sceneWidth, sceneHeight])

  // Load the scene image once per URL.
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.src = sceneUrl
    return () => {
      img.onload = null
    }
  }, [sceneUrl])

  function handleStageDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    // Vertex-handle drags bubble through the stage too — only a drag that
    // targets the stage itself is a pan.
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()
    if (!stage) return
    setView((v) => ({ ...v, x: stage.x(), y: stage.y() }))
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    setView((v) => zoomAt(v, pointer, e.evt.deltaY, fitScaleRef.current * VIEW_ZOOM_MIN_FACTOR, VIEW_ZOOM_MAX))
  }

  return (
    <div
      ref={containerRef}
      data-testid="site-canvas"
      data-scale={view.s.toFixed(4)}
      data-x={view.x.toFixed(1)}
      data-y={view.y.toFixed(1)}
      className={`relative h-full w-full overflow-hidden bg-paper${drawing ? ' cursor-crosshair' : ''}`}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={view.x}
        y={view.y}
        scaleX={view.s}
        scaleY={view.s}
        draggable={!drawing}
        dragDistance={3}
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
      >
        <Layer>
          {image ? (
            <KonvaImage image={image} x={0} y={0} width={sceneWidth} height={sceneHeight} />
          ) : (
            <Text text="Loading the scene…" x={16} y={16} fontSize={16} fill={tokens.ink} />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
