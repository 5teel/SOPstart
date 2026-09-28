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
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import {
  fitView,
  zoomAt,
  clampPoint,
  centroid,
  type View,
  type SceneEditorProps,
  type SceneEditorMachine,
} from '@/lib/site/scene'
import type { Point } from '@/lib/validators/site'

// Zoom clamps to [fit * VIEW_ZOOM_MIN_FACTOR, VIEW_ZOOM_MAX] (D-09 discretion).
const VIEW_ZOOM_MIN_FACTOR = 0.5
const VIEW_ZOOM_MAX = 4
// Vertex handle radius / close-snap distance are screen px, constant at any zoom (D-09 discretion).
const VERTEX_RADIUS_PX = 7
const CLOSE_SNAP_PX = 10
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace"

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
  const layerRef = useRef<Konva.Layer | null>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  // Draw mode: vertices placed so far + the live cursor point (closing preview).
  const [draft, setDraft] = useState<Point[]>([])
  const [hover, setHover] = useState<Point | null>(null)
  // Local working copy of the selected machine's polygon while a vertex is
  // being dragged, so the fill follows the handle before onPolygonChange commits.
  const [dragPolygon, setDragPolygon] = useState<Point[] | null>(null)

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
  // real measurement once the container becomes visible). setSize happens
  // inside the observer's own async callback, not synchronously in the
  // effect body, so this isn't the set-state-in-effect pattern.
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

  // Re-fit at the moment the measured size or the scene's natural size
  // changes, during render (not inside an effect) — mirrors PersonPanel's
  // prevPersonId idiom (react-hooks/set-state-in-effect).
  const fitKey = `${size.w}:${size.h}:${sceneWidth}:${sceneHeight}`
  const [prevFitKey, setPrevFitKey] = useState(fitKey)
  if (fitKey !== prevFitKey) {
    setPrevFitKey(fitKey)
    const fit = fitView(size.w, size.h, sceneWidth, sceneHeight)
    if (fit) setView(fit)
  }

  // Load the scene image once per URL. setImage happens inside the image's
  // own onload callback, not synchronously in the effect body.
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.src = sceneUrl
    return () => {
      img.onload = null
    }
  }, [sceneUrl])

  // The workspace (51-05) cancels drawing with Escape — clear the
  // in-progress draft the moment `drawing` flips, during render.
  const [prevDrawing, setPrevDrawing] = useState(drawing)
  if (prevDrawing !== drawing) {
    setPrevDrawing(drawing)
    if (!drawing) {
      setDraft([])
      setHover(null)
    }
  }

  // A new selection starts with no in-flight vertex edit.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId)
    setDragPolygon(null)
  }

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
    // The zoom floor is half the current fit-to-container scale.
    const fit = fitView(size.w, size.h, sceneWidth, sceneHeight)
    const minScale = (fit ? fit.s : view.s) * VIEW_ZOOM_MIN_FACTOR
    setView((v) => zoomAt(v, pointer, e.evt.deltaY, minScale, VIEW_ZOOM_MAX))
  }

  // Draw mode: place a vertex, or close the polygon on a click near the
  // first vertex; outside draw mode: click empty stage / the scene image to
  // deselect (a machine fill has its own onClick to select — D-09).
  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (drawing) {
      const layer = layerRef.current
      if (!layer) return
      const pos = layer.getRelativePointerPosition()
      if (!pos) return
      const point = clampPoint([pos.x, pos.y], sceneWidth, sceneHeight)
      if (draft.length >= 3) {
        const [fx, fy] = draft[0]
        const sceneDist = Math.hypot(point[0] - fx, point[1] - fy)
        if (sceneDist * view.s <= CLOSE_SNAP_PX) {
          onCreate(draft)
          setDraft([])
          return
        }
      }
      setDraft((d) => [...d, point])
      return
    }
    const stage = e.target.getStage()
    if (!stage) return
    if (e.target === stage || e.target.getClassName() === 'Image') {
      onSelect(null)
    }
  }

  // Double-click closes the polygon (drops a duplicate final vertex left by
  // the browser's click-click-dblclick sequence, RESEARCH § Pattern 2).
  function handleStageDblClick() {
    if (!drawing) return
    let next = draft
    if (next.length >= 2) {
      const a = next[next.length - 1]
      const b = next[next.length - 2]
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 3) next = next.slice(0, -1)
    }
    if (next.length >= 3) {
      onCreate(next)
      setDraft([])
    } else {
      setDraft(next)
    }
  }

  function handleStageMouseMove() {
    if (!drawing) return
    const layer = layerRef.current
    if (!layer) return
    const pos = layer.getRelativePointerPosition()
    if (!pos) return
    setHover(clampPoint([pos.x, pos.y], sceneWidth, sceneHeight))
  }

  function handleVertexDragMove(machine: SceneEditorMachine, index: number, e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target
    const base = dragPolygon ?? machine.polygon
    const next = base.map((p, i) => (i === index ? ([node.x(), node.y()] as Point) : p))
    setDragPolygon(next)
  }

  function handleVertexDragEnd(machine: SceneEditorMachine, index: number, e: Konva.KonvaEventObject<DragEvent>) {
    const layer = layerRef.current
    const pos = layer?.getRelativePointerPosition()
    const raw: [number, number] = pos ? [pos.x, pos.y] : [e.target.x(), e.target.y()]
    const point = clampPoint(raw, sceneWidth, sceneHeight)
    const base = dragPolygon ?? machine.polygon
    const next = base.map((p, i) => (i === index ? point : p))
    setDragPolygon(null)
    onPolygonChange(machine.id, next)
  }

  const selectedMachine = machines.find((m) => m.id === selectedId) ?? null

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
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDblClick={handleStageDblClick}
        onDblTap={handleStageDblClick}
        onMouseMove={handleStageMouseMove}
      >
        <Layer ref={layerRef}>
          {image ? (
            <KonvaImage image={image} x={0} y={0} width={sceneWidth} height={sceneHeight} />
          ) : (
            <Text text="Loading the scene…" x={16} y={16} fontSize={16} fill={tokens.ink} />
          )}

          {machines.flatMap((m) => {
            const polygon = dragPolygon && m.id === selectedId ? dragPolygon : m.polygon
            const points = polygon.flat()
            const colour = m.colour ?? tokens.zone
            const isSelected = m.id === selectedId
            const [cx, cy] = centroid(polygon)
            return [
              <Line
                key={`${m.id}-fill`}
                points={points}
                closed
                fill={colour}
                opacity={isSelected ? 0.45 : 0.22}
                onClick={() => {
                  if (!drawing) onSelect(m.id)
                }}
                onTap={() => {
                  if (!drawing) onSelect(m.id)
                }}
              />,
              <Line
                key={`${m.id}-stroke`}
                points={points}
                closed
                stroke={colour}
                strokeWidth={2 / view.s}
                listening={false}
              />,
              <Text
                key={`${m.id}-label`}
                x={cx}
                y={cy}
                text={m.name}
                fontSize={12 / view.s}
                fontFamily={MONO_FONT}
                fill={tokens.ink}
                listening={false}
              />,
            ]
          })}

          {selectedMachine && !drawing
            ? (dragPolygon ?? selectedMachine.polygon).map((pt, i) => (
                <Circle
                  key={i}
                  x={pt[0]}
                  y={pt[1]}
                  radius={VERTEX_RADIUS_PX / view.s}
                  fill={tokens.paper1}
                  stroke={tokens.step}
                  strokeWidth={2 / view.s}
                  draggable
                  onDragMove={(e) => handleVertexDragMove(selectedMachine, i, e)}
                  onDragEnd={(e) => handleVertexDragEnd(selectedMachine, i, e)}
                />
              ))
            : null}

          {drawing ? (
            <>
              <Line
                points={[...draft.flat(), ...(hover ?? [])]}
                stroke={tokens.step}
                strokeWidth={2 / view.s}
                dash={[6 / view.s, 4 / view.s]}
                listening={false}
              />
              {draft.length > 0 ? (
                <Circle
                  x={draft[0][0]}
                  y={draft[0][1]}
                  radius={CLOSE_SNAP_PX / view.s}
                  stroke={tokens.step}
                  strokeWidth={2 / view.s}
                  listening={false}
                />
              ) : null}
            </>
          ) : null}
        </Layer>
      </Stage>
    </div>
  )
}
