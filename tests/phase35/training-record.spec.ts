/**
 * Phase 35 Plan 03 Task 2 — TrainingRecordSection + PersonPanel growth-point
 * source-contract (TRN-01, D-09/D-11/D-12/D-13).
 *
 * Extended in Task 4 with D-16 per-worker Export CSV wiring assertions.
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TRAINING_RECORD = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'TrainingRecordSection.tsx')
const PERSON_PANEL = path.join(ROOT, 'src', 'components', 'admin', 'org-model', 'PersonPanel.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('TrainingRecordSection — imports + structure', () => {
  const src = read(TRAINING_RECORD)

  test('imports getTrainingRecordForPerson and StatePill', () => {
    expect(src).toMatch(/import\s*\{\s*getTrainingRecordForPerson,\s*type TrainingRecord\s*\}\s*from\s*'@\/actions\/competency'/)
    expect(src).toMatch(/import\s*\{\s*StatePill\s*\}\s*from\s*['"]\.\/StatePill['"]/)
  })

  test('groups evidence by SOP (one block per required SOP)', () => {
    expect(src).toMatch(/record\.requiredSops\.map/)
  })

  test('renders a distinct "Other completed" section (D-13)', () => {
    expect(src).toContain('Other completed SOPs')
    expect(src).toMatch(/record\.otherCompletedSops\.map/)
  })

  test('scrolls the focused SOP block into view (D-09)', () => {
    expect(src).toMatch(/scrollIntoView/)
    expect(src).toMatch(/focusSopId/)
  })

  test('is informational-only — no edit/gate control keyed on competency state (CMP-04)', () => {
    expect(src).not.toMatch(/disabled=/)
  })

  test('resets on person change via the render-time idiom, not setState-in-effect', () => {
    expect(src).toMatch(/prevPersonId\s*!==\s*personId/)
  })
})

test.describe('PersonPanel — renders TrainingRecordSection with focusSopId', () => {
  const src = read(PERSON_PANEL)

  test('imports TrainingRecordSection', () => {
    expect(src).toMatch(/import\s*\{\s*TrainingRecordSection\s*\}\s*from\s*'@\/components\/admin\/competency\/TrainingRecordSection'/)
  })

  test('props include focusSopId and it is passed through', () => {
    expect(src).toMatch(/focusSopId\?:\s*string\s*\|\s*null/)
    expect(src).toMatch(/<TrainingRecordSection\s+personId=\{person\.id\}\s+focusSopId=\{focusSopId\}\s*\/>/)
  })
})
