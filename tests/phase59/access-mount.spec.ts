/**
 * Phase 59 -- access mount. Requirement OFF-06; decision D-12.
 * Owner: 59-11. Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

// The last commit before the phase's first plan (59-01 landed on top of it).
const PHASE_BASE = '1c42270e'
const LENS = 'src/components/sop/lenses/AdminAccessLens.tsx'

test.describe('access mount', () => {
  test('AdminAccessLens.tsx is unchanged by this phase', () => {
    let diff = ''
    try {
      diff = execFileSync('git', ['diff', PHASE_BASE, '--', LENS], { cwd: ROOT, encoding: 'utf-8' })
    } catch {
      test.skip(true, 'phase base commit not present in this checkout')
    }
    expect(diff).toBe('')
    const src = read(LENS)
    expect(src).toContain('export function AdminAccessLens(')
    expect(src).toContain('pinnedSopId?: string')
    expect(src).not.toMatch(/office/i)
  })

  test('the WiringPatchBayShell import allow-list is unchanged', () => {
    const guard = read('tests/lint/no-static-admin-lens-import.spec.ts')
    expect(guard).toContain("WiringPatchBayShell: [path.join('src', 'components', 'sop', 'lenses', 'AdminAccessLens.tsx')]")
  })

  test('the pane wraps the lens in overflow-x-auto and passes the already UUID-gated initialSop', () => {
    const pane = read('src/components/office/OfficePane.tsx')
    expect(pane).toMatch(/className="overflow-x-auto px-2 pb-8">\s*<AdminAccessLens pinnedSopId=\{initialSop \?\? undefined\} \/>/)
    expect(pane).toContain("tab === 'access'")
    // The pane itself is only ever reached lazily, so the home bundle stays clear of the lens.
    expect(read('src/components/office/PeopleTab.tsx')).not.toContain('AdminAccessLens')
  })
})
