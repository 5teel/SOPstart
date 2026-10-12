/**
 * Phase 63 -- automatic layout of the library's areas and their objects on the isometric ground.
 * Plain module, pure over counts, kinds and the area tree (no titles).
 *
 * ADR-0010: areas nest (a department inside a department, any depth). A parent is a plate holding
 * its children's plates, plus a block of its own SOPs on its floor; each plate stands on its parent
 * (z = depth x PLATE_H). Siblings are packed into rows by the org's packing, and every row is
 * filled out to the full width and depth, so no bare floor is left; the gaps are walkways.
 */
import { FOOTPRINT, PLATE_H, project, type Pt } from './iso'
import type { ObjectKind } from './object-kind'

export type Packing = 'balanced' | 'rows'
export const PACKINGS: readonly Packing[] = ['balanced', 'rows']

export interface LayoutArea { id: string; count: number; kinds: ObjectKind[]; children?: LayoutArea[] }
/** depth 0 stands on the ground; a child stands on its parent's top. */
export interface Plate { id: string; x: number; y: number; w: number; d: number; depth: number; parentId: string | null }
/** cw x cd: the object's bay (its share of the floor), centred on cx, cy; z: the floor it stands on. */
export interface Placed { areaId: string; i: number; kind: ObjectKind; x: number; y: number; cx: number; cy: number; cw: number; cd: number; z: number }
/** A walkway on a floor at height z: the ground (on: null) or an area's floor (on: its id). */
export interface Lane { x: number; y: number; w: number; d: number; z: number; on: string | null }
export interface SiteLayout { plates: Plate[]; objects: Placed[]; lanes: Lane[]; ground: [number, number, number, number] }

const CELL_W = 2.8
const CELL_D = 2.4
const MARGIN = 0.8
const GAP = 1.5 // between areas on the ground; the spec floor is 1
const INNER_GAP = 1 // between sub-areas on a parent's floor
const MIN_W = 5
const MIN_D = 4

interface Box { w: number; d: number }
interface Rect extends Box { x: number; y: number }

function grid(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt((count * CELL_D) / CELL_W)))
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) }
}

const leafSize = (count: number): Box => {
  const { cols, rows } = grid(count)
  return { w: Math.max(MIN_W, cols * CELL_W + 2 * MARGIN), d: Math.max(MIN_D, rows * CELL_D + 2 * MARGIN) }
}

/** Rows of item indices. 'rows': shelf rows, biggest first. 'balanced': the row count whose even split is nearest square. */
function rowsOf(items: Box[], packing: Packing, gap: number): number[][] {
  const idx = items.map((_, i) => i)
  if (packing === 'rows') {
    const order = [...idx].sort((p, q) => items[q].w * items[q].d - items[p].w * items[p].d || p - q)
    const target = Math.sqrt(items.reduce((s, b) => s + (b.w + gap) * (b.d + gap), 0) * 1.5)
    const rows: number[][] = []
    let x = 0
    for (const i of order) {
      if (rows.length === 0 || (x > 0 && x + items[i].w > target)) { rows.push([]); x = 0 }
      rows[rows.length - 1].push(i)
      x += items[i].w + gap
    }
    return rows
  }
  // Balanced: for each row count, deal the widest items first into the shortest row (LPT), keep the
  // input order inside a row, and score the bounding box by area x squareness.
  // ponytail: O(n^2 log n) over siblings; fine to a few hundred areas per level.
  const byWidth = [...idx].sort((p, q) => items[q].w - items[p].w || p - q)
  let best: number[][] = [idx]
  let bestScore = Infinity
  for (let r = 1; r <= items.length; r++) {
    const rows: number[][] = Array.from({ length: r }, () => [])
    const widths = new Array<number>(r).fill(0)
    for (const i of byWidth) {
      const k = widths.indexOf(Math.min(...widths))
      rows[k].push(i)
      widths[k] += items[i].w + (rows[k].length > 1 ? gap : 0)
    }
    for (const row of rows) row.sort((p, q) => p - q)
    rows.sort((p, q) => p[0] - q[0])
    const W = Math.max(...widths)
    const D = rows.reduce((s, row) => s + Math.max(...row.map((i) => items[i].d)), 0) + gap * (r - 1)
    const score = W * D * (1 + Math.log(W / D) ** 2)
    if (score < bestScore - 1e-9) { bestScore = score; best = rows }
  }
  return best
}

/**
 * Packs boxes into rows, then fills: every item takes its row's depth, a short row shares its spare
 * width, and spare depth (a target bigger than the packing) is shared by the rows.
 */
