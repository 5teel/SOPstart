/**
 * Phase 57 -- PLC-01 the four rooms are fixed constants (57-01, D-01).
 *
 * Unit spec over the pure module src/lib/site/rooms.ts, plus absence guards:
 * no table, no column, no server code behind the rooms. The owner descoped
 * "admin can position each room" (D-01); the verifier must not treat it as a gap.
 *
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { ROOMS, ROOM_IDS, roomPolygon } from '@/lib/site/rooms'

type P = readonly [number, number]

// Ray-cast point-in-polygon (even-odd rule).
function inside(pt: P, poly: ReadonlyArray<P>): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

test.describe('PLC-01 rooms', () => {
  test('there are exactly four rooms with the contract ids and names', () => {
    expect(ROOMS).toHaveLength(4)
    expect(ROOMS.map((r) => r.id)).toEqual(['office', 'smoko', 'workshop', 'noticeboard'])
    expect([...ROOM_IDS]).toEqual(['office', 'smoko', 'workshop', 'noticeboard'])
    expect(ROOMS.map((r) => r.name)).toEqual(['Office', 'Smoko room', 'Workshop', 'Noticeboard'])
  })

  test('every fraction is within 0 to 1 and every polygon has at least three points', () => {
    for (const r of ROOMS) {
      expect(r.frac.length, r.id).toBeGreaterThanOrEqual(3)
      for (const [x, y] of r.frac) {
        expect(x, r.id).toBeGreaterThanOrEqual(0)
        expect(x, r.id).toBeLessThanOrEqual(1)
        expect(y, r.id).toBeGreaterThanOrEqual(0)
        expect(y, r.id).toBeLessThanOrEqual(1)
      }
    }
  })

  test('no vertex of one room lies inside another room', () => {
    for (const a of ROOMS) {
      for (const b of ROOMS) {
        if (a.id === b.id) continue
        for (const v of a.frac) expect(inside(v, b.frac), `${a.id} vertex ${v} inside ${b.id}`).toBe(false)
      }
    }
  })

  test('roomPolygon scales the fractions to the scene size and rounds to integers', () => {
    for (const [w, h] of [
      [1600, 900],
      [2752, 1536],
    ]) {
      for (const r of ROOMS) {
        const poly = roomPolygon(r.id, w, h)
        expect(poly).toEqual(r.frac.map(([fx, fy]) => [Math.round(fx * w), Math.round(fy * h)]))
        for (const [x, y] of poly) {
          expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
        }
      }
    }
  })

  test('D-01: no migration creates a room table', () => {
    const dir = path.join(process.cwd(), 'supabase', 'migrations')
    const offenders: string[] = []
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.sql')) continue
      const sql = fs.readFileSync(path.join(dir, f), 'utf-8')
      if (/create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?"?\w*room\w*"?/i.test(sql)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })

  test('D-01: rooms.ts is a plain module with no server directive and no database import', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'site', 'rooms.ts'), 'utf-8').replace(/\r\n/g, '\n')
    expect(src).not.toContain('use server')
    expect(src.toLowerCase()).not.toContain('supabase')
  })
})
