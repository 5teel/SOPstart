/**
 * Phase 35 Plan 02 -- StatePill sketch-05 pill vocabulary + Zod filter
 * validators source-contract + parse tests.
 *
 * Verifies:
 *   - StatePill.tsx renders all five sketch-05 pill labels and references
 *     only DECLARED blueprint-theme.css tokens (CLAUDE.md 2026-07-14
 *     undefined-token learning) -- never a bare undefined var.
 *   - StatePill is purely informational -- no disabled/lock affordance on a
 *     state condition (CMP-04: competency state never gates worker access).
 *   - MatrixFiltersSchema / CsvExportFiltersSchema shape + real parse
 *     behaviour (MTX-03, D-16).
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { MatrixFiltersSchema, CsvExportFiltersSchema } from '@/lib/validators/competency'

const ROOT = process.cwd()
const STATE_PILL = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'StatePill.tsx')
const THEME_CSS = path.join(ROOT, 'src', 'styles', 'blueprint-theme.css')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('StatePill -- sketch-05 pill vocabulary', () => {
  const src = read(STATE_PILL)

  test('contains all five sketch-05 pill labels', () => {
    expect(src).toContain('Signed off')
    expect(src).toContain('Observed')
    expect(src).toContain('Awaiting sign-off')
    expect(src).toContain('Read only')
    expect(src).toContain('Not started')
  })

  test('references the declared semantic accent tokens, not a bare undefined var', () => {
    expect(src).toContain('--accent-signoff')
    expect(src).toContain('--accent-step')
    expect(src).toContain('--accent-decision')
  })

  test('every --token referenced by StatePill is declared in blueprint-theme.css', () => {
    const theme = read(THEME_CSS)
    const refs = Array.from(src.matchAll(/'--([a-z0-9-]+)'/g)).map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const token of refs) {
      expect(theme).toContain(`--${token}:`)
    }
  })

  test('is informational only -- no disabled/lock affordance or click handler (CMP-04)', () => {
    expect(src).not.toMatch(/disabled=/)
    expect(src).not.toMatch(/onClick=/)
  })
})

test.describe('MatrixFiltersSchema / CsvExportFiltersSchema', () => {
  test('MatrixFiltersSchema requires departmentId and accepts optional workerId/sopId', () => {
    expect(MatrixFiltersSchema.safeParse({}).success).toBe(false)
    const ok = MatrixFiltersSchema.safeParse({ departmentId: '00000000-0000-4000-8000-000000000001' })
    expect(ok.success).toBe(true)
    const withOptional = MatrixFiltersSchema.safeParse({
      departmentId: '00000000-0000-4000-8000-000000000001',
      workerId: '00000000-0000-4000-8000-000000000002',
      sopId: '00000000-0000-4000-8000-000000000003',
    })
    expect(withOptional.success).toBe(true)
  })

  test('CsvExportFiltersSchema accepts optional dateFrom/dateTo and all-optional filters', () => {
    expect(CsvExportFiltersSchema.safeParse({}).success).toBe(true)
    const withDates = CsvExportFiltersSchema.safeParse({
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
    })
    expect(withDates.success).toBe(true)
  })
})
