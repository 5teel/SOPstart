/**
 * Phase 51 -- pure scene helpers + editor prop contract (D-02, D-05, D-06, D-08).
 *
 * Plain module, no directive, no React/Konva/sharp/node: imports -- importable
 * from both client and server code. Only type-only imports from the validators.
 */
import type { Point, Polygon } from '@/lib/validators/site'

// -- Storage (D-05, mirrors sign-layout-data-images.ts) ---------------------
export const SCENE_BUCKET = 'site-scenes'
export const SCENE_SIGNED_TTL_SEC = 3600

export function scenePath(organisationId: string, layoutId: string, ext: string): string {
  return `${organisationId}/${layoutId}/scene.${ext}`
}

export function extForMime(mime: string): 'jpg' | 'png' | null {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  return null
}

// -- Machine code (Crockford base32, 6 chars, CSPRNG, unbiased) -------------
export const MACHINE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const MACHINE_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{6}$/

export function newMachineCode(): string {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < bytes.length; i++) {
    // 256 is a multiple of 32, so `% 32` is unbiased over the full byte range.
    code += MACHINE_CODE_ALPHABET[bytes[i] % 32]
  }
  return code
}

// -- Polygon geometry (scene-pixel space, D-02) ------------------------------
export function polygonWithinScene(polygon: Polygon, w: number, h: number): boolean {
  return polygon.every(([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h)
}

export function clampPoint(point: [number, number], w: number, h: number): Point {
  const x = Math.min(w, Math.max(0, Math.round(point[0])))
  const y = Math.min(h, Math.max(0, Math.round(point[1])))
  return [x, y]
}

export function centroid(polygon: Polygon): Point {
  const n = polygon.length
  const sum = polygon.reduce<[number, number]>(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y],
    [0, 0]
  )
  return [sum[0] / n, sum[1] / n]
}

// -- Pan / zoom (ported from .planning/sketches/007-plant-floor-navigation/index.html lines 343-354) --
export interface View {
  x: number
  y: number
  s: number
}

/** Re-measure on every fit call -- a stage built while hidden measures 0x0 (Pitfall 5). */
export function fitView(W: number, H: number, sceneWidth: number, sceneHeight: number): View | null {
  if (!W || !H) return null
  const s = Math.min(W / sceneWidth, H / sceneHeight) * 1.02
  const x = (W - sceneWidth * s) / 2
  const y = (H - sceneHeight * s) / 2
  return { x, y, s }
}

export interface Pointer {
  x: number
  y: number
}

/** Zoom-to-cursor: the scene point under `pointer` stays fixed on screen. */
export function zoomAt(view: View, pointer: Pointer, deltaY: number, min: number, max: number): View {
  const factor = deltaY < 0 ? 1.12 : 1 / 1.12
  const newScale = Math.min(max, Math.max(min, view.s * factor))
  const scenePoint = {
    x: (pointer.x - view.x) / view.s,
    y: (pointer.y - view.y) / view.s,
  }
  return {
    s: newScale,
    x: pointer.x - scenePoint.x * newScale,
    y: pointer.y - scenePoint.y * newScale,
  }
}

// -- Gemini scene generation prompt (D-06) -----------------------------------
// Validated prompt from CONTEXT.md § specifics with {industry}/{hot zone}
// generalised (this is a generic site editor, not industry-specific).
export const SCENE_STYLE_PROMPT =
  'Clean isometric 3D illustration of a manufacturing plant floor, 30° isometric, ' +
  'cutaway building, no roof, low walls. Crisp vector-isometric render, soft studio ' +
  'lighting, muted industrial palette (concrete grey floor with subtle 1 m grid, ' +
  'steel-blue and safety-yellow machines, warm orange glow only at hot processes) ' +
  'on plain #fafafa. No people, no text, no labels, no logos. Layout left→right ' +
  'with clear walkway gaps between every machine group so each is a distinct ' +
  'clickable object. Layout, as described by the site admin:'

export function buildScenePrompt(description: string): string {
  return `${SCENE_STYLE_PROMPT} ${description.trim()}`
}

// -- Gemini REST call shape (D-06, RESEARCH § Gemini) ------------------------
// Model-rot mitigation (2026-06-02 class): the route reads
// process.env.GEMINI_IMAGE_MODEL ?? GEMINI_IMAGE_MODEL_DEFAULT.
export const GEMINI_IMAGE_MODEL_DEFAULT = 'gemini-3.1-flash-image-preview'

export function geminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

export interface GeminiImageRequest {
  contents: [{ parts: [{ text: string }] }]
  generationConfig: {
    responseModalities: ['IMAGE']
    imageConfig: { aspectRatio: '16:9'; imageSize: '2K' }
  }
}

export function buildGeminiImageRequest(prompt: string): GeminiImageRequest {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
    },
  }
}

