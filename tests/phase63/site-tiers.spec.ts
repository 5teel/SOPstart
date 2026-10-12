/**
 * ADR-0010 -- the tiered site map: areas nest (department inside department), sibling areas pack
 * balanced or in rows, and every row fills its floor. Pure modules only. Registration: `phase63`.
 */
import { test, expect } from '@playwright/test'
import { FOOTPRINT, PLATE_H } from '../../src/lib/library/iso'
import { layoutSite, type LayoutArea, type Packing, type SiteLayout } from '../../src/lib/library/iso-layout'
import { buildAreas, deptPath, inArea, SITE_WIDE, type AreaInputs } from '../../src/lib/library/areas'

type R = { x: number; y: number; w: number; d: number }
const E = 1e-6
const inside = (c: R, p: R, m: number) => c.x >= p.x + m - E && c.y >= p.y + m - E && c.x + c.w <= p.x + p.w - m + E && c.y + c.d <= p.y + p.d - m + E
const apart = (a: R, b: R, gap: number) => a.x + a.w + gap <= b.x + E || b.x + b.w + gap <= a.x + E || a.y + a.d + gap <= b.y + E || b.y + b.d + gap <= a.y + E

const leaf = (id: string, count: number): LayoutArea => ({ id, count, kinds: Array(count).fill('machine') })
const TREE: LayoutArea[] = [
  { id: 'north', count: 3, kinds: Array(3).fill('board'), children: [
    { id: 'hot', count: 0, kinds: [], children: [leaf('furnace', 9), leaf('forming', 14), leaf('lehr', 5)] },
    { id: 'cold', count: 0, kinds: [], children: [leaf('inspection', 11), leaf('packing', 8)] },
    leaf('warehouse', 6),
  ] },
  { id: 'south', count: 0, kinds: [], children: [leaf('line1', 12), leaf('line2', 12), leaf('line3', 10)] },
  leaf('workshop', 15),
  leaf('office', 4),
  leaf('site-wide', 8),
]

function check(L: SiteLayout, tag: string) {
  const byId = new Map(L.plates.map((p) => [p.id, p]))
  // every child sits on its parent's floor, inside the margin, one level up
  for (const p of L.plates) {
    if (!p.parentId) continue
    const parent = byId.get(p.parentId)!
    expect(inside(p, parent, 0.8), `${tag} ${p.id} inside ${p.parentId}`).toBe(true)
    expect(p.depth, tag).toBe(parent.depth + 1)
  }
  // siblings never touch: a walkway between them
  for (const a of L.plates) for (const b of L.plates) {
    if (a.id < b.id && a.parentId === b.parentId) expect(apart(a, b, a.parentId ? 1 : 1.5), `${tag} ${a.id}/${b.id}`).toBe(true)
  }
  // objects stand on their own area's floor, clear of its sub-areas
  for (const o of L.objects) {
    const p = byId.get(o.areaId)!
    const [fw, fd] = FOOTPRINT[o.kind]
    const box = { x: o.x, y: o.y, w: fw, d: fd }
    expect(inside(box, p, 0.8), `${tag} object of ${o.areaId}`).toBe(true)
    expect(o.z, tag).toBeCloseTo((p.depth + 1) * PLATE_H, 9)
    for (const c of L.plates.filter((q) => q.parentId === p.id)) expect(apart(box, c, 0), `${tag} object clear of ${c.id}`).toBe(true)
  }
  // no bare floor on the ground: every row of top-level areas reaches the right edge
  const roots = L.plates.filter((p) => !p.parentId)
  for (const y of new Set(roots.map((p) => p.y))) {
    expect(Math.max(...roots.filter((p) => p.y === y).map((p) => p.x + p.w)), `${tag} row ${y}`).toBeCloseTo(L.ground[2] - 1, 6)
  }
}

