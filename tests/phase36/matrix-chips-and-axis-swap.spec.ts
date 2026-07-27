/**
 * Phase 36 Plan 07 — source-contract assertions for the CMP-03/REF-01/TRN-03
 * chips + rollup tallies + axis-swap toggle. LIVE from creation (both target
 * files exist today). Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STATE_PILL = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'StatePill.tsx')
const MATRIX_VIEW = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'TrainingMatrixView.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

// Mirrors tests/phase36/no-refresher-gate.spec.ts's GATE_PATTERN idiom — a
// bare JSX render guard (`{x && <span`) must NOT match; an `if (...)` branch
// or a comparison on the new fields must.
const GATE_FIELDS = 'isOutdatedVersion|refresherDueAt|isRefresherOverdue'
const GATE_PATTERN = new RegExp(
  `(${GATE_FIELDS})\\s*[<>=!]|if\\s*\\([^)]*(${GATE_FIELDS})[^)]*\\)`
)

test.describe('StatePill — outdated-version and refresher chips (D-04)', () => {
  test('renders an "Outdated version" chip', () => {
    expect(read(STATE_PILL)).toContain('Outdated version')
  })

  test('renders both refresher labels (due + overdue)', () => {
    const src = read(STATE_PILL)
    expect(src).toContain('Refresher overdue')
    expect(src).toContain('Refresher due')
  })

  test('never uses --accent-escalate on any chip', () => {
    expect(read(STATE_PILL)).not.toContain('accent-escalate')
  })

  test('contains no gating branch (if/comparison) on the new fields', () => {
    expect(read(STATE_PILL)).not.toMatch(GATE_PATTERN)
  })

  test('has no disabled/onClick affordance on the chips', () => {
    const src = read(STATE_PILL)
    expect(src).not.toContain('onClick=')
    expect(src).not.toMatch(/\bdisabled[=>]/)
  })

  test('every var(--...) token referenced is declared in blueprint-theme.css', () => {
    const themeSrc = read(path.join(ROOT, 'src', 'styles', 'blueprint-theme.css'))
    const src = read(STATE_PILL)
    const tokens = new Set(Array.from(src.matchAll(/var\((--[a-z0-9-]+)/g)).map((m) => m[1]))
    for (const token of tokens) {
      expect(themeSrc, `${token} must be declared in blueprint-theme.css`).toMatch(new RegExp(`${token}:`))
    }
  })
})

test.describe('TrainingMatrixView — appended rollup tallies (D-05)', () => {
  test('appends "on outdated version" to both row and column rollups', () => {
    const src = read(MATRIX_VIEW)
    expect((src.match(/on outdated version/g) ?? []).length).toBe(2)
  })

  test('appends "refresher overdue" to both row and column rollups', () => {
    const src = read(MATRIX_VIEW)
    expect((src.match(/refresher overdue/g) ?? []).length).toBe(2)
  })

  test('existing "signed off" and "competent" rollup fragments are still present', () => {
    const src = read(MATRIX_VIEW)
    expect(src).toContain('signed off')
    expect(src).toContain('competent')
  })
})

test.describe('TrainingMatrixView — axis-swap toggle', () => {
  test('has a transposed state driving a toggle and render remap', () => {
    const src = read(MATRIX_VIEW)
    expect((src.match(/transposed/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  test('toggle carries aria-pressed', () => {
    expect(read(MATRIX_VIEW)).toContain('aria-pressed')
  })

  test('isCompact no longer hardcodes sops.length — references the orientation-aware column array', () => {
    const src = read(MATRIX_VIEW)
    const isCompactLine = src.split('\n').find((l) => l.includes('const isCompact ='))
    expect(isCompactLine, 'isCompact declaration not found').toBeTruthy()
    expect(isCompactLine).not.toContain('sops.length')
    expect(isCompactLine).toContain('colItems.length')
  })

  test('onSelectCell is still called with (personId, sopId) semantics', () => {
    const src = read(MATRIX_VIEW)
    expect(src).toMatch(/onSelectCell\(personId,\s*forSopId\)/)
  })
})

test.describe('Folded todo closed out', () => {
  test('2026-07-26-matrix-axis-swap.md no longer exists under .planning/todos/pending/', () => {
    const pendingPath = path.join(ROOT, '.planning', 'todos', 'pending', '2026-07-26-matrix-axis-swap.md')
    expect(fs.existsSync(pendingPath)).toBe(false)
  })
})
