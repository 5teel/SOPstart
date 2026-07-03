'use client'

/**
 * Phase 26 / Plan 26-11 (D-03 slice 2, R5) — the full Konva annotation editor.
 *
 * Upgrades the 26-05 spike shell (a single static <Rect>) into the real editor:
 * six primitives (Arrow / Rect / Ellipse / Text / numbered callout / freehand),
 * selection + resize/rotate via `Konva.Transformer`, undo/redo over scene-JSON
 * snapshots, a `<textarea>` overlay for text editing, and a "Pen only" stylus
 * palm-rejection toggle. The scene is non-destructive Konva JSON in NATURAL-IMAGE
 * space — the background image URL stays OUT of the scene (pitfall #8) and is
 * rehydrated as a plain <img> background below the stage.
 *
 * All geometry/serialize/history logic lives in the PURE `annotation-tools.ts`
 * (unit-tested in-process); this file is only the react-konva view + input.
 *
 * HARD CONSTRAINT (D-03 / R8): this module statically imports react-konva and MUST
 * only be reached through `AnnotationEditorLoader` (dynamic ssr:false) from admin
 * builder-v2 code — never the worker `/sops/[sopId]` bundle. The
 * `konva-worker-isolation` lint + `check-bundle-size` gate enforce it.
 *
 * Pitfall 5 (26-RESEARCH): Stage instances leak on StrictMode remount —
 * `stage.destroy()` in effect cleanup releases the underlying canvas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Arrow, Rect, Ellipse, Text, Label, Tag, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { ArrowUpRight, Square, Circle, Type, Hash, PenTool, Undo2, Redo2, Trash2 } from 'lucide-react'
import {
  emptyScene,
  addShape,
  removeShape,
  updateShape,
  initHistory,
  commitScene,
  undo,
  redo,
  canUndo,
  canRedo,
  serializeScene,
  createArrow,
  createRect,
  createEllipse,
  createText,
  createCallout,
  createFreehand,
  acceptsPointer,
  type Scene,
  type Shape,
} from './annotation-tools'

type Tool = 'select' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'callout' | 'freehand'

const TOOLS: { id: Tool; label: string; Icon: typeof ArrowUpRight }[] = [
  { id: 'select', label: 'Select', Icon: ArrowUpRight },
  { id: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { id: 'rect', label: 'Rectangle', Icon: Square },
  { id: 'ellipse', label: 'Ellipse', Icon: Circle },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'callout', label: 'Callout', Icon: Hash },
  { id: 'freehand', label: 'Freehand', Icon: PenTool },
]

export type AnnotationEditorProps = {
  naturalWidth?: number
  naturalHeight?: number
  /** Background image URL — rendered as a plain <img>, kept OUT of the scene JSON. */
  imageUrl?: string
  /** Existing scene to re-open (non-destructive). */
  initialScene?: Scene
  /** Commit the scene JSON upward (persistence is Plan 26-13). */
  onChange?: (json: string) => void
}

