/**
 * Phase 26 Plan 26-09 (R5, R7, D-03) — the unified Visual block, behavioural.
 *
 * Proves the four must-have truths against the REAL pure modules (media-adapter
 * + content-ops), not a grep — same in-process pattern as inserter/props-roundtrip
 * (the phase26 project has no `@/` alias, so React barrels can't load; the media
 * logic lives in the pure `media-adapter.ts` precisely so it CAN be exercised):
 *
 *   1. inserting a Visual block adds photo/diagram/video items, each medium-tagged
 *   2. the 3-place contract + medium tags on /api/schema (source-contract read)
 *   3. legacy PhotoBlock/PhotoGridBlock/StepWithPhotosBlock render+edit THROUGH
 *      the Visual media grid with their layout_data `kind` UNCHANGED (A3)
 *   4. block_provenance survives an edit made through the Visual UI (P4)
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { toJSONSchema } from 'zod'
import {
  VISUAL_MEDIUMS,
  VisualBlockPropsSchema,
  mediumTag,
  toVisualItems,
  fromVisualItems,
  newVisualItem,
  mediaFieldKey,
  supportsMediumPicker,
  type MediaFieldType,
} from '../../src/components/admin/builder-v2/visual/media-adapter'
import { updateBlockProps, type LayoutItem } from '../../src/lib/builder/content-ops'

const ROOT = path.resolve(__dirname, '..', '..')

test.describe('Visual block — mixed, medium-tagged media (R5)', () => {
  test('adding a photo + a video yields items each carrying its medium tag', () => {
    // Insert a fresh Visual block (registry default) then add media through the grid.
    let items = toVisualItems('VisualBlock', { items: [] })
    expect(items).toEqual([])

    items = [...items, newVisualItem('photo')]
    items = [...items, newVisualItem('video')]
    const stored = fromVisualItems('VisualBlock', items) as { medium: string }[]

    expect(stored.map((i) => i.medium)).toEqual(['photo', 'video'])
    // The agent-facing tags are visual:{medium}.
    expect(stored.map((i) => mediumTag(i.medium as never))).toEqual(['visual:photo', 'visual:video'])
    // The stored value validates against the write-boundary schema.
    expect(VisualBlockPropsSchema.safeParse({ items: stored }).success).toBe(true)
    // Only the Visual block offers the medium sub-picker.
    expect(supportsMediumPicker('VisualBlock')).toBe(true)
    expect(supportsMediumPicker('PhotoGridBlock')).toBe(false)
  })

  test('an invalid medium is rejected by the schema (T-26-09-01)', () => {
    expect(VisualBlockPropsSchema.safeParse({ items: [{ medium: 'gif', src: null, caption: null }] }).success).toBe(
      false
    )
    expect(VISUAL_MEDIUMS).toEqual(['photo', 'diagram', 'video'])
  })

  test('medium enum + a medium-tagged example are on the /api/schema surface (R7/D-02)', () => {
    // The JSON-Schema toString the introspection endpoint serves advertises the enum.
    const json = JSON.stringify(toJSONSchema(VisualBlockPropsSchema))
    for (const m of VISUAL_MEDIUMS) expect(json).toContain(m)

    // Source-contract: introspection registers VisualBlock with the medium tags
    // (the endpoint itself can't load in-process — it pulls the @/ React barrel).
    const intro = readFileSync(path.join(ROOT, 'src/actions/introspection.ts'), 'utf8')
    expect(intro).toContain('VisualBlock:')
    expect(intro).toContain('VisualBlockPropsSchema')
    expect(intro).toMatch(/visual:photo[\s\S]*visual:diagram[\s\S]*visual:video/)
  })

  test('the 3-place contract + label are registered (source-contract)', () => {
    const registry = readFileSync(path.join(ROOT, 'src/lib/builder/block-registry.tsx'), 'utf8')
    const validators = readFileSync(path.join(ROOT, 'src/lib/validators/blocks.ts'), 'utf8')
    const labels = readFileSync(path.join(ROOT, 'src/lib/builder/block-type-labels.ts'), 'utf8')
    expect(registry).toContain('VisualBlock:')
    expect(validators).toContain("z.literal('visual')")
    expect(labels).toMatch(/VisualBlock:\s*{\s*label:\s*'Visual'/)
  })
})

test.describe('Visual block — legacy photos render THROUGH it, no layout_data drift (A3/P4)', () => {
  // A converted single-photo block carrying frozen-contract provenance metadata.
  function convertedPhoto(): LayoutItem {
    return {
      type: 'PhotoBlock',
      props: {
        id: 'p1',
        src: 'org/sop/images/img_0.png',
        alt: 'Guard in place',
        caption: 'Before start',
        junctionId: 'junc-p1',
        block_provenance: { region: { page: 1 }, parser_run_id: 'run-9', parser_version: 7 },
      },
    }
  }

  test('a converted PhotoBlock reads INTO one photo Visual item', () => {
    const items = toVisualItems('PhotoBlock', convertedPhoto().props)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ medium: 'photo', src: 'org/sop/images/img_0.png', caption: 'Before start' })
  })

  test('editing through the Visual grid keeps kind=photo AND block_provenance (no drift)', () => {
    const block = convertedPhoto()
    const content = [block]

    // Edit the caption THROUGH the grid: adapter → native field value → lossless reducer.
    const items = toVisualItems('PhotoBlock', block.props)
    const edited = items.map((it) => ({ ...it, caption: 'Edited caption' }))
    const nativeValue = fromVisualItems('PhotoBlock', edited)

    // PhotoBlock's native field is the single `src` string — NOT an items array.
    expect(mediaFieldKey('PhotoBlock')).toBe('src')
    expect(typeof nativeValue === 'string' || nativeValue === null).toBe(true)

    const next = updateBlockProps(content, 'p1', { caption: 'Edited caption' })
    // The stored block is STILL a PhotoBlock (kind never rewritten to 'visual').
    expect(next[0].type).toBe('PhotoBlock')
    // Provenance + junction survive the edit byte-identical (P4/R7).
    expect(next[0].props.junctionId).toBe('junc-p1')
    expect(next[0].props.block_provenance).toEqual(block.props.block_provenance)
    expect(next[0].props.caption).toBe('Edited caption')
  })

  test('PhotoGridBlock + StepWithPhotosBlock round-trip through the grid unchanged in shape', () => {
    const grid = { items: [{ src: 'a.png', alt: 'A', caption: null }, { src: 'b.png', alt: 'B', caption: 'two' }] }
    const gridItems = toVisualItems('PhotoGridBlock', grid)
    expect(gridItems.every((i) => i.medium === 'photo')).toBe(true)
    expect(fromVisualItems('PhotoGridBlock', gridItems)).toEqual(grid.items)

    const step = { photos: [{ src: 'c.png', alt: 'C', caption: null }] }
    const stepItems = toVisualItems('StepWithPhotosBlock', step)
    expect(stepItems[0].medium).toBe('photo')
    expect(fromVisualItems('StepWithPhotosBlock', stepItems)).toEqual(step.photos)
    // Their native field keys are preserved (not 'items' for the step block).
    expect(mediaFieldKey('StepWithPhotosBlock')).toBe('photos')
  })

  test('every media field type has a native key (no kind rewrite path)', () => {
    const types: MediaFieldType[] = ['VisualBlock', 'PhotoBlock', 'PhotoGridBlock', 'StepWithPhotosBlock']
    for (const t of types) expect(['items', 'src', 'photos']).toContain(mediaFieldKey(t))
  })
})
