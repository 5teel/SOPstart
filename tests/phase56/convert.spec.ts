/**
 * Phase 56-02: the SOP converter is a pure module, so these are real
 * behavioural tests with static `@/` imports (precedent: tests/phase55/sop-pack.spec.ts).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  HANDLED_TYPES,
  checkGate,
  conversionHash,
  convertSop,
  planFocusStepWrites,
  readItem,
  type FocusStepDraft,
} from '@/lib/sop/convert'
import type { Section } from '@/lib/sop/sections'

type Row = Partial<Section['sop_steps'][number]>

function section(over: {
  id?: string
  title?: string
  section_type?: string
  sort_order?: number
  layout?: unknown[] | null
  content?: string | null
  rows?: Row[]
}): Section {
  return {
    id: over.id ?? 's1',
    sop_id: 'sop1',
    title: over.title ?? 'Procedure',
    section_type: over.section_type ?? 'procedure',
    section_kind: null,
    section_kind_id: null,
    content: over.content ?? null,
    sort_order: over.sort_order ?? 0,
    layout_data: over.layout === undefined || over.layout === null ? null : { root: { props: {} }, content: over.layout },
    sop_steps: (over.rows ?? []).map((r, i) => ({ id: `r${i}`, step_number: i + 1, text: '', ...r })),
    sop_images: [],
  } as unknown as Section
}

const it = (type: string, props: Record<string, unknown>) => ({ type, props })
const plain = section({})
const read = (type: string, props: Record<string, unknown>, s: Section = plain) => readItem(it(type, props), s)

// The 56-01 convert fixture (ids evh1..evm1)
const FIXTURE = [
  section({
    id: 'h', title: 'Hazards', section_type: 'hazards', sort_order: 0,
    layout: [
      it('HazardCardBlock', { id: 'evh1', title: 'Hazard', body: 'Pinch point at the rollers.', severity: 'warning' }),
      it('HazardCardBlock', { id: 'evh2', title: 'Hazard', body: 'Hot surface on the oven door.', severity: 'warning' }),
    ],
  }),
  section({
    id: 'p', title: 'PPE', section_type: 'ppe', sort_order: 1,
    layout: [it('PPECardBlock', { id: 'evp1', title: 'PPE Required', items: ['Safety glasses', 'Cut-resistant gloves'] })],
  }),
  section({
    id: 'pr', sort_order: 2,
    layout: [
      it('StepBlock', { id: 'evs1', number: 1, text: 'Isolate the press.' }),
      it('CalloutBlock', { id: 'evw1', title: 'Warning', body: 'Stored energy in the hydraulic line.' }),
      it('CalloutBlock', { id: 'evt1', title: 'Tip', body: 'Use your own lock.' }),
      it('StepWithPhotosBlock', { id: 'evs2', number: 2, text: 'Photograph the isolation lock.', photos: [], layout: 'single' }),
      it('CalloutBlock', { id: 'evc1', title: 'Caution', body: 'Do not reach past the guard.' }),
      it('MeasurementBlock', { id: 'evm1', label: 'Hydraulic pressure', unit: 'bar', tolerance: { min: 0, max: 5 } }),
    ],
    rows: [
      { text: 'Isolate the press.', time_estimate_minutes: 1 },
      { text: 'Photograph the isolation lock.', time_estimate_minutes: 1 },
    ],
  }),
]

test.describe('kinds', () => {
  test('every registry type maps per the table', () => {
    expect(read('HazardCardBlock', { body: 'x' }).steps[0]).toMatchObject({ kind: 'hazard', text: 'x' })
    expect(read('PPECardBlock', { items: ['A'] }).steps[0].kind).toBe('ppe')
    expect(read('StepBlock', { text: 't' }).steps[0]).toMatchObject({ kind: 'step', photoRequired: false })
    expect(read('StepWithPhotosBlock', { text: 't', photos: [{ src: 'org/a.jpg' }, { src: 'https://x/y.jpg' }] }).steps[0]).toMatchObject({
      kind: 'step', photoRequired: true, imagePaths: ['org/a.jpg'],
    })
    expect(read('MeasurementBlock', { label: 'Gap', unit: 'mm', tolerance: { min: 1, max: 2, target: 1.5 }, hint: 'Feeler' }).steps[0]).toMatchObject({
      kind: 'check', text: 'Check Gap: 1–2 mm, target 1.5 mm. Feeler',
    })
    const inspect = read('InspectBlock', { title: 'Pre-start', items: [{ label: 'Guards', requirePhoto: true }, { label: 'Oil' }] }).steps[0]
    expect(inspect).toMatchObject({ kind: 'check', photoRequired: true, text: 'Pre-start\nGuards\nOil' })
    expect(read('DecisionBlock', { question: 'Guard on?', options: [{ label: 'Yes' }, { label: 'No', isEscalation: true }] }).steps[0].text).toBe(
      'Guard on?\nIf Yes\nIf No (escalate)',
    )
    expect(read('SignOffBlock', { title: 'Sign', requiredRole: 'admin' }).steps[0]).toMatchObject({ kind: 'check', text: 'Sign (needs admin)' })
    for (const [type, props] of [
      ['TextBlock', { content: 'c' }], ['HeadingBlock', { text: 'h' }], ['ZoneBlock', { label: 'z', zoneType: 'danger' }],
      ['EscalateBlock', { title: 'e', reason: 'r' }], ['ModelBlock', { hotspots: [{ label: 'valve' }] }],
      ['CalloutBlock', { title: 'Note', body: 'n' }],
    ] as const) expect(read(type, props).steps[0].kind, type).toBe('step')
    expect(read('ModelBlock', { hotspots: [{ label: 'valve' }] }).steps[0].text).toBe('3D model: valve')
    expect(read('PhotoBlock', { src: 'org/p.jpg' }).steps[0]).toMatchObject({ photoRequired: true, text: 'Photo needed', imagePaths: ['org/p.jpg'] })
    expect(read('PhotoGridBlock', { items: [{ src: 'a', caption: 'One' }, { src: 'b', alt: 'Two' }] }).steps[0]).toMatchObject({
      photoRequired: true, text: 'One; Two', imagePaths: ['a', 'b'],
    })
  })

  test('VisualBlock becomes a photo step; video is dropped with a count; VoiceNote is dropped', () => {
    const v = read('VisualBlock', { items: [{ medium: 'photo', src: 'a.jpg', caption: 'P' }, { medium: 'diagram', src: 'd.jpg', bakedSrc: 'd-baked.png' }, { medium: 'video', src: 'v.mp4' }] })
    expect(v.steps[0]).toMatchObject({ kind: 'step', photoRequired: true, imagePaths: ['a.jpg', 'd-baked.png'] })
    expect(read('VisualBlock', { items: [{ medium: 'video', src: 'v.mp4' }] })).toMatchObject({ steps: [], dropped: 'video' })
    expect(read('VoiceNoteBlock', { prompt: 'say' })).toMatchObject({ steps: [], dropped: 'voice' })
  })

  test('unknown type and unreadable hazard/PPE are failures, not drops', () => {
    expect(read('MysteryBlock', {}).unreadable).toContain('unknown type MysteryBlock')
    expect(read('HazardCardBlock', { title: 'Hazard', body: '' }).unreadable).toBeTruthy()
    expect(read('HazardCardBlock', { title: 'Hot surface', body: '' }).steps[0]).toMatchObject({ kind: 'hazard', text: 'Hot surface' })
    expect(read('HazardCardBlock', { title: 'Burn', body: 'Hot', severity: 'critical' }).steps[0].text).toBe('Critical: Burn: Hot')
    expect(read('PPECardBlock', { title: 'PPE Required', items: [] }).unreadable).toBeTruthy()
    expect(read('CalloutBlock', { title: 'Warning', body: '' }).unreadable).toBeTruthy()
  })

  test('PPE items arrive as strings or { item }', () => {
    const t = read('PPECardBlock', { items: ['Glasses', { item: 'Gloves' }] }).steps[0].text
    expect(t).toContain('Glasses')
    expect(t).toContain('Gloves')
  })

  test('Warning / Caution go BEFORE the step they follow, Tip folds into it', () => {
    const c = convertSop({
      sopId: 'x',
      sopImagePaths: [],
      sections: [section({
        layout: [
          it('StepBlock', { id: 'A', text: 'A' }),
          it('CalloutBlock', { id: 'W', title: 'warning ', body: 'W' }),
          it('CalloutBlock', { id: 'T', title: 'Tip', body: 'T' }),
          it('StepWithPhotosBlock', { id: 'B', text: 'B', photos: [] }),
          it('CalloutBlock', { id: 'C', title: 'Caution', body: 'C' }),
        ],
      })],
    })
    expect(c.steps.map((s) => s.text)).toEqual(['Warning: W', 'A', 'Caution: C', 'B'])
    expect(c.steps.map((s) => s.sortOrder)).toEqual([0, 1, 2, 3])
    expect(c.steps.map((s) => s.sourceKey)).toEqual(['W', 'A', 'C', 'B'])
    expect(c.steps[1].tip).toBe('T')
    expect(c.steps[3].photoRequired).toBe(true)
    expect(c.before.tipsFolded).toBe(1)
  })

  test('a Warning and a Caution after one step both land before it, in order', () => {
    const c = convertSop({
      sopId: 'x', sopImagePaths: [],
      sections: [section({ layout: [
        it('StepBlock', { id: 'A', text: 'A' }),
        it('CalloutBlock', { id: 'W', title: 'Warning', body: 'W' }),
        it('CalloutBlock', { id: 'C', title: 'Caution', body: 'C' }),
      ] })],
    })
    expect(c.steps.map((s) => s.text)).toEqual(['Warning: W', 'Caution: C', 'A'])
  })

  test('a Tip with no preceding step stays as a step; an empty StepBlock does not re-anchor the tracker', () => {
    const c = convertSop({
      sopId: 'x', sopImagePaths: [],
      sections: [section({ layout: [
        it('TextBlock', { id: 't', content: 'intro' }),
        it('CalloutBlock', { id: 'T', title: 'Tip', body: 'Lone tip' }),
        it('StepBlock', { id: 'e', text: '' }),
        it('CalloutBlock', { id: 'W', title: 'Warning', body: 'W' }),
      ] })],
    })
    expect(c.steps.map((s) => s.text)).toEqual(['intro', 'Tip: Lone tip', 'Warning: W'])
    expect(c.before.emptyDropped).toBe(1)
  })

  test('text in hazard / PPE sections takes that kind (shared classifier), elsewhere a step', () => {
    const text = [it('TextBlock', { id: 't', content: 'Keep clear' })]
    const kind = (s: Section) => convertSop({ sopId: 'x', sopImagePaths: [], sections: [s] }).steps[0].kind
    expect(kind(section({ title: 'Hazards', section_type: 'hazards', layout: text }))).toBe('hazard')
    expect(kind(section({ title: 'PPE', section_type: 'ppe', layout: text }))).toBe('ppe')
    expect(kind(section({ layout: text }))).toBe('step')
  })

  test('rows fallback emits hazard, hazard, step(tip) with row keys', () => {
    const c = convertSop({
      sopId: 'x', sopImagePaths: ['org/a.jpg'],
      sections: [section({ rows: [{ id: 'row1', text: 'Do it', warning: 'Hot', caution: 'Slip', tip: 'Gloves', required_tools: ['Spanner'], time_estimate_minutes: 2 }] })],
    })
    expect(c.steps.map((s) => [s.kind, s.text, s.sourceKey])).toEqual([
      ['hazard', 'Warning: Hot', 'row:row1:warning'],
      ['hazard', 'Caution: Slip', 'row:row1:caution'],
      ['step', 'Do it', 'row:row1'],
    ])
    expect(c.steps[2]).toMatchObject({ tip: 'Gloves', requiredTools: ['Spanner'], timeEstimateMinutes: 2 })
    expect(c.source).toBe('rows')
    expect(c.gate.ok).toBe(true)
  })

  test('an empty layout content array falls back to the rows, so a row-level warning is kept', () => {
    const c = convertSop({
      sopId: 'x', sopImagePaths: [],
      sections: [section({ layout: [], rows: [{ id: 'row1', text: 'Do it', warning: 'Hot' }] })],
    })
    expect(c.steps.map((s) => [s.kind, s.sourceKey])).toEqual([
      ['hazard', 'row:row1:warning'],
      ['step', 'row:row1'],
    ])
    expect(c.before.hazardSources).toBe(1)
    expect(c.source).toBe('rows')
    expect(c.gate.ok).toBe(true)
  })

  test('step-less hazard / PPE content rows become hazard lines / one ppe step', () => {
    const c = convertSop({
      sopId: 'x', sopImagePaths: [],
      sections: [
        section({ id: 'h', title: 'Hazards', section_type: 'hazards', content: 'One\nTwo', sort_order: 0 }),
        section({ id: 'p', title: 'PPE', section_type: 'ppe', content: 'Glasses\nGloves', sort_order: 1 }),
      ],
    })
    expect(c.after).toMatchObject({ hazard: 2, ppe: 1 })
    expect(c.gate.ok).toBe(true)
  })

  test('tools and time zip by array index, or union onto the first step', () => {
    const layout = [it('StepBlock', { id: 'a', text: 'A' }), it('StepBlock', { id: 'b', text: 'B' })]
    const zipped = convertSop({ sopId: 'x', sopImagePaths: [], sections: [section({ layout, rows: [
      { text: 'A', step_number: 5, required_tools: ['X'], time_estimate_minutes: 1 },
      { text: 'B', step_number: 5, required_tools: null, time_estimate_minutes: 2 },
    ] })] })
    expect(zipped.steps.map((s) => [s.requiredTools, s.timeEstimateMinutes])).toEqual([[['X'], 1], [null, 2]])
    const union = convertSop({ sopId: 'x', sopImagePaths: [], sections: [section({ layout, rows: [
      { text: 'A', required_tools: ['X'], time_estimate_minutes: 1 }, { text: 'B', required_tools: ['Y', 'X'], time_estimate_minutes: 2 }, { text: 'C', time_estimate_minutes: 3 },
    ] })] })
    expect(union.steps[0]).toMatchObject({ requiredTools: ['X', 'Y'], timeEstimateMinutes: 6 })
    expect(union.steps[1]).toMatchObject({ requiredTools: null, timeEstimateMinutes: null })
  })

  test('duplicate and missing ids get stable fallback keys', () => {
    const c = convertSop({ sopId: 'x', sopImagePaths: [], sections: [section({ id: 'sec', layout: [
      it('StepBlock', { id: 'd', text: 'one' }), it('StepBlock', { id: 'd', text: 'two' }), it('StepBlock', { text: 'three' }),
    ] })] })
    expect(c.steps.map((s) => s.sourceKey)).toEqual(['d', 'd#2', 'pos:sec:2'])
    expect(c.before.missingIds).toBe(2)
  })

  test('the 56-01 fixture converts to hazard 4, ppe 1, step 2, check 1', () => {
    const c = convertSop({ sopId: 'x', sopImagePaths: [], sections: FIXTURE })
    expect(c.after).toMatchObject({ hazard: 4, ppe: 1, step: 2, check: 1, photoRequired: 1 })
    expect(c.source).toBe('layout')
    expect(c.gate).toEqual({ ok: true, failures: [] })
    expect(c.steps.find((s) => s.sourceKey === 'evm1')?.text).toBe('Check Hydraulic pressure: 0–5 bar')
    expect(c.steps.find((s) => s.sourceKey === 'evp1')?.text).toContain('Cut-resistant gloves')
  })
})

test.describe('gate', () => {
  const convert = (layout: unknown[], title = 'Hazards') =>
    convertSop({ sopId: 'x', sopImagePaths: [], sections: [section({ title, section_type: 'hazards', layout })] })

  test('fails on an unreadable hazard card, naming the section', () => {
    const c = convert([it('HazardCardBlock', { id: 'h', title: 'Hazard', body: '' })], 'Site hazards')
    expect(c.gate.ok).toBe(false)
    expect(c.gate.failures.join(' ')).toContain('Site hazards')
    expect(c.after.hazard).toBeLessThan(c.before.hazardSources)
  })

  test('fails on an unknown block type', () => {
    expect(convert([it('MysteryBlock', { id: 'm' })]).gate.ok).toBe(false)
  })

  test('hazard-after and ppe-after must meet their sources; every PPE item must appear', () => {
    const before = { hazardSources: 2, ppeSources: 1, ppeItems: ['Glasses', 'Gloves'], unreadable: [] } as never
    const ok = { hazard: 2, ppe: 1, step: 0, check: 0, photoRequired: 0, imagePaths: 0 }
    expect(checkGate(before, ok, [{ kind: 'ppe', text: 'Glasses\nGloves' }]).ok).toBe(true)
    expect(checkGate(before, { ...ok, hazard: 1 }, [{ kind: 'ppe', text: 'Glasses\nGloves' }]).ok).toBe(false)
    expect(checkGate(before, { ...ok, ppe: 0 }, []).ok).toBe(false)
    const missing = checkGate(before, ok, [{ kind: 'ppe', text: 'Glasses' }])
    expect(missing.ok).toBe(false)
    expect(missing.failures[0]).toContain('Gloves')
  })

  test('an empty SOP passes (nothing to lose)', () => {
    const c = convertSop({ sopId: 'x', sopImagePaths: [], sections: [section({})] })
    expect(c.source).toBe('empty')
    expect(c.gate.ok).toBe(true)
  })
})

test.describe('plan', () => {
  const d = (key: string, text: string, sortOrder = 0): FocusStepDraft => ({
    sectionId: 's', kind: 'step', text, tip: null, photoRequired: false, imagePaths: [], requiredTools: null,
    timeEstimateMinutes: null, sortOrder, sourceKey: key,
  })
  const ex = (key: string, text: string, id = `id-${key}`, sort = 0) => ({
    id, section_id: 's', source_key: key, kind: 'step', text, tip: null, photo_required: false,
    image_paths: [] as string[], required_tools: null, time_estimate_minutes: null, sort_order: sort,
  })

  test('identical desired vs existing is a no-op', () => {
    expect(planFocusStepWrites([d('a', 'x'), d('b', 'y', 1)], [ex('a', 'x'), ex('b', 'y', 'id-b', 1)])).toEqual({ upserts: [], deleteIds: [], unchanged: 2 })
  })

  test('one edit is one upsert keeping the existing id', () => {
    const p = planFocusStepWrites([d('a', 'changed')], [ex('a', 'x')])
    expect(p.upserts).toHaveLength(1)
    expect(p.upserts[0].id).toBe('id-a')
    expect(p.deleteIds).toEqual([])
  })

  test('a removed key is one delete; a new key is one upsert without an id', () => {
    const p = planFocusStepWrites([d('a', 'x'), d('new', 'n', 1)], [ex('a', 'x'), ex('gone', 'g')])
    expect(p.deleteIds).toEqual(['id-gone'])
    expect(p.upserts).toHaveLength(1)
    expect(p.upserts[0].id).toBeUndefined()
    expect(p.unchanged).toBe(1)
  })

  test('conversionHash is stable and changes when content changes', () => {
    const a = conversionHash(FIXTURE)
    expect(conversionHash(FIXTURE)).toBe(a)
    const edited = structuredClone(FIXTURE)
    ;((edited[2].layout_data as { content: Array<{ props: { text?: string } }> }).content[0].props).text = 'Isolate the press!'
    expect(conversionHash(edited)).not.toBe(a)
  })
})

test.describe('registry parity', () => {
  // 58-16: the block registry the converter used to be checked against is deleted. Stored layout_data still
  // carries these 18 types, so the converter's handled set is pinned to the literal list instead.
  test('the converter handles exactly the 18 block types stored layout_data can carry', () => {
    const stored = [
      'CalloutBlock', 'DecisionBlock', 'EscalateBlock', 'HazardCardBlock', 'HeadingBlock', 'InspectBlock',
      'MeasurementBlock', 'ModelBlock', 'PPECardBlock', 'PhotoBlock', 'PhotoGridBlock', 'SignOffBlock',
      'StepBlock', 'StepWithPhotosBlock', 'TextBlock', 'VisualBlock', 'VoiceNoteBlock', 'ZoneBlock',
    ]
    expect([...HANDLED_TYPES].sort()).toEqual([...stored].sort())
  })
})
