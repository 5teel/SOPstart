/**
 * Phase 63 -- automatic layout of the library's areas and their objects on the isometric ground.
 * Plain module, pure over counts and kinds (no titles). The sketch hand-placed eight areas; this
 * packs any number.
 */
import { FOOTPRINT, project, type Pt } from './iso'
import type { ObjectKind } from './object-kind'

export interface LayoutArea { id: string; count: number; kinds: ObjectKind[] }
export interface Plate { id: string; x: number; y: number; w: number; d: number }
export interface Placed { areaId: string; i: number; kind: ObjectKind; x: number; y: number; cx: number; cy: number }
export interface SiteLayout { plates: Plate[]; objects: Placed[]; ground: [number, number, number, number] }

const CELL_W = 2.8
const CELL_D = 2.4
const MARGIN = 0.8
const GAP = 1.5 // between plates; the spec floor is 1
const MIN_W = 5
const MIN_D = 4

function grid(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt((count * CELL_D) / CELL_W)))
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) }
}

function sizeOf(count: number) {
  const { cols, rows } = grid(count)
  return { w: Math.max(MIN_W, cols * CELL_W + 2 * MARGIN), d: Math.max(MIN_D, rows * CELL_D + 2 * MARGIN) }
}

export function layoutSite(areas: LayoutArea[]): SiteLayout {
  const sized = areas
    .map((a, idx) => ({ a, idx, ...sizeOf(a.count) }))
    .sort((p, q) => q.w * q.d - p.w * p.d || p.idx - q.idx) // stable: ties keep input order

  // Shelf pack: fill rows left to right up to a width that makes the site roughly square-ish.
  // ponytail: shelf packing leaves gaps for very uneven plate sizes; upgrade path is a skyline packer.
  const target = Math.sqrt(sized.reduce((s, p) => s + (p.w + GAP) * (p.d + GAP), 0) * 1.5)
  const plates: Plate[] = []
  let x = 0, y = 0, rowD = 0
  for (const p of sized) {
    if (x > 0 && x + p.w > target) { x = 0; y += rowD + GAP; rowD = 0 }
    plates.push({ id: p.a.id, x, y, w: p.w, d: p.d })
    x += p.w + GAP
    rowD = Math.max(rowD, p.d)
  }

  const objects: Placed[] = []
  for (const p of sized) {
    const plate = plates.find((q) => q.id === p.a.id)!
    const { cols, rows } = grid(p.a.count)
    const iw = plate.w - 2 * MARGIN
    const id = plate.d - 2 * MARGIN
    for (let i = 0; i < p.a.count; i++) {
      const kind = p.a.kinds[i] ?? 'machine'
      const [fw, fd] = FOOTPRINT[kind]
      const cx = plate.x + MARGIN + ((i % cols) + 0.5) * (iw / cols)
      const cy = plate.y + MARGIN + (Math.floor(i / cols) + 0.5) * (id / rows)
      objects.push({ areaId: plate.id, i, kind, x: cx - fw / 2, y: cy - fd / 2, cx, cy })
    }
  }

  const x1 = Math.max(0, ...plates.map((p) => p.x + p.w))
  const y1 = Math.max(0, ...plates.map((p) => p.y + p.d))
  return { plates, objects, ground: [-1, -1, x1 + 1, y1 + 1] }
}

function bounds(list: Pt[]): [number, number, number, number] {
  const xs = list.map((p) => p[0])
  const ys = list.map((p) => p[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0]
}

const corners = (p: Plate, zt: number): Pt[] =>
  [0, zt].flatMap((z) => [project(p.x, p.y, z), project(p.x + p.w, p.y, z), project(p.x, p.y + p.d, z), project(p.x + p.w, p.y + p.d, z)])

/** The viewBox for the whole site (null) or one area's zoom. An unknown id is the whole site. */
export function viewFor(layout: SiteLayout, areaId: string | null): [number, number, number, number] {
  const plate = areaId === null ? undefined : layout.plates.find((p) => p.id === areaId)
  if (!plate) {
    const [gx0, gy0, gx1, gy1] = layout.ground
    const ground = [project(gx0, gy0), project(gx1, gy0), project(gx0, gy1), project(gx1, gy1)]
    const [x, y, w, h] = bounds([...layout.plates.flatMap((p) => corners(p, 3.6)), ...ground])
    return [x - 16, y - 16, w + 32, h + 32]
  }
  const [x, y, w, h] = bounds(corners(plate, 3.2))
  return [x - 50, y - 30, w + 100, h + 70]
}

/** Painter's order: far to near. Objects sort on their centre when they have one. Does not mutate. */
export function byDepth<T extends { x: number; y: number; cx?: number; cy?: number }>(list: T[]): T[] {
  const key = (o: T) => (o.cx ?? o.x) + (o.cy ?? o.y)
  return [...list].sort((a, b) => key(a) - key(b))
}
