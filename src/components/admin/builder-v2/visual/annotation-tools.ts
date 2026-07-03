/**
 * Phase 26 Plan 26-11 (R5, D-03 slice 2) — the PURE annotation tool model.
 *
 * This is the testable core the Konva editor (`AnnotationEditor.tsx`) drives:
 * primitive factories, the scene-JSON scene graph, snapshot undo/redo, non-
 * destructive serialize, and the stylus palm-rejection filter. Every shape here
 * is a plain object whose keys map 1:1 onto the matching react-konva node props
 * (`<Arrow points stroke .../>`, `<Rect x y width .../>`), so the editor just
 * spreads them.
 *
 * PURE by design — NO `konva`, NO `react` import — so the phase26 Playwright
 * project (no `@/` alias, can't load React barrels) exercises it in-process,
 * exactly like `media-adapter.ts`. Konva itself lives only in the `.tsx` leaf.
 *
 * Storage contract (v3.0 research §Storage): the scene holds SHAPES ONLY. The
 * background image URL is kept OUT of the scene and rehydrated at load time
 * (Konva pitfall #8) — coordinates are in natural-image space (pitfall #2), so
 * a scene re-opens pixel-identical regardless of display scale.
 */

/** Semantic accents (UI-SPEC §Visual): brand-yellow primary, hazard red for warnings — NOT arbitrary. */
export const SEMANTIC_ACCENTS = {
  primary: '#fbbf24',
  warning: '#ef4444',
} as const
export type Accent = keyof typeof SEMANTIC_ACCENTS

export type ShapeType = 'Arrow' | 'Rect' | 'Ellipse' | 'Text' | 'Label' | 'Line'

type Base = { id: string; type: ShapeType }

export type ArrowShape = Base & {
  type: 'Arrow'
  points: number[]
  stroke: string
  strokeWidth: number
  pointerLength: number
  pointerWidth: number
  tension: number
}
export type RectShape = Base & {
  type: 'Rect'
  x: number
  y: number
  width: number
  height: number
  stroke: string
  strokeWidth: number
  dash?: number[]
}
export type EllipseShape = Base & {
  type: 'Ellipse'
  x: number
  y: number
  radiusX: number
  radiusY: number
  stroke: string
  strokeWidth: number
}
export type TextShape = Base & {
  type: 'Text'
  x: number
  y: number
  text: string
  fontSize: number
  fontFamily: string
  fill: string
}
/** Numbered callout — Konva.Label (tag + text group). `number` auto-increments. */
export type LabelShape = Base & {
  type: 'Label'
  x: number
  y: number
  number: number
  tag: { fill: string; cornerRadius: number; pointerDirection: string; pointerWidth: number; pointerHeight: number }
  text: { text: string; fontSize: number; fontFamily: string; fill: string; padding: number }
}
export type LineShape = Base & {
  type: 'Line'
  points: number[]
  stroke: string
  strokeWidth: number
  tension: number
  lineCap: 'round' | 'butt' | 'square'
  lineJoin: 'round' | 'bevel' | 'miter'
}

export type Shape = ArrowShape | RectShape | EllipseShape | TextShape | LabelShape | LineShape

export const SCENE_SCHEMA_VERSION = 1 as const

export type Scene = {
  schemaVersion: typeof SCENE_SCHEMA_VERSION
  /** Natural-image space — the authoring canvas size (pitfall #2 coordinate stability). */
  width: number
  height: number
  shapes: Shape[]
}

const INTER = 'Inter'

/** Monotonic id — deterministic enough for a single editing session; ids only need scene-uniqueness. */
let idSeq = 0
function makeId(): string {
  idSeq += 1
  return `a${Date.now().toString(36)}_${idSeq}`
}
function accent(a: Accent = 'primary'): string {
  return SEMANTIC_ACCENTS[a]
}

export function emptyScene(width: number, height: number): Scene {
  return { schemaVersion: SCENE_SCHEMA_VERSION, width, height, shapes: [] }
}

// --- primitive factories (one per toolbar tool) ---

export function createArrow(opts: { points: number[]; accent?: Accent }): ArrowShape {
  return {
    id: makeId(),
    type: 'Arrow',
    points: opts.points,
    stroke: accent(opts.accent),
    strokeWidth: 6,
    pointerLength: 18,
    pointerWidth: 18,
    tension: 0,
  }
}

