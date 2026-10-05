'use client'

/**
 * Phase 58 (58-17, D-03) -- mark up a step photo. Full-screen dark overlay; Save
 * bakes the marks into a new image that replaces the photo on the step, and the
 * marks are kept so the photo can be marked up again. Esc (the frame's overlay
 * registry) closes without saving.
 *
 * Ported from Phase 26's Konva editor (deleted in 55-10): six tools, resize and
 * rotate, undo/redo, a text box, and a "Pen only" palm-rejection switch. The shape
 * model lives in the pure `annotation-tools.ts`; this file is only the react-konva
 * view and the save round trip.
 *
 * HARD CONSTRAINT: this module statically imports react-konva, so it is reached ONLY
 * through the nested `dynamic(..., { ssr: false })` import in StepCard. Konva must
 * never reach the worker bundle (the bundle gate and the isolation spec enforce it).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Arrow, Rect, Ellipse, Text, Label, Tag, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { ArrowUpRight, Circle, Hash, MousePointer2, PenTool, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react'
import { getStepImageUploadUrl, saveAnnotatedStepImage } from '@/actions/focus-steps'
import { useRegisterOverlay } from '@/hooks/useFocusBack'
import {
  acceptsPointer,
  addShape,
  canRedo,
  canUndo,
  commitScene,
  createArrow,
  createCallout,
  createEllipse,
  createFreehand,
  createRect,
  createText,
  emptyScene,
  initHistory,
  redo,
  removeShape,
  undo,
  updateShape,
  type Scene,
  type Shape,
} from './annotation-tools'

type Tool = 'select' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'callout' | 'freehand'

const TOOLS: { id: Tool; label: string; Icon: typeof ArrowUpRight }[] = [
  { id: 'select', label: 'Select', Icon: MousePointer2 },
  { id: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { id: 'rect', label: 'Rectangle', Icon: Square },
  { id: 'ellipse', label: 'Circle', Icon: Circle },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'callout', label: 'Number', Icon: Hash },
  { id: 'freehand', label: 'Draw', Icon: PenTool },
]

const btn = 'flex min-h-tap min-w-tap items-center justify-center rounded text-white hover:bg-steel-700 disabled:opacity-40'

export interface AnnotationEditorProps {
  stepId: string
  /** The untouched photo the marks sit on (the original, even when re-editing a baked one). */
  originalPath: string
  originalUrl: string
  /** Marks from an earlier save, when re-editing. */
  initialScene?: unknown
  onSaved: () => void
  onClose: () => void
}

/** Anything that is not a scene with a shapes list opens blank rather than crashing. */
function asScene(raw: unknown, w: number, h: number): Scene {
  const s = raw as Partial<Scene> | null
  if (s && typeof s === 'object' && Array.isArray(s.shapes)) return { schemaVersion: 1, width: w, height: h, shapes: s.shapes }
  return emptyScene(w, h)
}

export default function AnnotationEditor(props: AnnotationEditorProps) {
  useRegisterOverlay(true, props.onClose)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Loaded with CORS on so the baked export is not tainted; the extra query makes it
  // a different cache entry from the plain <img> thumbnail of the same URL.
  useEffect(() => {
    const el = new window.Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => setImg(el)
    el.onerror = () => setLoadError(true)
    el.src = props.originalUrl + (props.originalUrl.includes('?') ? '&' : '?') + 'annotate=1'
  }, [props.originalUrl])

  return (
    <div
      role="dialog"
      aria-label="Mark up this photo"
      data-testid="annotate-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-steel-900"
    >
      {img ? (
        <Canvas {...props} img={img} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-ui text-white">
          <p>{loadError ? "Couldn't open that photo." : 'Opening the photo…'}</p>
          <button type="button" onClick={props.onClose} className="min-h-tap rounded-lg border border-steel-700 px-4 text-white">
            Close
          </button>
        </div>
      )}
    </div>
  )
}

