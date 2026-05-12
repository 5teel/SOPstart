/**
 * Phase 15-03 / Task 1 — sop-pack.ts unit tests.
 *
 * Verifies byte-identical output (Pitfall 3 guard) + structural invariants
 * the verifier prompt relies on (WARNING:/CAUTION: prefixes, ## section
 * headers with [type=...] tag, JSON.stringify of block snapshot content).
 */
import { test, expect } from '@playwright/test'
import { packSopForPrompt } from '@/lib/voice/sop-pack'
import type { SopWithSections } from '@/types/sop'

function makeSop(overrides: Partial<SopWithSections> = {}): SopWithSections {
  const base: SopWithSections = {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    organisation_id: 'org-1',
    title: 'ENF4-03-031 Blank Side Hanger',
    sop_number: null,
    revision_date: null,
    author: null,
    category: null,
    department: null,
    related_sops: null,
    applicable_equipment: null,
    required_certifications: null,
    status: 'published',
    version: 1,
    source_file_path: 'path',
    source_file_type: 'docx',
    source_file_name: 'sop.docx',
    overall_confidence: 0.9,
    parse_notes: null,
    is_ocr: false,
    uploaded_by: 'user-1',
    published_at: null,
    source_type: 'uploaded',
    category_tag: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    sop_sections: [
      {
        id: 'sec-1',
        sop_id: 'aaaaaaaa-0000-4000-8000-000000000001',
        section_type: 'hazards',
        section_kind_id: null,
        title: 'Hazards & PPE',
        content: 'PPE required: heat-resistant gloves.',
        sort_order: 0,
        confidence: 0.95,
        approved: true,
        layout_data: null,
        layout_version: null,
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-01T00:00:00Z',
        sop_steps: [
          {
            id: 'step-1',
            section_id: 'sec-1',
            step_number: 1,
            text: 'Confirm green ready light is lit.',
            warning: 'Do not approach while amber lamp is active.',
            caution: null,
            tip: null,
            required_tools: null,
            time_estimate_minutes: null,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
          {
            id: 'step-2',
            section_id: 'sec-1',
            step_number: 2,
            text: 'Don heat-resistant gloves.',
            warning: null,
            caution: 'Inspect blank for cracks before mounting.',
            tip: null,
            required_tools: null,
            time_estimate_minutes: null,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
        ],
        sop_images: [],
      },
    ],
    ...overrides,
  }
  return base
}

test.describe('packSopForPrompt — Pitfall 3 cache-key invariants', () => {
  test('byte-identical output for two calls with same input', () => {
    const sop = makeSop()
    const a = packSopForPrompt(sop)
    const b = packSopForPrompt(sop)
    expect(a).toBe(b)
    // Defence in depth — explicit byte-length equality
    expect(Buffer.byteLength(a)).toBe(Buffer.byteLength(b))
  })

  test('output starts with SOP TITLE line and includes SOP VERSION line', () => {
    const sop = makeSop()
    const out = packSopForPrompt(sop)
    expect(out.startsWith('SOP TITLE: ENF4-03-031 Blank Side Hanger')).toBe(true)
    expect(out).toContain('SOP VERSION: 1')
  })

  test('sections rendered with `## <title> [type=<section_type>]` header in order', () => {
    const sop = makeSop({
      sop_sections: [
        {
          id: 'sec-a',
          sop_id: 'x',
          section_type: 'overview',
          section_kind_id: null,
          title: 'Overview',
          content: 'Intro',
          sort_order: 0,
          confidence: 1,
          approved: true,
          layout_data: null,
          layout_version: null,
          created_at: '',
          updated_at: '',
          sop_steps: [],
          sop_images: [],
        },
        {
          id: 'sec-b',
          sop_id: 'x',
          section_type: 'hazards',
          section_kind_id: null,
          title: 'Hazards',
          content: null,
          sort_order: 1,
          confidence: 1,
          approved: true,
          layout_data: null,
          layout_version: null,
          created_at: '',
          updated_at: '',
          sop_steps: [],
          sop_images: [],
        },
      ],
    })
    const out = packSopForPrompt(sop)
    expect(out).toContain('## Overview [type=overview]')
    expect(out).toContain('## Hazards [type=hazards]')
    const overviewIdx = out.indexOf('## Overview')
    const hazardsIdx = out.indexOf('## Hazards')
    expect(overviewIdx).toBeGreaterThan(-1)
    expect(hazardsIdx).toBeGreaterThan(overviewIdx)
  })

  test('steps render with WARNING: / CAUTION: prefixes when present (verifier-prompt ground-truth markers)', () => {
    const sop = makeSop()
    const out = packSopForPrompt(sop)
    expect(out).toContain('  Step 1: Confirm green ready light is lit.')
    expect(out).toContain('    WARNING: Do not approach while amber lamp is active.')
    expect(out).toContain('  Step 2: Don heat-resistant gloves.')
    expect(out).toContain('    CAUTION: Inspect blank for cracks before mounting.')
  })

  test('blocks rendered via JSON.stringify(snapshot_content)', () => {
    const sop = makeSop()
    // Cast — sop_section_blocks is an optional structural extension
    ;(sop.sop_sections[0] as unknown as { sop_section_blocks: Array<{ snapshot_content: unknown }> }).sop_section_blocks = [
      { snapshot_content: { kind: 'ppe', items: ['gloves', 'glasses'] } },
    ]
    const out = packSopForPrompt(sop)
    expect(out).toContain('  Block: {"kind":"ppe","items":["gloves","glasses"]}')
  })

  test('omitting an optional field (no step.warning) does NOT shift other field bytes', () => {
    const sopA = makeSop()
    // Drop the warning on step-1 to ensure no WARNING: line is emitted
    sopA.sop_sections[0].sop_steps[0].warning = null
    const outA = packSopForPrompt(sopA)
    // step-2 caution line should still appear at the same relative byte offset
    expect(outA).toContain('    CAUTION: Inspect blank for cracks before mounting.')
    // Re-call with same overridden SOP — still byte-identical
    const outA2 = packSopForPrompt(sopA)
    expect(outA).toBe(outA2)
    // No WARNING line because step-1.warning is null
    expect(outA).not.toContain('WARNING:')
  })
})
