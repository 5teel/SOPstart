/**
 * Phase 35 Plan 03 Task 1 — MTX-03 filter wiring source-contract.
 * Asserts the department/worker/SOP filters actually feed the
 * getTrainingMatrix() call and that the fetch effect re-runs when any of
 * them change (wiring, not mere token presence — CLAUDE.md 2026-06-05).
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

test.describe('TrainingMatrixView — MTX-03 filter wiring', () => {
  const src = read(MATRIX_VIEW)

  test('getTrainingMatrix is called with departmentId, workerId and sopId', () => {
    expect(src).toMatch(/getTrainingMatrix\(\{\s*departmentId,\s*workerId:\s*workerId\s*\|\|\s*undefined,\s*sopId:\s*sopId\s*\|\|\s*undefined\s*\}\)/)
  })

  test('the filtered fetch effect depends on departmentId, workerId and sopId', () => {
    expect(src).toMatch(/\},\s*\[departmentId,\s*workerId,\s*sopId\]\)/)
  })

  test('worker and SOP select inputs update state that feeds the fetch', () => {
    expect(src).toMatch(/onChange=\{\(e\)\s*=>\s*setWorkerId\(e\.target\.value\)\}/)
    expect(src).toMatch(/onChange=\{\(e\)\s*=>\s*setSopId\(e\.target\.value\)\}/)
  })
})