function pack(items: Box[], packing: Packing, gap: number, target?: Box): { rects: Rect[]; w: number; d: number; lanes: Rect[] } {
  if (items.length === 0) return { rects: [], w: target?.w ?? 0, d: target?.d ?? 0, lanes: [] }
  const rows = rowsOf(items, packing, gap)
  const rowW = rows.map((row) => row.reduce((s, i) => s + items[i].w, 0) + gap * (row.length - 1))
  const rowD = rows.map((row) => Math.max(...row.map((i) => items[i].d)))
  const W = Math.max(Math.max(...rowW), target?.w ?? 0)
  const D0 = rowD.reduce((s, d) => s + d, 0) + gap * (rows.length - 1)
  const D = Math.max(D0, target?.d ?? 0)
  const extraD = (D - D0) / rows.length
  const rects: Rect[] = new Array(items.length)
  const lanes: Rect[] = []
  let y = 0
  rows.forEach((row, r) => {
    const d = rowD[r] + extraD
    const extraW = (W - rowW[r]) / row.length
    let x = 0
    row.forEach((i, k) => {
      rects[i] = { x, y, w: items[i].w + extraW, d }
      x += rects[i].w
      if (k < row.length - 1) lanes.push({ x, y, w: gap, d })
      x += gap
    })
    y += d
    if (r < rows.length - 1) lanes.push({ x: 0, y, w: W, d: gap })
    y += gap
  })
  return { rects, w: W, d: D, lanes }
}

export function layoutSite(areas: LayoutArea[], packing: Packing = 'balanced'): SiteLayout {
  const sizes = new Map<LayoutArea, Box>()
  const ownBlock = (a: LayoutArea): Box | null => {
    if (a.count === 0) return null
    const { cols, rows } = grid(a.count)
    return { w: cols * CELL_W, d: rows * CELL_D }
  }
  const itemsOf = (a: LayoutArea): Box[] => {
    const own = ownBlock(a)
    return [...(a.children ?? []).map(natural), ...(own ? [own] : [])]
  }
  function natural(a: LayoutArea): Box {
    const hit = sizes.get(a)
    if (hit) return hit
    let box = leafSize(a.count)
    if (a.children?.length) {
      const p = pack(itemsOf(a), packing, INNER_GAP)
      box = { w: Math.max(MIN_W, p.w + 2 * MARGIN), d: Math.max(MIN_D, p.d + 2 * MARGIN) }
    }
    sizes.set(a, box)
    return box
  }

  const plates: Plate[] = []
  const objects: Placed[] = []
  const lanes: Lane[] = []

  const gridOn = (a: LayoutArea, r: Rect, m: number, z: number) => {
    const { cols, rows } = grid(a.count)
    const iw = r.w - 2 * m
    const id = r.d - 2 * m
    for (let i = 0; i < a.count; i++) {
      const kind = a.kinds[i] ?? 'machine'
      const [fw, fd] = FOOTPRINT[kind]
      const cx = r.x + m + ((i % cols) + 0.5) * (iw / cols)
      const cy = r.y + m + (Math.floor(i / cols) + 0.5) * (id / rows)
      objects.push({ areaId: a.id, i, kind, x: cx - fw / 2, y: cy - fd / 2, cx, cy, cw: iw / cols, cd: id / rows, z })
    }
  }

  function place(a: LayoutArea, r: Rect, depth: number, parentId: string | null) {
    plates.push({ id: a.id, ...r, depth, parentId })
    const z = (depth + 1) * PLATE_H
    if (!a.children?.length) return gridOn(a, r, MARGIN, z)
    const p = pack(itemsOf(a), packing, INNER_GAP, { w: r.w - 2 * MARGIN, d: r.d - 2 * MARGIN })
    const at = (q: Rect): Rect => ({ x: r.x + MARGIN + q.x, y: r.y + MARGIN + q.y, w: q.w, d: q.d })
    for (const l of p.lanes) lanes.push({ ...at(l), z, on: a.id })
    a.children.forEach((c, i) => place(c, at(p.rects[i]), depth + 1, a.id))
    if (a.count > 0) gridOn(a, at(p.rects[a.children.length]), 0, z)
  }

  const top = pack(areas.map(natural), packing, GAP)
  areas.forEach((a, i) => place(a, top.rects[i], 0, null))
  const [W, D] = [top.w, top.d]
  // A walkway ring round the site, then the aisles between areas.
  lanes.unshift(
    { x: -1, y: -1, w: W + 2, d: 1, z: 0, on: null },
    { x: -1, y: D, w: W + 2, d: 1, z: 0, on: null },
    { x: -1, y: 0, w: 1, d: D, z: 0, on: null },
    { x: W, y: 0, w: 1, d: D, z: 0, on: null },
    ...top.lanes.map((l) => ({ ...l, z: 0, on: null })),
  )
  return { plates, objects, lanes, ground: [-1, -1, W + 1, D + 1] }
}

function bounds(list: Pt[]): [number, number, number, number] {
  const xs = list.map((p) => p[0])
  const ys = list.map((p) => p[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0]
}

const corners = (p: Plate, zt: number): Pt[] =>
  [p.depth * PLATE_H, p.depth * PLATE_H + zt].flatMap((z) => [project(p.x, p.y, z), project(p.x + p.w, p.y, z), project(p.x, p.y + p.d, z), project(p.x + p.w, p.y + p.d, z)])

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
