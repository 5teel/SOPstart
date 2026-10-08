/**
 * Phase 63 -- isometric projection, shape descriptors and glyphs. Requirement MAP-02. Owner: 63-03.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import { FOOTPRINT, HEIGHT, boxFaces, cylinder, glyph, project } from '../../src/lib/library/iso'

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
