/**
 * Phase 63 -- the Read view of the home's reader pane. Requirement HOME-03;
 * threats T-63-16..19. Owner: 63-06. Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { assembleFocus } from '../../src/lib/sop/focus-assemble'

const src = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
/** Comments stripped, so a comment describing a banned pattern cannot trip a guard (CLAUDE.md 2026-09-28). */
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test.describe('read view', () => {
  test('assembleFocus orders steps by section then step, groups standards, sums minutes', () => {
    const sections = [
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: 2 },
    ]
    const step = (id: string, section_id: string, sort_order: number, m: number | null) => ({ id, section_id, sort_order, time_estimate_minutes: m })
    const out = assembleFocus({
      sopId: 'sop',
      sections,
      steps: [step('b2', 'b', 2, 4), step('a2', 'a', 2, 3), step('b1', 'b', 1, null), step('a1', 'a', 1, 2)],
      standards: [
        { id: 's1', name: 'LOTO' },
        { id: 's2', name: 'ISO 45001' },
      ],
      attachments: [
        { standard_id: 's1', sop_id: 'sop', section_id: null, focus_step_id: null },
        { standard_id: 's2', sop_id: null, section_id: 'b', focus_step_id: null },
        { standard_id: 's1', sop_id: null, section_id: null, focus_step_id: 'a2' },
        { standard_id: 's1', sop_id: 'other', section_id: null, focus_step_id: null },
        { standard_id: 'gone', sop_id: 'sop', section_id: null, focus_step_id: null },
      ],
    })
    expect(out.steps.map((s) => s.id)).toEqual(['a1', 'a2', 'b1', 'b2'])
    expect(out.standards.sop.map((s) => s.name)).toEqual(['LOTO'])
    expect(out.standards.sections.b.map((s) => s.name)).toEqual(['ISO 45001'])
    expect(out.standards.steps.a2.map((s) => s.name)).toEqual(['LOTO'])
    expect(out.totalMinutes).toBe(9)
  })

  test('loadFocusSop calls assembleFocus; the module is plain and server-free', () => {
    expect(code('src/lib/sop/focus-read.ts').match(/assembleFocus\(/g)).toHaveLength(1)
    const s = code('src/lib/sop/focus-assemble.ts')
    expect(s).not.toMatch(/@\/lib\/supabase|server-only|@\/lib\/members|use server|use client/)
  })

  test('useReadSop reads through the browser client and imports no server action', () => {
    const s = code('src/hooks/useReadSop.ts')
    expect(s).not.toContain('@/actions/')
    expect(s).toContain("@/lib/supabase/client")
    expect(s).toContain('assembleFocus(')
    expect(s).toContain("['read-sop', sopId]")
  })

  test('getSopOwner checks the role before any read, scopes to the session org, exports only async functions', () => {
    const s = code('src/actions/sop-owner.ts')
    expect(s.indexOf('OWNER_ROLES.has(role)')).toBeGreaterThan(-1)
    expect(s.indexOf('OWNER_ROLES.has(role)')).toBeLessThan(s.indexOf(".from('sops')"))
    expect(s).toContain(".eq('organisation_id', organisationId)")
    expect(s).toContain('supervisor')
    expect(s).not.toContain('createAdminClient')
    const exports = s.match(/^export .*/gm) ?? []
    expect(exports.length).toBeGreaterThan(0)
    for (const e of exports) expect(e).toMatch(/^export async function /)
  })

  test('the capability matrix names the owner row with the workers cell empty', () => {
    const m = src('.planning/codebase/CAPABILITY-MATRIX.md')
    const row = m.split('\n').find((l) => l.startsWith('| SOP owner name on Read (home) |')) ?? ''
    expect(row.split('|').map((c) => c.trim()).slice(2, 6)).toEqual(['—', '✅', '✅', '✅'])
  })
})
