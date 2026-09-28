/**
 * Phase 53 -- PHN-01/D-03. Source-contract tests for the floor-thumbnail
 * bottom sheet: department-grouped machine rows with pin counts, row tap
 * navigates to /m/<code>.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SHEET_PATH = 'src/components/sop/plant/MachineListSheet.tsx'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('MachineListSheet', () => {
  test('returns null when closed', () => {
    const src = read(SHEET_PATH)
    expect(src).toContain('if (!open) return null')
  })

  test('rows are next/link Links whose href is /m/${m.code}', () => {
    const src = read(SHEET_PATH)
    expect(src).toContain("import Link from 'next/link'")
    expect(src).toContain('data-testid="machine-sheet-row"')
    expect(src).toMatch(/href=\{`\/m\/\$\{m\.code\}`\}/)
  })

  test('the Done button and the backdrop both call onClose', () => {
    const src = read(SHEET_PATH)
    expect(src).toContain('data-testid="machine-sheet-close"')
    const closeIdx = src.indexOf('data-testid="machine-sheet-close"')
    const closeButton = src.slice(closeIdx, src.indexOf('</button>', closeIdx))
    expect(closeButton).toContain('onClick={onClose}')

    const backdropIdx = src.indexOf('bg-black/60')
    const backdrop = src.slice(Math.max(0, backdropIdx - 200), backdropIdx + 100)
    expect(backdrop).toContain('onClick={onClose}')
  })

  test('a "No department" group exists for machines with no matched department', () => {
    const src = read(SHEET_PATH)
    expect(src).toContain('No department')
    expect(src).toMatch(/groupedIds\.has\(m\.id\)/)
  })

  test('the pin renders only under a > 0 condition', () => {
    const src = read(SHEET_PATH)
    expect(src).toContain('data-testid="machine-sheet-pin"')
    expect(src).toMatch(/pin > 0\s*&&/)
  })

  test('imports nothing from PlantStage', () => {
    const src = read(SHEET_PATH)
    expect(src).not.toContain('PlantStage')
  })
})