export default function AnnotationEditor({
  naturalWidth = 800,
  naturalHeight = 600,
  imageUrl,
  initialScene,
  onChange,
}: AnnotationEditorProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const trRef = useRef<Konva.Transformer | null>(null)
  const layerRef = useRef<Konva.Layer | null>(null)

  const [history, setHistory] = useState(() =>
    initHistory(initialScene ?? emptyScene(naturalWidth, naturalHeight))
  )
  const scene = history.present
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [penOnly, setPenOnly] = useState(false)
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; value: string } | null>(null)

  // Track an in-progress freehand stroke id so pointermove appends points.
  const drawingId = useRef<string | null>(null)

  const commit = useCallback(
    (next: Scene) => {
      setHistory((h) => {
        const nh = commitScene(h, next)
        onChange?.(serializeScene(nh.present))
        return nh
      })
    },
    [onChange]
  )

  // Pitfall 5: explicit teardown so a StrictMode double-mount doesn't leak the stage.
  useEffect(() => {
    const stage = stageRef.current
    return () => {
      stage?.destroy()
    }
  }, [])

  // Bind the Transformer to the selected node.
  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    if (!selectedId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const node = stage.findOne(`#${selectedId}`)
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, scene])

  // Delete key removes the selected shape; Cmd/Ctrl+Z / Shift+Z undo/redo.
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

  function pointerPos(): { x: number; y: number } {
    const stage = stageRef.current
    const p = stage?.getPointerPosition()
    return { x: p?.x ?? 0, y: p?.y ?? 0 }
  }

  const handleStageDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Palm rejection: while "Pen only" is on, ignore finger/mouse contact.
      if (!acceptsPointer(e.evt.pointerType, { penOnly })) return

      // Click on empty stage with the select tool → clear selection.
      const clickedEmpty = e.target === e.target.getStage()
      if (tool === 'select') {
        if (clickedEmpty) setSelectedId(null)
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
          shape = createCallout(scene, { x, y, label: 'Label' })
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
    },
    [tool, penOnly, scene, commit]
  )

  const handleStageMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!drawingId.current) return
      if (!acceptsPointer(e.evt.pointerType, { penOnly })) return
      const { x, y } = pointerPos()
      setHistory((h) => {
        const line = h.present.shapes.find((s) => s.id === drawingId.current)
        if (!line || line.type !== 'Line') return h
        const next = updateShape(h.present, line.id, { points: [...line.points, x, y] } as Partial<Shape>)
        return { ...h, present: next }
      })
    },
    [penOnly]
  )

  const handleStageUp = useCallback(() => {
    if (drawingId.current) {
      drawingId.current = null
      setTool('select')
      onChange?.(serializeScene(scene))
    }
  }, [scene, onChange])

  const commitTextEdit = useCallback(() => {
    if (!editingText) return
    commit(updateShape(scene, editingText.id, { text: editingText.value } as Partial<Shape>))
    setEditingText(null)
    setTool('select')
  }, [editingText, scene, commit])

  const renderShape = useMemo(
    () => (s: Shape) => {
      const onSelect = () => tool === 'select' && setSelectedId(s.id)
      const draggable = tool === 'select'
      const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) =>
        commit(updateShape(scene, s.id, { x: e.target.x(), y: e.target.y() } as Partial<Shape>))
      const common = { id: s.id, onClick: onSelect, onTap: onSelect, draggable, onDragEnd }
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
    },
    [tool, scene, commit]
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar — one active tool at a time (UI-SPEC §Visual). */}
      <div className="flex items-center gap-1 rounded bg-steel-900 p-1">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            title={label}
            onClick={() => setTool(id)}
            className={`rounded p-2 ${tool === id ? 'bg-brand-yellow text-steel-900' : 'text-white hover:bg-steel-700'}`}
          >
            <Icon size={16} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-steel-700" />
        <button type="button" title="Undo" disabled={!canUndo(history)} onClick={() => setHistory((h) => undo(h))} className="rounded p-2 text-white hover:bg-steel-700 disabled:opacity-40">
          <Undo2 size={16} />
        </button>
        <button type="button" title="Redo" disabled={!canRedo(history)} onClick={() => setHistory((h) => redo(h))} className="rounded p-2 text-white hover:bg-steel-700 disabled:opacity-40">
          <Redo2 size={16} />
        </button>
        <button type="button" title="Delete selected" disabled={!selectedId} onClick={() => { if (selectedId) { commit(removeShape(scene, selectedId)); setSelectedId(null) } }} className="rounded p-2 text-white hover:bg-steel-700 disabled:opacity-40">
          <Trash2 size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-steel-700" />
        {/* Stylus palm rejection (pitfall #5) — on for iPad pen authoring. */}
        <button type="button" aria-pressed={penOnly} title="Pen only (palm rejection)" onClick={() => setPenOnly((v) => !v)} className={`rounded px-2 py-1 text-xs ${penOnly ? 'bg-brand-yellow text-steel-900' : 'text-white hover:bg-steel-700'}`}>
          Pen only
        </button>
      </div>

      {/* Canvas — natural-image space in a scroll container (coordinate stability). */}
      <div className="relative overflow-auto" style={{ maxWidth: '100%' }}>
        {/* Background image lives OUTSIDE the scene JSON (pitfall #8). */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" width={naturalWidth} height={naturalHeight} className="pointer-events-none absolute left-0 top-0 select-none" />
        ) : null}
        <Stage
          ref={stageRef}
          width={naturalWidth}
          height={naturalHeight}
          onPointerDown={handleStageDown}
          onPointerMove={handleStageMove}
          onPointerUp={handleStageUp}
          style={{ touchAction: penOnly ? 'none' : 'auto' }}
        >
          <Layer ref={layerRef}>
            {scene.shapes.map(renderShape)}
            <Transformer ref={trRef} rotateEnabled ignoreStroke />
          </Layer>
        </Stage>

        {/* Text-edit overlay — Konva has no inline editing (research pitfall). */}
        {editingText ? (
          <textarea
            autoFocus
            value={editingText.value}
            onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
            onBlur={commitTextEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitTextEdit()
              }
            }}
            className="absolute rounded border border-brand-yellow bg-white px-1 text-sm text-steel-900"
            style={{ left: editingText.x, top: editingText.y, minWidth: 80 }}
          />
        ) : null}
      </div>
    </div>
  )
}
