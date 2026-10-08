/**
 * Phase 63 -- isometric projection, shape descriptors and glyphs. Requirement MAP-02. Owner: 63-03.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import { FOOTPRINT, HEIGHT, boxFaces, cylinder, glyph, project } from '../../src/lib/library/iso'
import { byDepth, layoutSite, viewFor } from '../../src/lib/library/iso-layout'
import type { ObjectKind } from '../../src/lib/library/object-kind'

const KINDS = ['machine', 'conveyor', 'tank', 'rack', 'forklift', 'bench', 'board'] as const

type Shape = ReturnType<typeof glyph>[number]
function numbers(s: Shape): number[] {
  const out: number[] = []
  for (const v of Object.values(s)) {
    if (typeof v === 'number') out.push(v)
    else if (Array.isArray(v)) out.push(...(v as number[][]).flat())
  }
  return out
}

test.describe('iso layout', () => {
  test('project matches the sketch P()', () => {
    const [x, y] = project(1, 0, 0)
    expect(x).toBeCloseTo(17.32, 2)
    expect(y).toBeCloseTo(10, 2)
    const [x2, y2] = project(0, 0, 1)
    expect(x2).toBeCloseTo(0, 2)
    expect(y2).toBeCloseTo(-20, 2)
  })

  test('boxFaces returns right, left, top polygons with token roles', () => {
    const roles = { top: 'plate-top', right: 'plate-right', left: 'plate-left' }
    const faces = boxFaces(0, 0, 0, 2, 3, 0.3, roles)
    expect(faces).toHaveLength(3)
    expect(faces.map((f) => f.role)).toEqual(['plate-right', 'plate-left', 'plate-top'])
    for (const f of faces) {
      expect(f.k).toBe('poly')
      if (f.k === 'poly') expect(f.pts).toHaveLength(4)
    }
  })

  test('cylinder returns finite shapes', () => {
    const shapes = cylinder(1, 1, 0.3, 0.7, 1.7, { side: 'tank-side', top: 'tank-top', band: 'accent' })
    expect(shapes.length).toBeGreaterThanOrEqual(4)
    for (const s of shapes) for (const n of numbers(s)) expect(Number.isFinite(n)).toBe(true)
  })

  test('FOOTPRINT and HEIGHT cover every kind', () => {
    for (const k of KINDS) {
      expect(FOOTPRINT[k]).toHaveLength(2)
      expect(HEIGHT[k]).toBeGreaterThan(0)
    }
  })

  test('glyph draws every kind with finite points and token-role colours', () => {
    for (const k of KINDS) {
      const shapes = glyph(k, 3, 4)
      expect(shapes.length, k).toBeGreaterThan(0)
      for (const s of shapes) {
        for (const n of numbers(s)) expect(Number.isFinite(n), k).toBe(true)
        expect(s.role, k).toMatch(/^[a-z][a-z-]*$/)
      }
    }
  })
})

// ---------------------------------------------------------------- Task 2: layout
type R = { x: number; y: number; w: number; d: number }
const overlap = (a: R, b: R, gap: number) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.d + gap && b.y < a.y + a.d + gap

const mk = (n: number, count: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    count,
    kinds: Array.from({ length: count }, (_, j) => KINDS[(i + j) % KINDS.length] as ObjectKind),
  }))

test.describe('iso layout', () => {
  test('no overlap, objects inside plates, plates inside the ground (4 x 4 matrix)', () => {
    for (const n of [1, 3, 8, 12]) {
      for (const count of [1, 6, 15, 40]) {
        const L = layoutSite(mk(n, count))
        const tag = `${n}x${count}`
        expect(L.plates, tag).toHaveLength(n)
        expect(L.objects, tag).toHaveLength(n * count)
        const [gx0, gy0, gx1, gy1] = L.ground
        for (let i = 0; i < L.plates.length; i++) {
          const p = L.plates[i]
          expect(p.x >= gx0 && p.y >= gy0 && p.x + p.w <= gx1 && p.y + p.d <= gy1, tag).toBe(true)
          for (let j = i + 1; j < L.plates.length; j++) expect(overlap(p, L.plates[j], 1), tag).toBe(false)
        }
        const boxes: Record<string, R[]> = {}
        for (const o of L.objects) {
          const p = L.plates.find((q) => q.id === o.areaId)!
          const [fw, fd] = FOOTPRINT[o.kind]
          expect(o.x >= p.x + 0.8 - 1e-9 && o.y >= p.y + 0.8 - 1e-9, tag).toBe(true)
          expect(o.x + fw <= p.x + p.w - 0.8 + 1e-9 && o.y + fd <= p.y + p.d - 0.8 + 1e-9, tag).toBe(true)
          const b = { x: o.x, y: o.y, w: fw, d: fd }
          const peers = (boxes[o.areaId] ??= [])
          for (const q of peers) expect(overlap(b, q, 0), tag).toBe(false)
          peers.push(b)
        }
      }
    }
  })

  test('deterministic, stable for equal sizes, one area centred, plates grow with count', () => {
    const input = mk(5, 6)
    expect(layoutSite(input)).toEqual(layoutSite(input))
    expect(layoutSite(input).plates.map((p) => p.id)).toEqual(['a0', 'a1', 'a2', 'a3', 'a4'])
    const one = layoutSite(mk(1, 1))
    const p = one.plates[0]
    expect(p.w).toBeGreaterThanOrEqual(5)
    expect(p.d).toBeGreaterThanOrEqual(4)
    const [gx0, gy0, gx1, gy1] = one.ground
    expect(p.x + p.w / 2).toBeCloseTo((gx0 + gx1) / 2, 6)
    expect(p.y + p.d / 2).toBeCloseTo((gy0 + gy1) / 2, 6)
    const small = layoutSite(mk(1, 1)).plates[0]
    const big = layoutSite(mk(1, 15)).plates[0]
    expect(big.w * big.d).toBeGreaterThan(small.w * small.d)
  })

  test('viewFor bounds the whole site, zooms to an area, falls back on an unknown id', () => {
    const L = layoutSite(mk(4, 6))
    const [vx, vy, vw, vh] = viewFor(L, null)
    const inside = ([x, y]: [number, number], pad: number) => x >= vx + pad - 1e-6 && y >= vy + pad - 1e-6 && x <= vx + vw - pad + 1e-6 && y <= vy + vh - pad + 1e-6
    const [gx0, gy0, gx1, gy1] = L.ground
    for (const c of [[gx0, gy0], [gx1, gy0], [gx0, gy1], [gx1, gy1]]) expect(inside(project(c[0], c[1], 0), 16)).toBe(true)
    for (const p of L.plates) {
      for (const [x, y] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.d], [p.x + p.w, p.y + p.d]]) {
        expect(inside(project(x, y, 3.6), 16)).toBe(true)
      }
    }
    const a = L.plates[2]
    const [ax, ay, aw, ah] = viewFor(L, a.id)
    const corner = project(a.x, a.y, 3.2)
    expect(corner[1]).toBeGreaterThanOrEqual(ay + 30 - 1e-6)
    expect(project(a.x + a.w, a.y, 0)[0]).toBeLessThanOrEqual(ax + aw - 50 + 1e-6)
    expect(aw).toBeLessThan(vw)
    expect(ah).toBeLessThan(vh)
    expect(viewFor(L, 'nope')).toEqual([vx, vy, vw, vh])
  })

  test('byDepth is painter order and does not mutate its input', () => {
    const list = [{ x: 3, y: 3 }, { x: 0, y: 1 }, { x: 2, y: 0 }]
    const sorted = byDepth(list)
    expect(sorted.map((o) => o.x + o.y)).toEqual([1, 2, 6])
    expect(list[0]).toEqual({ x: 3, y: 3 })
  })
})