export function extractGeminiImage(json: unknown): { mimeType: string; data: string } | null {
  if (!json || typeof json !== 'object') return null
  const candidates = (json as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const parts = (candidates[0] as { content?: { parts?: unknown[] } })?.content?.parts
  if (!Array.isArray(parts)) return null
  for (const part of parts) {
    const p = part as Record<string, unknown>
    const inline = (p.inlineData ?? p.inline_data) as
      | { mimeType?: string; mime_type?: string; data?: string }
      | undefined
    if (inline && typeof inline.data === 'string') {
      const mimeType = inline.mimeType ?? inline.mime_type
      if (typeof mimeType === 'string') {
        return { mimeType, data: inline.data }
      }
    }
  }
  return null
}

// -- Worker plant camera (Phase 52, D-07/D-12) -------------------------------
// Ported from .planning/sketches/007-plant-floor-navigation/index.html
// (buildStage's zoomTo, lines 343-354, and the department-chip fit, 405-412).

/** Wheel zoom clamp (sketch: Math.min(2.4, Math.max(0.35, ...))). */
export const ZOOM_MIN = 0.35
export const ZOOM_MAX = 2.4
/** The machine panel's width in px -- fly-to targets clear of it. */
export const PLANT_PANEL_WIDTH = 380
/** Fly-to scale on machine click (sketch zoomTo: worker ns = 1.5). */
export const FLY_SCALE = 1.5
/** Department chip fit's scale cap (sketch: Math.min(..., 1.6)). */
export const ZONE_FIT_MAX = 1.6
/** Camera transition duration in ms (sketch: transform .35s, rounded). */
export const CAMERA_MS = 350

/** Fly the camera so `point` (scene px) lands centred, offset left of the
 *  panel: targetX = (W - PLANT_PANEL_WIDTH) / 2 (D-07). */
export function flyToView(
  W: number,
  H: number,
  point: Point,
  scale: number = FLY_SCALE,
  panelWidth: number = PLANT_PANEL_WIDTH
): View | null {
  if (!W || !H) return null
  const s = scale
  const x = (W - panelWidth) / 2 - point[0] * s
  const y = H / 2 - point[1] * s
  return { x, y, s }
}

/** Fit the camera to the bounding box of one or more polygons (department
 *  chip fit), capped at ZONE_FIT_MAX so a tiny department never over-zooms. */
export function fitBoxView(
  W: number,
  H: number,
  polygons: ReadonlyArray<ReadonlyArray<Point>>
): View | null {
  if (!W || !H) return null
  const points = polygons.flat()
  if (points.length === 0) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const bw = maxX - minX || 1
  const bh = maxY - minY || 1
  const s = Math.min((W - 80) / bw, (H - 120) / bh, ZONE_FIT_MAX)
  const x = W / 2 - (minX + bw / 2) * s
  const y = H / 2 - (minY + bh / 2) * s
  return { x, y, s }
}

// -- Zone colours (D-12) ------------------------------------------------------
// A department's own `colour` unless it is the 00035 column default, in which
// case the contract triple by name, then the next theme accent by index.
// Plain lib code so component code carries no hex (design-token lint).
const DEFAULT_DEPARTMENT_COLOUR = '#3b82f6'
const ZONE_NAME_COLOUR: Record<string, string> = {
  forming: 'var(--accent-voice)',
  general: 'var(--accent-measure)',
  engineering: 'var(--accent-inspect)',
}
const ZONE_EXTRA_COLOURS = [
  'var(--accent-zone)',
  'var(--accent-signoff)',
  'var(--accent-decision)',
  'var(--accent-escalate)',
]

export function zoneColour(dept: { name: string; colour: string | null }, index: number): string {
  if (dept.colour && dept.colour !== DEFAULT_DEPARTMENT_COLOUR) return dept.colour
  const known = ZONE_NAME_COLOUR[dept.name.trim().toLowerCase()]
  if (known) return known
  return ZONE_EXTRA_COLOURS[index % ZONE_EXTRA_COLOURS.length]
}

// -- Editor prop contract (consumed by 51-04/51-05; lives here so
// SiteWorkspace never imports from SiteEditor, which the Konva gate forbids) --
export interface SceneEditorMachine {
  id: string
  name: string
  polygon: Point[]
  colour: string | null
}

export interface SceneEditorProps {
  sceneUrl: string
  sceneWidth: number
  sceneHeight: number
  machines: SceneEditorMachine[]
  selectedId: string | null
  drawing: boolean
  onSelect(id: string | null): void
  onCreate(polygon: Point[]): void
  onPolygonChange(id: string, polygon: Point[]): void
}
