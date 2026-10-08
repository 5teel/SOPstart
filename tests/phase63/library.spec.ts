/**
 * Phase 63 -- the library classifier (area, type, object kind) and the row status.
 * Requirement MAP-01, HOME-02. Owner: 63-02. Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { SITE_WIDE, areaOf, buildAreas, type AreaInputs } from '../../src/lib/library/areas'
import { sopTypeOf } from '../../src/lib/library/sop-type'
import { objectKindOf } from '../../src/lib/library/object-kind'
import { rowStatus } from '../../src/lib/library/status'
import { walkOrder, type FocusStepLike } from '../../src/lib/sop/focus'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const [FORMING, ENGINEERING, GENERAL, ARCHIVED] = [id(1), id(2), id(3), id(4)]
const departments = [
  { id: ENGINEERING, name: 'Engineering', archived: false },
  { id: FORMING, name: 'Forming', archived: false },
  { id: GENERAL, name: 'General', archived: false },
  { id: ARCHIVED, name: 'Old', archived: true },
]
const machineById = new Map([
  [id(10), { name: 'Annealing lehr', sort: 1, department_id: FORMING }],
  [id(11), { name: 'Cold-end inspection line', sort: 2, department_id: FORMING }],
  [id(12), { name: 'Alkaline cleaning tank', sort: 1, department_id: ENGINEERING }],
  [id(13), { name: 'Lost', sort: 0, department_id: ARCHIVED }],
  [id(14), { name: 'Orphan', sort: 0, department_id: null }],
])

// Research 63-02 s2: the real org's four published SOPs, General tagged on all four.
const OTG = id(20)
const SAMPLE = id(21)
const ALKALINE = id(22)
const DOG = id(23)
const real: AreaInputs = {
  departments,
  machineById,
  machinesBySop: new Map([
    [OTG, [id(10)]],
    [SAMPLE, [id(11)]],
    [ALKALINE, [id(12)]],
  ]),
  deptsBySop: new Map([
    [OTG, [GENERAL, FORMING]],
    [SAMPLE, [GENERAL]],
    [ALKALINE, [GENERAL]],
    [DOG, [GENERAL]],
  ]),
}

test.describe('library classifier', () => {
  test('the machine department beats the tag, the real org yields three areas', () => {
    const areas = buildAreas([OTG, SAMPLE, ALKALINE, DOG], real)
    expect(areas.map((a) => [a.name, a.sopIds.length])).toEqual([
      ['Engineering', 1],
      ['Forming', 2],
      ['General', 1],
    ])
    expect(areas.find((a) => a.name === 'Forming')?.sopIds).toEqual([OTG, SAMPLE])
    expect(areas.find((a) => a.name === 'Engineering')?.sopIds).toEqual([ALKALINE])
    expect(areas.find((a) => a.name === 'General')?.sopIds).toEqual([DOG])
    expect(areas.map((a) => a.index)).toEqual([1, 2, 3])
    expect(areas.map((a) => a.colourVar)).toEqual(['var(--area-1)', 'var(--area-2)', 'var(--area-3)'])
  })

  test('machines fall through when archived, missing or department-less; the first tag is by name', () => {
    const inputs: AreaInputs = {
      departments,
      machineById,
      machinesBySop: new Map([['a', [id(13), id(14), 'missing']]]),
      deptsBySop: new Map([['a', [ARCHIVED, GENERAL, FORMING]]]),
    }
    expect(areaOf('a', inputs)).toBe(FORMING) // Forming sorts before General; archived skipped
    expect(areaOf('none', inputs)).toBe(SITE_WIDE)
    expect(areaOf('a', { ...inputs, deptsBySop: new Map() })).toBe(SITE_WIDE)
  })

  test('machines are ordered by sort then name', () => {
    const inputs: AreaInputs = { ...real, machinesBySop: new Map([['a', [id(11), id(12), id(10)]]]), deptsBySop: new Map() }
    // sort 1 ties: Alkaline cleaning tank (Engineering) beats Annealing lehr (Forming) by name
    expect(areaOf('a', inputs)).toBe(ENGINEERING)
  })

  test('empty departments never draw, Site-wide is last and cycles colour after eight', () => {
    expect(buildAreas([], real)).toEqual([])
    const depts = Array.from({ length: 9 }, (_, i) => ({ id: id(100 + i), name: `Dept ${i}`, archived: false }))
    const sops = [...depts.map((d, i) => `s${i}`), 'wide']
    const inputs: AreaInputs = {
      departments: depts,
      machineById: new Map(),
      machinesBySop: new Map(),
      deptsBySop: new Map(depts.map((d, i) => [`s${i}`, [d.id]])),
    }
    const areas = buildAreas(sops, inputs)
    expect(areas).toHaveLength(10)
    expect(areas[9].id).toBe(SITE_WIDE)
    expect(areas[9].name).toBe('Site-wide')
    expect(areas[8].colourVar).toBe('var(--area-1)')
    expect(areas[8].index).toBe(9)
  })

  test('sop type precedence: emergency, inspection, machine, process', () => {
    expect(sopTypeOf({ category_slug: 'emergency', placement: 'machine' }, true)).toBe('Emergency')
    expect(sopTypeOf({ category_slug: 'quality', placement: 'machine' }, true)).toBe('Inspection')
    expect(sopTypeOf({ category_slug: 'maintenance', placement: 'site' }, true)).toBe('Machine')
    expect(sopTypeOf({ category_slug: null, placement: 'machine' }, false)).toBe('Machine')
    expect(sopTypeOf({ category_slug: null, placement: 'site' }, false)).toBe('Process')
  })

  test('object kind from the first machine name', () => {
    const cases: [string | null, string][] = [
      ['Alkaline cleaning tank', 'tank'],
      ['Annealing lehr', 'conveyor'],
      ['Cold-end inspection line', 'conveyor'],
      ['Forklift', 'forklift'],
      ['Racking', 'rack'],
      ['Workbench', 'bench'],
      ['Lathe', 'machine'],
      ['Elevator', 'machine'],
      [null, 'board'],
    ]
    for (const [name, kind] of cases) expect(objectKindOf(name), String(name)).toBe(kind)
  })

  test('row status: one fixed precedence and the same step count as Read', () => {
    const steps: FocusStepLike[] = ['a', 'b', 'c'].map((s, i) => ({
      id: s,
      section_id: 's1',
      kind: 'step',
      text: s,
      photo_required: false,
      sort_order: i,
    }))
    const order = walkOrder([{ id: 's1', title: 'One', sort_order: 0 }], steps)
    const done = (c: { sopId: string; status: string; submittedAt: string } | null, extra = {}) => ({
      walk: null,
      order,
      latestCompletion: c,
      currentId: 'v2',
      hasNewerVersion: false,
      now: new Date('2026-10-08T00:00:00Z'),
      ...extra,
    })
    const signed = { sopId: 'v2', status: 'signed_off', submittedAt: '2026-09-12T00:00:00Z' }

    expect(rowStatus(done(signed, { walk: { done: ['a'] } }))).toMatchObject({ kind: 'stopped', step: 2, total: 3, text: 'You stopped at step 2' })
    expect(rowStatus(done(signed, { walk: { done: ['a', 'b', 'c'] } }))).toMatchObject({ step: 3, total: 3 })
    expect(rowStatus(done({ ...signed, status: 'pending_sign_off' }))).toMatchObject({ kind: 'waiting', text: 'Waiting for sign-off' })
    expect(rowStatus(done({ ...signed, sopId: 'v1' }))).toMatchObject({ kind: 'updated', text: 'Updated since you last did it' })
    expect(rowStatus(done(signed))).toMatchObject({ kind: 'signed', text: 'Signed off 12 Sept' })
    expect(rowStatus(done({ ...signed, status: 'rejected' }))).toBeNull()
    expect(rowStatus(done(null))).toBeNull()
  })

  test('the library modules are plain: no directive, no React, no Supabase, no to-do words in status', () => {
    const dir = path.join(process.cwd(), 'src/lib/library')
    for (const f of ['areas', 'sop-type', 'object-kind', 'status', 'recent']) {
      const src = fs.readFileSync(path.join(dir, `${f}.ts`), 'utf8')
      expect(src, f).not.toMatch(/'use client'|'use server'|@supabase|from 'react'/)
    }
    const status = fs.readFileSync(path.join(dir, 'status.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(status).not.toMatch(/due|overdue/)
  })
})
