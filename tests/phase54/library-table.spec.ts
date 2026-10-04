/**
 * Phase 54 / Plan 54-04 -- what survived the admin library table.
 * 57-09 deleted the table (D-13), its deep-link resolver and its check helpers
 * with their guards; the three affordances that live elsewhere stay pinned here.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WORKER_SIGNAL_PATH = path.join(ROOT, 'src', 'lib', 'sop', 'worker-signal.ts')
const CATEGORY_BUTTON_PATH = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderCategoryButton.tsx'
)
const STAGE_SHELL_PATH = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageShell.tsx'
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('surviving affordances', () => {
  test('worker-signal.ts exports WorkerScope', () => {
    expect(read(WORKER_SIGNAL_PATH)).toContain('export type WorkerScope')
  })

  test('BuilderCategoryButton calls setSopCategory(sopId, next) and imports SOP_CATEGORIES', () => {
    const code = read(CATEGORY_BUTTON_PATH)
    expect(code).toContain('setSopCategory(sopId, next)')
    expect(code).toContain('SOP_CATEGORIES')
  })

  test('BuilderStageShell renders <BuilderCategoryButton sopId={sopId}', () => {
    expect(read(STAGE_SHELL_PATH)).toContain('<BuilderCategoryButton sopId={sopId}')
  })
})
