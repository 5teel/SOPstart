/**
 * Phase 35 Plan 03 Task 1 — TrainingMatrixView source-contract
 * (MTX-01, D-06/D-07/D-08/D-09).
 *
 * Extended in Task 4 with D-16 Export CSV wiring assertions.
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MATRIX_VIEW = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'TrainingMatrixView.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('TrainingMatrixView — imports + wiring', () => {
  const src = read(MATRIX_VIEW)

  test('imports getTrainingMatrix and StatePill', () => {
    expect(src).toMatch(/import\s*\{\s*getTrainingMatrix,\s*exportTrainingCsv\s*\}\s*from\s*'@\/actions\/competency'/)
    expect(src).toMatch(/import\s*\{\s*StatePill\s*\}\s*from\s*['"]\.\/StatePill['"]/)
  })

  test('renders a department switcher', () => {
    expect(src).toContain('Department')
    expect(src).toMatch(/departments\.map/)
  })

  test('renders per-person and per-SOP rollups', () => {
    expect(src).toMatch(/rowRollupFor/)
    expect(src).toMatch(/colRollupFor/)
    expect(src).toContain('competent')
    expect(src).toContain('signed off')
  })

  test('cell click INVOKES onSelectCell with the real person/sop ids (not just mentioned)', () => {
    // Variable names became personId/forSopId under Phase 36-07's axis-swap
    // presentation remap (rowItems/colItems can be either person- or
    // sop-headed) -- the ids passed to onSelectCell are still the real
    // resolved person/sop ids, not the display-orientation-dependent labels.
    expect(src).toMatch(/onClick=\{?\(\)\s*=>\s*onSelectCell\(personId,\s*forSopId\)\}?/)
  })

  test('compaction is fit-driven — measures container width, not a hardcoded column-count threshold', () => {
    expect(src).toMatch(/ResizeObserver/)
    expect(src).not.toMatch(/>\s*8\b/)
    expect(src).not.toMatch(/sops\.length\s*>\s*\d+/)
  })

  test('no disabled/lock affordance keyed on competency state anywhere in the view (CMP-04)', () => {
    expect(src).not.toMatch(/disabled=/)
  })
})

test.describe('TrainingMatrixView — D-16 Export CSV (filtered cut)', () => {
  const src = read(MATRIX_VIEW)

  test('imports exportTrainingCsv and downloadCsv', () => {
    expect(src).toMatch(/import\s*\{\s*getTrainingMatrix,\s*exportTrainingCsv\s*\}\s*from\s*'@\/actions\/competency'/)
    expect(src).toMatch(/import\s*\{\s*downloadCsv\s*\}\s*from\s*'@\/lib\/competency\/download-csv'/)
  })

  test('the Export CSV button handler INVOKES exportTrainingCsv with the current filters, then downloadCsv (wiring, not a bare mention)', () => {
    const handlerMatch = src.match(/async function handleExport\(\)\s*\{[\s\S]*?\n  \}/)
    expect(handlerMatch).not.toBeNull()
    const handlerBody = handlerMatch![0]
    expect(handlerBody).toMatch(/exportTrainingCsv\(\{\s*\n?\s*departmentId,/)
    expect(handlerBody).toMatch(/downloadCsv\(result\.csv,\s*result\.filename\)/)
  })

  test('the Export CSV button is wired to the handler and carries no disabled= (CMP-04)', () => {
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*void handleExport\(\)\}/)
  })
})
