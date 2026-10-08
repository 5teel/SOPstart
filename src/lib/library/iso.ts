/**
 * Phase 63 -- the isometric drawing engine, ported from sketch 009. Plain module: it returns
 * shape descriptors, the map component (63-10) maps them to SVG. Colours are token ROLES
 * (strings such as 'steel-top'), never hex; the component resolves a role to a token, and the
 * area colour for the 'accent-*' roles.
 */
import type { ObjectKind } from './object-kind'

export const TILE = 20
const COS30 = 0.866

export type Pt = [number, number]
export type Shape =
  | { k: 'poly'; pts: Pt[]; role: string }
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number; role: string }
  | { k: 'rect'; x: number; y: number; w: number; h: number; role: string }
  | { k: 'line'; pts: [Pt, Pt]; role: string }

export interface FaceRoles { top: string; right: string; left: string }
export interface CylRoles { side: string; top: string; band?: string }

export const project = (x: number, y: number, z = 0): Pt => [(x - y) * TILE * COS30, (x + y) * TILE * 0.5 - z * TILE]

const r1 = (n: number) => Math.round(n * 10) / 10
const pt = (x: number, y: number, z: number): Pt => { const [a, b] = project(x, y, z); return [r1(a), r1(b)] }

/** Right, left and top faces of a box, in painter's order. */
export function boxFaces(x: number, y: number, z: number, w: number, d: number, h: number, roles: FaceRoles): Shape[] {
  return [
    { k: 'poly', role: roles.right, pts: [pt(x + w, y, z), pt(x + w, y + d, z), pt(x + w, y + d, z + h), pt(x + w, y, z + h)] },
    { k: 'poly', role: roles.left, pts: [pt(x, y + d, z), pt(x + w, y + d, z), pt(x + w, y + d, z + h), pt(x, y + d, z + h)] },
    { k: 'poly', role: roles.top, pts: [pt(x, y, z + h), pt(x + w, y, z + h), pt(x + w, y + d, z + h), pt(x, y + d, z + h)] },
  ]
}

export function cylinder(cx: number, cy: number, z: number, r: number, h: number, roles: CylRoles): Shape[] {
  const [bx, by] = project(cx, cy, z)
  const [, ty] = project(cx, cy, z + h)
  const rx = r * TILE * 1.2247
  const ry = r * TILE * 0.7071
  const out: Shape[] = [
    { k: 'ellipse', cx: r1(bx), cy: r1(by), rx: r1(rx), ry: r1(ry), role: roles.side },
    { k: 'rect', x: r1(bx - rx), y: r1(ty), w: r1(rx * 2), h: r1(by - ty), role: roles.side },
    { k: 'line', pts: [[r1(bx - rx), r1(ty)], [r1(bx - rx), r1(by)]], role: 'edge' },
    { k: 'line', pts: [[r1(bx + rx), r1(ty)], [r1(bx + rx), r1(by)]], role: 'edge' },
  ]
  if (roles.band) out.push({ k: 'rect', x: r1(bx - rx), y: r1((by + ty) / 2 - 3), w: r1(rx * 2), h: 6, role: roles.band })
  out.push({ k: 'ellipse', cx: r1(bx), cy: r1(ty), rx: r1(rx), ry: r1(ry), role: roles.top })
  return out
}

export const FOOTPRINT: Record<ObjectKind, [number, number]> = {
  machine: [1.5, 1.2], conveyor: [2.4, 0.7], tank: [1.4, 1.4], board: [1.2, 0.14], rack: [2.2, 0.7], forklift: [1.0, 1.4], bench: [1.6, 0.8],
}
export const HEIGHT: Record<ObjectKind, number> = {
  machine: 1.6, conveyor: 0.9, tank: 2.1, board: 1.7, rack: 1.9, forklift: 1.9, bench: 1.2,
}

const tone = (n: string): FaceRoles => ({ top: `${n}-top`, right: `${n}-side`, left: `${n}-dark` })
const STEEL = tone('steel')
const IRON = tone('iron')
const COAL = tone('coal')
const PAPER = tone('paper')
const CARD = tone('card')
const HAZARD = tone('hazard')
const ACCENT = tone('accent')

