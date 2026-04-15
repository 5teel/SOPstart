import { test, expect } from '@playwright/test'
import { resolveRenderFamily, inferRenderFamilyFromType } from '@/lib/sections/resolveRenderFamily'
import { BlockContentSchema } from '@/lib/validators/blocks'
import type { SopSection, SectionKind } from '@/types/sop'

// Minimal shape matching what resolveRenderFamily consumes
type SectionForRender = Pick<SopSection, 'section_type' | 'section_kind'> & {
  sop_steps?: { id: string }[]
}

function mkKind(family: SectionKind['render_family'], extras: Partial<SectionKind> = {}): SectionKind {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    organisation_id: null,
    slug: family,
    display_name: family,
    render_family: family,
    icon: null,
    color_family: null,
    render_priority: 50,
    description: null,
    created_at: '2026-04-15T00:00:00Z',
    updated_at: '2026-04-15T00:00:00Z',
    ...extras,
  }
}

test.describe('resolveRenderFamily', () => {
  test('Test 1: section_kind join wins — returns signoff', () => {
    const section: SectionForRender = {
      section_type: 'anything',
      section_kind: mkKind('signoff'),
    }
    expect(resolveRenderFamily(section)).toBe('signoff')
  })

  test('Test 2: null kind + emergency_procedures → emergency', () => {
    const section: SectionForRender = {
      section_type: 'emergency_procedures',
      section_kind: null,
    }
    expect(resolveRenderFamily(section)).toBe('emergency')
  })

  test('Test 3: null kind + personal_protective_equipment → ppe', () => {
    const section: SectionForRender = {
      section_type: 'personal_protective_equipment',
      section_kind: null,
    }
    expect(resolveRenderFamily(section)).toBe('ppe')
  })

  test('Test 4: null kind + notes + steps.length>0 → steps (steps-by-shape wins)', () => {
    const section: SectionForRender = {
      section_type: 'notes',
      section_kind: null,
      sop_steps: [{ id: 'a' }],
    }
    expect(resolveRenderFamily(section)).toBe('steps')
  })

  test('Test 5: null kind + preflight_check → content (unknown falls through)', () => {
    const section: SectionForRender = {
      section_type: 'preflight_check',
      section_kind: null,
    }
    expect(resolveRenderFamily(section)).toBe('content')
  })

  test('Test 6: custom kind with display_name → custom', () => {
    const section: SectionForRender = {
      section_type: 'whatever',
      section_kind: mkKind('custom', { display_name: 'Pre-flight check' }),
    }
    expect(resolveRenderFamily(section)).toBe('custom')
  })

  test('Test 7 (CRITICAL REGRESSION): procedure + zero steps → content (no silent StepsContent regression)', () => {
    const section: SectionForRender = {
      section_type: 'procedure',
      section_kind: null,
      sop_steps: [],
    }
    expect(resolveRenderFamily(section)).toBe('content')
  })

  test('Test 8: kind.render_family=custom wins over substring fallback for custom', () => {
    const section: SectionForRender = {
      section_type: 'custom',
      section_kind: mkKind('custom'),
    }
    expect(resolveRenderFamily(section)).toBe('custom')
  })

  test('inferRenderFamilyFromType: hazard substring', () => {
    expect(inferRenderFamilyFromType('safety_hazards', 0)).toBe('hazard')
  })

  test('inferRenderFamilyFromType: sign off compound', () => {
    expect(inferRenderFamilyFromType('sign_off', 0)).toBe('signoff')
  })
})

test.describe('BlockContentSchema', () => {
  test('valid hazard content parses', () => {
    const parsed = BlockContentSchema.parse({
      kind: 'hazard',
      text: 'Hot surface',
      severity: 'critical',
    })
    expect(parsed.kind).toBe('hazard')
  })

  test('invalid hazard missing severity rejects', () => {
    const res = BlockContentSchema.safeParse({ kind: 'hazard', text: 'Hot surface' })
    expect(res.success).toBe(false)
  })

  test('valid ppe content parses', () => {
    const parsed = BlockContentSchema.parse({
      kind: 'ppe',
      items: ['gloves', 'glasses'],
    })
    expect(parsed.kind).toBe('ppe')
  })

  test('invalid custom with wrong kind rejects', () => {
    const res = BlockContentSchema.safeParse({ kind: 'not_a_kind', data: {} })
    expect(res.success).toBe(false)
  })
})
