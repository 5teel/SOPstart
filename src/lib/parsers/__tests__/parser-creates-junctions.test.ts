/**
 * Phase 21 Plan 21-05 — parser junction-creation contract tests.
 *
 * Source-contract tests (Rule-3 downgrade — same rationale as
 * scp-verify-checklist.test.ts): we don't spin up Supabase in CI, so these
 * assert that the materialization code path EXISTS and exhibits the right
 * shape. The live end-to-end behaviour is exercised by the UAT smoke test
 * documented in 21-05-SUMMARY.md.
 *
 * Also exercises `puckPropsToBlockContent` (the strict adapter) directly —
 * that's pure code with no DB dependency.
 *
 * Lives under `phase21-unit` Playwright project (registered in playwright.config.ts).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  puckPropsToBlockContent,
} from '@/lib/parsers/parsed-sop-to-layout-data'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..')
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

test.describe('Plan 21-05 — parser materializes junctions', () => {
  test('source-contract: materializeJunctionsForLayout exists + is wired into parse route', () => {
    const conv = read('src/lib/parsers/parsed-sop-to-layout-data.ts')
    expect(conv).toContain('export async function materializeJunctionsForLayout')
    expect(conv).toContain("category: 'parsed_inline'")
    expect(conv).toContain("scope: 'org'")
    expect(conv).toContain("serviceRole:")
    // Each item's junctionId stamped on the Puck props in place.
    expect(conv).toContain('item.props.junctionId = addRes.junction.id')
    // Throws on partial failure (T-21-05-02).
    expect(conv).toMatch(/throw new Error\(\s*`\[materializeJunctionsForLayout\] createBlock failed/)
    expect(conv).toMatch(/throw new Error\(\s*`\[materializeJunctionsForLayout\] addBlockToSection failed/)

    const route = read('src/app/api/sops/parse/route.ts')
    expect(route).toContain('materializeJunctionsForLayout')
    // Section inserted FIRST without layout_data, then materialize, then UPDATE.
    expect(route).toContain('// Step 1: insert section WITHOUT layout_data first')
    expect(route).toMatch(/await materializeJunctionsForLayout\(\{/)
  })

  test('puckPropsToBlockContent: hazard — strips presentation, keeps content', () => {
    const content = puckPropsToBlockContent('HazardCardBlock', {
      id: 'hz-1',
      title: 'Hazard',
      body: 'Watch for moving parts.',
      severity: 'critical',
      block_provenance: { region: 'fake' }, // presentation/wrapper — must be stripped
    })
    expect(content.kind).toBe('hazard')
    expect((content as { text: string }).text).toBe('Watch for moving parts.')
    expect((content as { severity: string }).severity).toBe('critical')
    // No leaked presentation fields
    expect(content).not.toHaveProperty('id')
    expect(content).not.toHaveProperty('block_provenance')
  })

  test('puckPropsToBlockContent: text / heading / callout', () => {
    const t = puckPropsToBlockContent('TextBlock', { id: 't', content: 'hello world' })
    expect(t.kind).toBe('text')

    const h = puckPropsToBlockContent('HeadingBlock', { id: 'h', text: 'Sec 1', level: 'h3' })
    expect(h.kind).toBe('heading')
    expect((h as { level: string }).level).toBe('h3')

    const c = puckPropsToBlockContent('CalloutBlock', { id: 'c', title: 'Warning', body: 'Hot' })
    expect(c.kind).toBe('callout')
  })

  test('puckPropsToBlockContent: step_with_photos coerces photos array', () => {
    const sp = puckPropsToBlockContent('StepWithPhotosBlock', {
      id: 'sp',
      number: 3,
      text: 'Insert the bolt',
      photos: [
        { src: 'a.jpg', alt: '', caption: null },
        { src: 'b.jpg', alt: 'bolt seated', caption: 'Final position' },
      ],
      layout: 'grid-2',
    })
    expect(sp.kind).toBe('step_with_photos')
    expect((sp as { layout: string }).layout).toBe('grid-2')
    expect((sp as { photos: unknown[] }).photos.length).toBe(2)
  })

  test('puckPropsToBlockContent: photo_grid', () => {
    const pg = puckPropsToBlockContent('PhotoGridBlock', {
      id: 'pg',
      items: [
        { src: '1.jpg', alt: 'x', caption: null },
      ],
      columns: '3',
    })
    expect(pg.kind).toBe('photo_grid')
    expect((pg as { columns: string }).columns).toBe('3')
  })

  test('puckPropsToBlockContent: throws on unknown Puck type', () => {
    expect(() => puckPropsToBlockContent('UnknownBlock', {})).toThrow(/unsupported Puck type/)
  })

  test('puckPropsToBlockContent: throws on shape mismatch (T-21-05-03)', () => {
    // HeadingBlock requires non-empty text; an empty string violates min(1).
    expect(() =>
      puckPropsToBlockContent('HeadingBlock', { id: 'h', text: '', level: 'h2' }),
    ).toThrow(/invalid content/)
  })

  test('addBlockToSection signature accepts blockProvenance + serviceRole', () => {
    const src = read('src/actions/sop-section-blocks.ts')
    expect(src).toContain('blockProvenance: BlockProvenanceSchema.optional()')
    expect(src).toContain('serviceRole: z.boolean().optional()')
    expect(src).toContain('block_provenance: data.blockProvenance ?? null')
  })

  test('createBlock signature accepts serviceRole({organisationId, createdByUserId}) + category', () => {
    const src = read('src/actions/blocks.ts')
    expect(src).toContain('category: z.string().max(60).nullable().optional()')
    expect(src).toContain('serviceRole: z')
    expect(src).toContain('organisationId: z.string().uuid()')
    expect(src).toContain("serviceRole cannot be combined with scope=global")
  })

  test('migration 00033 seeds 7 new section_kinds', () => {
    const sql = read('supabase/migrations/00033_phase21_extend_block_kinds_for_parser.sql')
    for (const slug of [
      'text', 'heading', 'photo', 'callout', 'model', 'step_with_photos', 'photo_grid',
    ]) {
      expect(sql).toContain(`'${slug}'`)
    }
    expect(sql).toContain('on conflict do nothing')
  })

  test('BlockContentSchema union has 19 members', () => {
    const src = read('src/lib/validators/blocks.ts')
    // 12 pre-21-05 + 7 new
    expect(src).toContain('TextBlockContentSchema')
    expect(src).toContain('HeadingBlockContentSchema')
    expect(src).toContain('PhotoBlockContentSchema')
    expect(src).toContain('CalloutBlockContentSchema')
    expect(src).toContain('ModelBlockContentSchema')
    expect(src).toContain('StepWithPhotosBlockContentSchema')
    expect(src).toContain('PhotoGridBlockContentSchema')
  })
})
