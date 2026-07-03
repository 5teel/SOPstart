'use client'

/**
 * Phase 26 / Plan 26-11 (D-03 slice 2, R5) — DiagramHotspotBlock.
 *
 * The ONE freeform-positioning surface in the otherwise block-reflow builder:
 * numbered callouts placed at FREEFORM x/y in the diagram's NATURAL-IMAGE space
 * (UI-SPEC §DiagramHotspotBlock — called out so the layout checker does not flag
 * free positioning as a violation). It folds into the Visual/diagram medium: the
 * Visual item's `annotationId` links the diagram to its `sop_image_annotations`
 * scene row (persist is Plan 26-13). Coordinates are natural-image space so a
 * scene re-opens pixel-identical at any display scale (pitfall #2).
 *
 * Backed by the SAME pure scene model as the full AnnotationEditor
 * (`annotation-tools.ts`) — callouts here are exactly `createCallout` Labels, so
 * a hotspot scene is a normal annotation scene (one editor, one storage shape).
 *
 * HARD CONSTRAINT (D-03 / R8): statically imports react-konva — admin-only, reached
 * ONLY via a dynamic({ ssr:false }) loader, never the worker bundle. The
 * `konva-worker-isolation` lint + `check-bundle-size` gate enforce it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Label, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import {
  emptyScene,
  addShape,
  updateShape,
  createCallout,
  serializeScene,
  acceptsPointer,
  type Scene,
  type Shape,
} from './annotation-tools'

export type DiagramHotspotBlockProps = {
  /** Links this hotspot scene to its `sop_image_annotations` row (persist = 26-13). */
  annotationId?: string
  naturalWidth?: number
  naturalHeight?: number
  /** Background diagram URL — rendered as a plain <img>, kept OUT of the scene JSON. */
  imageUrl?: string
  /** Existing callout scene to re-open (non-destructive). */
  initialScene?: Scene
  /** Commit the scene JSON upward (persistence is Plan 26-13). */
  onChange?: (json: string, annotationId?: string) => void
}

export default function DiagramHotspotBlock({
  annotationId,
  naturalWidth = 800,
  naturalHeight = 600,
  imageUrl,
  initialScene,
  onChange,
}: DiagramHotspotBlockProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [scene, setScene] = useState<Scene>(
    () => initialScene ?? emptyScene(naturalWidth, naturalHeight)
  )
  const [penOnly, setPenOnly] = useState(false)

  // Pitfall 5: tear the stage down on unmount so a StrictMode remount can't leak it.
  useEffect(() => {
    const stage = stageRef.current
    return () => {
      stage?.destroy()
    }
  }, [])

  const push = useCallback(
    (next: Scene) => {
      setScene(next)
      onChange?.(serializeScene(next), annotationId)
    },
    [annotationId, onChange]
  )

  // Click empty diagram → drop the next numbered callout at that freeform x/y.
  const placeCallout = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!acceptsPointer(e.evt.pointerType, { penOnly })) return
      // Only place on empty space — clicking a callout should move it, not stack.
      if (e.target !== e.target.getStage()) return
      const p = stageRef.current?.getPointerPosition()
      if (!p) return
      push(addShape(scene, createCallout(scene, { x: p.x, y: p.y, label: '' })))
    },
    [scene, penOnly, push]
  )

  const moveCallout = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      push(updateShape(scene, id, { x: e.target.x(), y: e.target.y() } as Partial<Shape>))
    },
    [scene, push]
  )

  const callouts = scene.shapes.filter((s): s is Extract<Shape, { type: 'Label' }> => s.type === 'Label')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-white">
        <span>Tap the diagram to drop a numbered callout</span>
        <button
          type="button"
          aria-pressed={penOnly}
          title="Pen only (palm rejection)"
          onClick={() => setPenOnly((v) => !v)}
          className={`rounded px-2 py-1 ${penOnly ? 'bg-brand-yellow text-steel-900' : 'hover:bg-steel-700'}`}
        >
          Pen only
        </button>
      </div>

      <div className="relative overflow-auto" style={{ maxWidth: '100%' }}>
        {imageUrl ? (
          // Background diagram lives OUTSIDE the scene JSON (pitfall #8).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" width={naturalWidth} height={naturalHeight} className="pointer-events-none absolute left-0 top-0 select-none" />
        ) : null}
        <Stage
          ref={stageRef}
          width={naturalWidth}
          height={naturalHeight}
          onPointerDown={placeCallout}
          style={{ touchAction: penOnly ? 'none' : 'auto' }}
        >
          <Layer>
            {callouts.map((c) => (
              <Label key={c.id} x={c.x} y={c.y} draggable onDragEnd={(e) => moveCallout(c.id, e)}>
                <Tag fill={c.tag.fill} cornerRadius={c.tag.cornerRadius} pointerDirection={c.tag.pointerDirection} pointerWidth={c.tag.pointerWidth} pointerHeight={c.tag.pointerHeight} />
                <Text text={c.text.text} fontSize={c.text.fontSize} fontFamily={c.text.fontFamily} fill={c.text.fill} padding={c.text.padding} />
              </Label>
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
