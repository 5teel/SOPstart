/**
 * Phase 35 Plan 01 -- MTX-02 no-double-derivation source-contract.
 *
 * Verifies matrix.ts reads the already-materialized sop_departments/
 * sop_access_people output only, and never re-derives the access_grants
 * inheritance chain a second time (that would be a second derivation layer,
 * which MTX-02 explicitly forbids -- "zero double-entry, no third
 * derivation layer").
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MATRIX = path.join(ROOT, 'src', 'lib', 'competency', 'matrix.ts')
const CLASSIFY = path.join(ROOT, 'src', 'lib', 'competency', 'classify.ts')
const CSV = path.join(ROOT, 'src', 'lib', 'competency', 'csv.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('MTX-02 -- matrix.ts never re-derives access_grants', () => {
  const src = read(MATRIX)

  test('does not reference access_grants', () => {
    expect(src).not.toContain('access_grants')
  })

  test('does not import from @/actions/grants', () => {
    expect(src).not.toContain("from '@/actions/grants'")
  })

  test('imports classifyCompetency from @/lib/competency/classify (or relative ./classify)', () => {
    expect(src).toMatch(/from ['"](\.\/classify|@\/lib\/competency\/classify)['"]/)
    expect(src).toContain('classifyCompetency')
  })
})

test.describe('src/lib/competency modules stay pure (no server directive, no supabase import)', () => {
  for (const [name, file] of [
    ['classify.ts', CLASSIFY],
    ['matrix.ts', MATRIX],
    ['csv.ts', CSV],
  ] as const) {
    test(`${name} has no 'use server' directive`, () => {
      expect(read(file)).not.toContain("'use server'")
    })

    test(`${name} has no @/lib/supabase import`, () => {
      expect(read(file)).not.toContain('@/lib/supabase')
    })
  }
})
