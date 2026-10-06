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
import { SITE_PRESETS, PRESET_ROOMS, SITE_PRESET_IDS, roomsFor } from '@/lib/site/presets'

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

// ADR-0003: each site template carries its own picture, rooms and machines.
test.describe('ADR-0003 site templates', () => {
  const inRange = ([x, y]: P) => x >= 0 && x <= 1 && y >= 0 && y <= 1

  test('every template id has a preset, rooms, a picture and a database check value', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '00075_site_layout_preset.sql'), 'utf-8')
    expect(SITE_PRESETS.map((p) => p.id)).toEqual([...SITE_PRESET_IDS])
    for (const id of SITE_PRESET_IDS) {
      expect(PRESET_ROOMS[id].map((r) => r.id), id).toEqual([...ROOM_IDS])
      expect(fs.existsSync(path.join(process.cwd(), 'public', 'site-presets', `${id}.jpg`)), id).toBe(true)
      expect(migration, id).toContain(`'${id}'`)
    }
  })

  test('roomsFor picks the template rooms and falls back to the default table', () => {
    expect(roomsFor(null)).toBe(ROOMS)
    expect(roomsFor('nope')).toBe(ROOMS)
    expect(roomsFor('railway')).toBe(PRESET_ROOMS.railway)
  })

  test('outlines are in range, departments resolve, and no room or machine corner sits inside a room', () => {
    for (const p of SITE_PRESETS) {
      const rooms = PRESET_ROOMS[p.id]
      for (const m of p.machines) {
        expect(p.departments[m.dept], `${p.id} ${m.name}`).toBeTruthy()
        expect(m.frac.every(inRange), `${p.id} ${m.name}`).toBe(true)
        for (const r of rooms) for (const v of m.frac) expect(inside(v, r.frac), `${p.id} ${m.name} in ${r.id}`).toBe(false)
      }
      for (const a of rooms) {
        expect(a.frac.every(inRange), `${p.id} ${a.id}`).toBe(true)
        for (const b of rooms) if (a.id !== b.id) for (const v of a.frac) expect(inside(v, b.frac), `${p.id} ${a.id} in ${b.id}`).toBe(false)
      }
      expect(new Set(p.machines.map((m) => m.name)).size, p.id).toBe(p.machines.length)
    }
  })
})