test.describe('tiered site map layout (ADR-0010)', () => {
  for (const packing of ['balanced', 'rows'] as Packing[]) {
    test(`${packing}: nested plates, walkways, objects on their own floor`, () => {
      const L = layoutSite(TREE, packing)
      expect(L.plates).toHaveLength(16)
      expect(L.objects).toHaveLength(3 + 9 + 14 + 5 + 11 + 8 + 6 + 12 + 12 + 10 + 15 + 4 + 8)
      check(L, packing)
      expect(layoutSite(TREE, packing)).toEqual(L) // deterministic
      // walkways run on the ground and on every parent's floor
      expect(L.lanes.some((l) => l.on === null)).toBe(true)
      for (const id of ['north', 'hot', 'cold', 'south']) expect(L.lanes.some((l) => l.on === id), id).toBe(true)
    })
  }

  test('balanced packing never leaves a lone area on a row while others share one', () => {
    for (let n = 2; n <= 24; n++) {
      const L = layoutSite(Array.from({ length: n }, (_, i) => leaf(`a${i}`, 4)), 'balanced')
      const rows = new Map<number, number>()
      for (const p of L.plates) rows.set(p.y, (rows.get(p.y) ?? 0) + 1)
      const counts = [...rows.values()]
      expect(Math.max(...counts) - Math.min(...counts), `n=${n} rows ${counts}`).toBeLessThanOrEqual(1)
      // fills the floor: every row reaches the right edge
      for (const y of rows.keys()) expect(Math.max(...L.plates.filter((p) => p.y === y).map((p) => p.x + p.w))).toBeCloseTo(L.ground[2] - 1, 6)
    }
  })

  test('areas come with their ancestors, totals and tree order; cycles are broken', () => {
    const departments = [
      { id: 'plant', name: 'Plant', archived: false, parent_id: null },
      { id: 'hall', name: 'Hall', archived: false, parent_id: 'plant' },
      { id: 'line', name: 'Line', archived: false, parent_id: 'hall' },
      { id: 'yard', name: 'Yard', archived: false, parent_id: 'gone' },
      { id: 'x', name: 'X', archived: false, parent_id: 'y' },
      { id: 'y', name: 'Y', archived: false, parent_id: 'x' },
    ]
    const inputs: AreaInputs = {
      machinesBySop: new Map(),
      machineById: new Map(),
      departments,
      deptsBySop: new Map([['s1', ['line']], ['s2', ['line']], ['s3', ['plant']], ['s4', ['yard']], ['s5', ['x']]]),
    }
    const areas = buildAreas(['s1', 's2', 's3', 's4', 's5', 's6'], inputs)
    expect(areas.map((a) => [a.name, a.depth, a.total])).toEqual([
      ['Plant', 0, 3], ['Hall', 1, 2], ['Line', 2, 2], ['X', 0, 1], ['Yard', 0, 1], ['Site-wide', 0, 1],
    ])
    expect(areas.find((a) => a.id === 'hall')!.sopIds).toEqual([]) // drawn only as Line's parent
    expect(areas.find((a) => a.id === 'line')!.path).toEqual(['plant', 'hall', 'line'])
    expect(inArea(areas, 'line', 'plant')).toBe(true)
    expect(inArea(areas, 'line', 'hall')).toBe(true)
    expect(inArea(areas, 'plant', 'hall')).toBe(false)
    expect(inArea(areas, SITE_WIDE, null)).toBe(true)
    const raw = new Map(departments.map((d) => [d.id, d.parent_id]))
    expect(deptPath(raw, 'x')).toEqual(['x'])
    expect(deptPath(raw, 'y')).toEqual(['y'])
    expect(deptPath(raw, 'yard')).toEqual(['yard'])
    expect(deptPath(raw, 'line')).toEqual(['plant', 'hall', 'line'])
    // a flat org keeps the old shape: name order, Site-wide last, all top level
    const flat = buildAreas(['s4', 's6'], { ...inputs, departments: departments.map((d) => ({ ...d, parent_id: null })) })
    expect(flat.map((a) => [a.name, a.parentId, a.index])).toEqual([['Yard', null, 1], ['Site-wide', null, 2]])
  })
})