export function createRect(opts: {
  x: number
  y: number
  width: number
  height: number
  accent?: Accent
  dashed?: boolean
}): RectShape {
  return {
    id: makeId(),
    type: 'Rect',
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    stroke: accent(opts.accent),
    strokeWidth: 4,
    ...(opts.dashed ? { dash: [12, 6] } : {}),
  }
}

export function createEllipse(opts: {
  x: number
  y: number
  radiusX: number
  radiusY: number
  accent?: Accent
}): EllipseShape {
  return {
    id: makeId(),
    type: 'Ellipse',
    x: opts.x,
    y: opts.y,
    radiusX: opts.radiusX,
    radiusY: opts.radiusY,
    stroke: accent(opts.accent),
    strokeWidth: 4,
  }
}

export function createText(opts: { x: number; y: number; text: string; accent?: Accent }): TextShape {
  return {
    id: makeId(),
    type: 'Text',
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: 20,
    fontFamily: INTER,
    fill: accent(opts.accent),
  }
}

/**
 * Numbered callout (Konva.Label). The number auto-increments off the callouts
 * already in the scene, so placement order === visible numbering.
 */
export function createCallout(
  scene: Scene,
  opts: { x: number; y: number; label?: string; accent?: Accent }
): LabelShape {
  const number = scene.shapes.filter((s) => s.type === 'Label').length + 1
  const label = opts.label ? `${number}  ${opts.label}` : String(number)
  return {
    id: makeId(),
    type: 'Label',
    x: opts.x,
    y: opts.y,
    number,
    tag: { fill: accent(opts.accent), cornerRadius: 12, pointerDirection: 'left', pointerWidth: 10, pointerHeight: 10 },
    text: { text: label, fontSize: 20, fontFamily: INTER, fill: '#111', padding: 10 },
  }
}

export function createFreehand(opts: { points: number[]; accent?: Accent }): LineShape {
  return {
    id: makeId(),
    type: 'Line',
    points: opts.points,
    stroke: accent(opts.accent),
    strokeWidth: 5,
    tension: 0.4,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

// --- scene ops (immutable) ---

export function addShape(scene: Scene, shape: Shape): Scene {
  return { ...scene, shapes: [...scene.shapes, shape] }
}
export function removeShape(scene: Scene, id: string): Scene {
  return { ...scene, shapes: scene.shapes.filter((s) => s.id !== id) }
}
export function updateShape(scene: Scene, id: string, patch: Partial<Shape>): Scene {
  return {
    ...scene,
    shapes: scene.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)),
  }
}

// --- undo / redo (scene-JSON snapshot stack) ---

export type History = { past: Scene[]; present: Scene; future: Scene[] }

export function initHistory(scene: Scene): History {
  return { past: [], present: scene, future: [] }
}
/** Push the current present onto the past, adopt `next`, and branch away any redo future. */
export function commitScene(h: History, next: Scene): History {
  return { past: [...h.past, h.present], present: next, future: [] }
}
export function undo(h: History): History {
  if (h.past.length === 0) return h
  const previous = h.past[h.past.length - 1]
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] }
}
export function redo(h: History): History {
  if (h.future.length === 0) return h
  const next = h.future[0]
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1) }
}
export function canUndo(h: History): boolean {
  return h.past.length > 0
}
export function canRedo(h: History): boolean {
  return h.future.length > 0
}

// --- non-destructive serialize (image URL stays OUT) ---

/** Serialize to a Konva-compatible JSON scene graph. Shapes only — no image ref. */
export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene)
}
/** Re-open a serialized scene for editing (non-destructive round-trip). */
export function deserializeScene(json: string): Scene {
  const parsed = JSON.parse(json) as Scene
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    width: parsed.width,
    height: parsed.height,
    shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
  }
}

// --- stylus palm rejection ---

export type PointerType = 'pen' | 'touch' | 'mouse'
/**
 * Palm-rejection filter (pitfall #5). While "Pen only" is active, non-pen
 * pointers (finger / palm / mouse) are ignored so a resting hand leaves no marks.
 */
export function acceptsPointer(pointerType: PointerType | string, opts: { penOnly: boolean }): boolean {
  if (!opts.penOnly) return true
  return pointerType === 'pen'
}