function Canvas({ stepId, originalPath, initialScene, onSaved, onClose, img }: AnnotationEditorProps & { img: HTMLImageElement }) {
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight
  const stageRef = useRef<Konva.Stage | null>(null)
  const trRef = useRef<Konva.Transformer | null>(null)
  const drawingId = useRef<string | null>(null)

  const [history, setHistory] = useState(() => initHistory(asScene(initialScene, naturalWidth, naturalHeight)))
  const scene = history.present
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [penOnly, setPenOnly] = useState(false)
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; value: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    const onResize = () => setRoom({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Fit the photo to the room under the toolbar; marks stay in natural-image space.
  const scale = Math.min(1, (room.w - 32) / naturalWidth, (room.h - 120) / naturalHeight)

  const commit = useCallback((next: Scene) => setHistory((h) => commitScene(h, next)), [])

  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, scene])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingText) {
        e.preventDefault()
        commit(removeShape(scene, selectedId))
        setSelectedId(null)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scene, selectedId, editingText, commit])

  const pointerPos = () => {
    const p = stageRef.current?.getRelativePointerPosition()
    return { x: p?.x ?? 0, y: p?.y ?? 0 }
  }

  function handleDown(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!acceptsPointer(e.evt.pointerType, { penOnly })) return
    if (tool === 'select') {
      if (e.target === e.target.getStage() || e.target.name() === 'photo') setSelectedId(null)
      return
    }
    const { x, y } = pointerPos()
    let shape: Shape | null = null
    switch (tool) {
      case 'arrow':
        shape = createArrow({ points: [x, y, x + 80, y + 80] })
        break
      case 'rect':
        shape = createRect({ x, y, width: 120, height: 90 })
        break
      case 'ellipse':
        shape = createEllipse({ x, y, radiusX: 60, radiusY: 45 })
        break
      case 'callout':
        shape = createCallout(scene, { x, y })
        break
      case 'text': {
        const t = createText({ x, y, text: 'Text' })
        shape = t
        setEditingText({ id: t.id, x, y, value: 'Text' })
        break
      }
      case 'freehand':
        shape = createFreehand({ points: [x, y] })
        drawingId.current = shape.id
        break
    }
    if (shape) {
      commit(addShape(scene, shape))
      setSelectedId(shape.id)
      if (tool !== 'freehand' && tool !== 'text') setTool('select')
    }
  }

  function handleMove(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!drawingId.current || !acceptsPointer(e.evt.pointerType, { penOnly })) return
    const { x, y } = pointerPos()
    const id = drawingId.current
    setHistory((h) => {
      const line = h.present.shapes.find((s) => s.id === id)
      if (!line || line.type !== 'Line') return h
      return { ...h, present: updateShape(h.present, id, { points: [...line.points, x, y] } as Partial<Shape>) }
    })
  }

  function handleUp() {
    if (drawingId.current) {
      drawingId.current = null
      setTool('select')
    }
  }

  function commitText() {
    if (!editingText) return
    commit(updateShape(scene, editingText.id, { text: editingText.value } as Partial<Shape>))
    setEditingText(null)
    setTool('select')
  }

  async function save() {
    const stage = stageRef.current
    if (!stage) return
    setSaving(true)
    setError(null)
    try {
      trRef.current?.nodes([]) // handles are not part of the photo
      const blob = (await stage.toBlob({ pixelRatio: 1 / scale, mimeType: 'image/jpeg', quality: 0.88 })) as Blob | null
      if (!blob) throw new Error('no image')
      const slot = await getStepImageUploadUrl({ stepId, contentType: 'image/jpeg' })
      if ('error' in slot) throw new Error(slot.error)
      const put = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
      if (!put.ok) throw new Error('upload')
      const res = await saveAnnotatedStepImage({ stepId, originalPath, bakedPath: slot.storagePath, scene })
      if ('error' in res) throw new Error(res.error)
      onSaved()
    } catch {
      setError("Couldn't save the marks. Try again.")
      setSaving(false)
    }
  }

  function renderShape(s: Shape) {
    const select = () => tool === 'select' && setSelectedId(s.id)
    const common = {
      id: s.id,
      onClick: select,
      onTap: select,
      draggable: tool === 'select',
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => commit(updateShape(scene, s.id, { x: e.target.x(), y: e.target.y() } as Partial<Shape>)),
    }
    switch (s.type) {
      case 'Arrow':
        return <Arrow key={s.id} {...common} points={s.points} stroke={s.stroke} strokeWidth={s.strokeWidth} pointerLength={s.pointerLength} pointerWidth={s.pointerWidth} tension={s.tension} />
      case 'Rect':
        return <Rect key={s.id} {...common} x={s.x} y={s.y} width={s.width} height={s.height} stroke={s.stroke} strokeWidth={s.strokeWidth} dash={s.dash} />
      case 'Ellipse':
        return <Ellipse key={s.id} {...common} x={s.x} y={s.y} radiusX={s.radiusX} radiusY={s.radiusY} stroke={s.stroke} strokeWidth={s.strokeWidth} />
      case 'Text':
        return <Text key={s.id} {...common} x={s.x} y={s.y} text={s.text} fontSize={s.fontSize} fontFamily={s.fontFamily} fill={s.fill} onDblClick={() => setEditingText({ id: s.id, x: s.x, y: s.y, value: s.text })} />
      case 'Label':
        return (
          <Label key={s.id} {...common} x={s.x} y={s.y}>
            <Tag fill={s.tag.fill} cornerRadius={s.tag.cornerRadius} pointerDirection={s.tag.pointerDirection} pointerWidth={s.tag.pointerWidth} pointerHeight={s.tag.pointerHeight} />
            <Text text={s.text.text} fontSize={s.text.fontSize} fontFamily={s.text.fontFamily} fill={s.text.fill} padding={s.text.padding} />
          </Label>
        )
      case 'Line':
        return <Line key={s.id} {...common} points={s.points} stroke={s.stroke} strokeWidth={s.strokeWidth} tension={s.tension} lineCap={s.lineCap} lineJoin={s.lineJoin} />
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-steel-700 bg-steel-800 p-2">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            aria-label={label}
            title={label}
            data-testid={`annotate-tool-${id}`}
            onClick={() => setTool(id)}
            className={`${btn} ${tool === id ? 'bg-brand-yellow text-steel-900 hover:bg-brand-yellow' : ''}`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-steel-700" />
        <button type="button" aria-label="Undo" title="Undo" disabled={!canUndo(history)} onClick={() => setHistory((h) => undo(h))} className={btn}>
          <Undo2 className="size-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!canRedo(history)} onClick={() => setHistory((h) => redo(h))} className={btn}>
          <Redo2 className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Delete the selected mark"
          title="Delete the selected mark"
          disabled={!selectedId}
          onClick={() => {
            if (selectedId) {
              commit(removeShape(scene, selectedId))
              setSelectedId(null)
            }
          }}
          className={btn}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={penOnly}
          onClick={() => setPenOnly((v) => !v)}
          className={`${btn} px-3 text-meta ${penOnly ? 'bg-brand-yellow text-steel-900 hover:bg-brand-yellow' : ''}`}
        >
          Pen only
        </button>
        <span className="flex-1" />
        {error && (
          <p role="alert" className="text-ui text-white">
            {error}
          </p>
        )}
        <button type="button" disabled={saving} onClick={onClose} data-testid="annotate-close" className={`${btn} px-4 text-ui`}>
          Close
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          data-testid="annotate-save"
          className="min-h-tap rounded-lg bg-brand-yellow px-4 text-ui font-semibold text-steel-900 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <div className="relative" style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
          <Stage
            ref={stageRef}
            width={naturalWidth * scale}
            height={naturalHeight * scale}
            scaleX={scale}
            scaleY={scale}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            style={{ touchAction: penOnly || tool !== 'select' ? 'none' : 'auto' }}
          >
            {/* The photo sits in its own layer, outside the scene JSON. */}
            <Layer listening={tool === 'select'}>
              <KonvaImage name="photo" image={img} width={naturalWidth} height={naturalHeight} />
            </Layer>
            <Layer>
              {scene.shapes.map(renderShape)}
              <Transformer ref={trRef} rotateEnabled ignoreStroke />
            </Layer>
          </Stage>
          {editingText && (
            <textarea
              autoFocus
              aria-label="Text on the photo"
              value={editingText.value}
              onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitText()
                }
              }}
              className="absolute min-w-20 rounded border border-brand-yellow bg-paper-1 px-1 text-ui text-ink-900"
              style={{ left: editingText.x * scale, top: editingText.y * scale }}
            />
          )}
        </div>
      </div>
    </>
  )
}
