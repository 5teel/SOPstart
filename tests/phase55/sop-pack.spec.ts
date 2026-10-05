/**
 * Phase 15-03 / Task 1 — sop-pack.ts unit tests (repointed to focus steps in 58-08).
 *
 * Verifies byte-identical output (Pitfall 3 guard) + structural invariants
 * the synthesis prompt relies on (`## <title> [type=...]` section headers,
 * one labelled line per focus step, TIP lines).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { packSopForPrompt, type PackableSop } from '@/lib/agent-layer/sop-pack'

function makeSop(): PackableSop {
  return {
    title: 'ENF4-03-031 Blank Side Hanger',
    version: 1,
    sop_sections: [
      {
        title: 'Hazards & PPE',
        section_type: 'hazards',
        content: 'PPE required: heat-resistant gloves.',
        focus_steps: [
          { kind: 'hazard', text: 'Do not approach while amber lamp is active.', tip: null },
          { kind: 'ppe', text: 'Heat-resistant gloves', tip: null },
          { kind: 'step', text: 'Confirm green ready light is lit.', tip: null },
          { kind: 'step', text: 'Don heat-resistant gloves.', tip: 'Check for cracks first.' },
          { kind: 'check', text: 'Blank is seated.', tip: null },
        ],
      },
    ],
  }
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
    const out = packSopForPrompt(makeSop())
    expect(out.startsWith('SOP TITLE: ENF4-03-031 Blank Side Hanger')).toBe(true)
    expect(out).toContain('SOP VERSION: 1')
  })

  test('sections rendered with `## <title> [type=<section_type>]` header in order', () => {
    const sop = makeSop()
    sop.sop_sections = [
      { title: 'Overview', section_type: 'overview', content: 'Intro', focus_steps: [] },
      { title: 'Hazards', section_type: 'hazards', content: null, focus_steps: [] },
    ]
    const out = packSopForPrompt(sop)
    expect(out).toContain('## Overview [type=overview]')
    expect(out).toContain('## Hazards [type=hazards]')
    expect(out.indexOf('## Hazards')).toBeGreaterThan(out.indexOf('## Overview'))
  })

  test('each focus step kind renders its own labelled line; only steps are numbered', () => {
    const out = packSopForPrompt(makeSop())
    expect(out).toContain('  HAZARD: Do not approach while amber lamp is active.')
    expect(out).toContain('  PPE: Heat-resistant gloves')
    expect(out).toContain('  Step 1: Confirm green ready light is lit.')
    expect(out).toContain('  Step 2: Don heat-resistant gloves.')
    expect(out).toContain('    TIP: Check for cracks first.')
    expect(out).toContain('  CHECK: Blank is seated.')
  })

  test('step numbers restart in each section', () => {
    const sop = makeSop()
    sop.sop_sections.push({
      title: 'Second job',
      section_type: 'procedure',
      content: null,
      focus_steps: [{ kind: 'step', text: 'Start again.', tip: null }],
    })
    expect(packSopForPrompt(sop)).toContain('  Step 1: Start again.')
  })

  test('omitting an optional field (no tip) does NOT shift other field bytes', () => {
    const sopA = makeSop()
    sopA.sop_sections[0].focus_steps[3].tip = null
    const outA = packSopForPrompt(sopA)
    expect(outA).not.toContain('TIP:')
    expect(outA).toContain('  CHECK: Blank is seated.')
    expect(packSopForPrompt(sopA)).toBe(outA)
  })

  test('the packer reads focus steps, never the old step or block tables', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/agent-layer/sop-pack.ts'), 'utf8')
    expect(src).not.toMatch(/sop_steps|sop_section_blocks|snapshot_content/)
  })
})
