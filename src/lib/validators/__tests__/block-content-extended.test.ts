/**
 * Phase 21 Plan 21-05 — BlockContentSchema extended-kinds unit tests.
 *
 * Asserts that BlockContentSchema.options has 20 entries (12 pre-21-05 + 7
 * from 21-05 + 1 from Plan 26-13's VisualBlockContentSchema, the annotated-
 * diagram block) and that each of the 7 Plan 21-05 schemas parses a
 * representative payload that matches the corresponding Puck Props shape
 * from src/components/sop/blocks/.
 *
 * Runs under the `phase21-stubs` Playwright project (no browser needed —
 * pure Zod work).
 */
import { test, expect } from '@playwright/test'
import {
  BlockContentSchema,
  TextBlockContentSchema,
  HeadingBlockContentSchema,
  PhotoBlockContentSchema,
  CalloutBlockContentSchema,
  ModelBlockContentSchema,
  StepWithPhotosBlockContentSchema,
  PhotoGridBlockContentSchema,
} from '@/lib/validators/blocks'

test.describe('BlockContentSchema — Plan 21-05 extended kinds', () => {
  test('discriminated union has 20 members (12 existing + 7 from 21-05 + 1 from 26-13 visual)', () => {
    expect(BlockContentSchema.options.length).toBe(20)
  })

  test('text — parses representative TextBlock content', () => {
    const ok = TextBlockContentSchema.safeParse({
      kind: 'text',
      content: 'Free-form narrative paragraph from a parsed SOP section.',
    })
    expect(ok.success).toBe(true)
    // BlockContentSchema can also resolve via discriminator.
    expect(BlockContentSchema.parse(ok.success ? ok.data : null).kind).toBe('text')
  })

  test('heading — parses h2/h3 with default level', () => {
    const explicit = HeadingBlockContentSchema.safeParse({
      kind: 'heading',
      text: 'Unanchored figures (review)',
      level: 'h3',
    })
    expect(explicit.success).toBe(true)
    const defaulted = HeadingBlockContentSchema.safeParse({
      kind: 'heading',
      text: 'Default to h2',
    })
    expect(defaulted.success).toBe(true)
    if (defaulted.success) expect(defaulted.data.level).toBe('h2')
  })

  test('photo — accepts nullable src + caption', () => {
    const withSrc = PhotoBlockContentSchema.safeParse({
      kind: 'photo',
      src: 'sops/abc/photo-1.jpg',
      alt: 'Pump assembly',
      caption: 'Figure 3.1 — assembled view',
    })
    expect(withSrc.success).toBe(true)
    const nullSrc = PhotoBlockContentSchema.safeParse({
      kind: 'photo',
      src: null,
      alt: '',
      caption: null,
    })
    expect(nullSrc.success).toBe(true)
  })

  test('callout — title defaults to "Note"', () => {
    const ok = CalloutBlockContentSchema.safeParse({
      kind: 'callout',
      body: 'Watch for sharp edges around the guard rail.',
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.title).toBe('Note')
  })

  test('model — requires URL', () => {
    const ok = ModelBlockContentSchema.safeParse({
      kind: 'model',
      assetUrl: 'https://storage.example.com/models/pump.glb',
    })
    expect(ok.success).toBe(true)

    const bad = ModelBlockContentSchema.safeParse({
      kind: 'model',
      assetUrl: 'not-a-url',
    })
    expect(bad.success).toBe(false)
  })

  test('step_with_photos — requires at least one photo, layout defaults to "right"', () => {
    const ok = StepWithPhotosBlockContentSchema.safeParse({
      kind: 'step_with_photos',
      number: 4,
      text: 'Insert the bolt and torque to 18Nm.',
      photos: [{ src: 'p1.jpg', alt: 'bolt', caption: null }],
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.layout).toBe('right')

    const empty = StepWithPhotosBlockContentSchema.safeParse({
      kind: 'step_with_photos',
      text: 'no photos',
      photos: [],
    })
    expect(empty.success).toBe(false)
  })

  test('photo_grid — items + columns enum', () => {
    const ok = PhotoGridBlockContentSchema.safeParse({
      kind: 'photo_grid',
      items: [
        { src: 'a.jpg', alt: '', caption: null },
        { src: 'b.jpg', alt: '', caption: null },
      ],
      columns: '2',
    })
    expect(ok.success).toBe(true)

    const badCols = PhotoGridBlockContentSchema.safeParse({
      kind: 'photo_grid',
      items: [],
      columns: '5',
    })
    expect(badCols.success).toBe(false)
  })

  test('discriminated union dispatches to the correct schema for each new kind', () => {
    const kinds = [
      { kind: 'text', content: 'x' },
      { kind: 'heading', text: 'x' },
      { kind: 'photo', src: null, alt: '', caption: null },
      { kind: 'callout', body: 'x' },
      { kind: 'model', assetUrl: 'https://x.example/y.glb' },
      {
        kind: 'step_with_photos',
        text: 'x',
        photos: [{ src: 'p.jpg', alt: '', caption: null }],
      },
      { kind: 'photo_grid', items: [] },
    ] as const
    for (const k of kinds) {
      const result = BlockContentSchema.safeParse(k)
      expect(result.success, `failed parsing kind=${k.kind}`).toBe(true)
      if (result.success) expect(result.data.kind).toBe(k.kind)
    }
  })
})