const FLOOR_Z = 0.3 // plate height; objects stand on it

/** The shapes of one object, (x, y) = its footprint origin. Port of the sketch's entity(). */
export function glyph(kind: ObjectKind, x: number, y: number): Shape[] {
  const [w, d] = FOOTPRINT[kind]
  const z = FLOOR_Z
  switch (kind) {
    case 'machine':
      return [
        ...boxFaces(x, y, z, w, d, 1.1, STEEL),
        ...boxFaces(x + 0.15, y + 0.15, z + 1.1, 0.6, 0.45, 0.4, ACCENT),
        ...boxFaces(x + w - 0.05, y + 0.3, z + 0.45, 0.05, 0.6, 0.4, COAL),
      ]
    case 'conveyor': {
      const out = boxFaces(x, y, z, w, d, 0.45, IRON)
      for (let i = 1; i < 6; i++) out.push({ k: 'line', role: 'iron-line', pts: [pt(x + (i * w) / 6, y, z + 0.45), pt(x + (i * w) / 6, y + d, z + 0.45)] })
      for (let i = 0; i < 3; i++) out.push(...cylinder(x + 0.5 + i * 0.7, y + d / 2, z + 0.45, 0.14, 0.42, { side: 'accent-soft-side', top: 'accent-soft-top' }))
      return out
    }
    case 'tank':
      return cylinder(x + 0.7, y + 0.7, z, 0.7, 1.7, { side: 'tank-side', top: 'tank-top', band: 'accent-dark' })
    case 'board':
      return [
        ...boxFaces(x + 0.04, y, z, 0.08, d, 1.6, IRON),
        ...boxFaces(x + w - 0.12, y, z, 0.08, d, 1.6, IRON),
        ...boxFaces(x, y, z + 0.7, w, d, 0.85, PAPER),
        ...boxFaces(x, y, z + 1.4, w, d, 0.2, ACCENT),
        ...[0.95, 1.1, 1.25].map((h): Shape => ({ k: 'line', role: 'ruling', pts: [pt(x + 0.18, y + d, z + h), pt(x + w - 0.3, y + d, z + h)] })),
      ]
    case 'rack': {
      const out: Shape[] = []
      for (const [dx, dy] of [[0, 0], [w - 0.08, 0], [0, d - 0.08], [w - 0.08, d - 0.08]]) out.push(...boxFaces(x + dx, y + dy, z, 0.08, 0.08, 1.8, ACCENT))
      ;[0.05, 0.75, 1.45].forEach((h, i) => {
        out.push(...boxFaces(x, y, z + h, w, d, 0.06, IRON))
        if (i < 2) out.push(...boxFaces(x + 0.15, y + 0.1, z + h + 0.06, 0.8, 0.5, 0.45, CARD), ...boxFaces(x + 1.1, y + 0.1, z + h + 0.06, 0.8, 0.5, 0.45, CARD))
      })
      return out
    }
    case 'forklift':
      return [
        ...boxFaces(x, y + 0.2, z, w, d - 0.2, 0.7, HAZARD),
        ...boxFaces(x + 0.15, y + 0.55, z + 0.7, 0.5, 0.5, 0.35, COAL),
        ...boxFaces(x + w, y + 0.2, z, 0.12, 1.0, 1.6, IRON),
        ...boxFaces(x + w + 0.12, y + 0.3, z + 0.05, 0.9, 0.12, 0.06, IRON),
        ...boxFaces(x + w + 0.12, y + 0.9, z + 0.05, 0.9, 0.12, 0.06, IRON),
      ]
    case 'bench':
      return [
        ...boxFaces(x, y, z, w, d, 0.75, PAPER),
        ...[0.3, 0.7, 1.1].flatMap((o) => cylinder(x + o, y + 0.4, z + 0.75, 0.1, 0.3, { side: 'accent-soft-side', top: 'accent-soft-top' })),
        ...boxFaces(x + 1.2, y + 0.1, z + 0.75, 0.3, 0.3, 0.35, COAL),
      ]
  }
}
