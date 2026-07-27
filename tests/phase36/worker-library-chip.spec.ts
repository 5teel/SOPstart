/**
 * Phase 36 Plan 08 -- REF-01 / D-08: worker Your-SOPs library chip.
 *
 * Source-contract assertions proving the refresher-due chip is actually
 * wired end to end (CLAUDE.md 2026-06-05 dead-feature class), not merely
 * a card prop nobody calls. Also proves neither file re-introduces a
 * gating branch on the new fields (belt-and-suspenders alongside the
 * broader tests/phase36/no-refresher-gate.spec.ts guard).
 *
 * Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOP_LIBRARY_CARD = path.join(ROOT, 'src', 'components', 'sop', 'SopLibraryCard.tsx')
const WORKER_SOP_LIBRARY = path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('REF-01 / D-08 -- SopLibraryCard refresher-due chip', () => {
  const cardSrc = read(SOP_LIBRARY_CARD)

  test('declares isRefresherDue and isRefresherOverdue as optional props', () => {
    expect(cardSrc).toMatch(/isRefresherDue\?:\s*boolean/)
    expect(cardSrc).toMatch(/isRefresherOverdue\?:\s*boolean/)
  })

  test('renders data-refresher-due-badge', () => {
    expect(cardSrc).toContain('data-refresher-due-badge')
  })
})

test.describe('REF-01 / D-08 -- worker library page wires the chip from real data', () => {
  const pageSrc = read(WORKER_SOP_LIBRARY)

  test('imports refresherDueDate from @/lib/competency/refresher', () => {
    expect(pageSrc).toMatch(/import\s*\{[^}]*refresherDueDate[^}]*\}\s*from\s*['"]@\/lib\/competency\/refresher['"]/)
  })

  test('the <SopLibraryCard element passes both refresher fields, not merely somewhere in the file', () => {
    const match = pageSrc.match(/<SopLibraryCard[\s\S]*?\/>/)
    expect(match).not.toBeNull()
    const element = match ? match[0] : ''
    expect(element).toContain('isRefresherDue')
    expect(element).toContain('isRefresherOverdue')
  })

  test('neither file contains a gating branch on the new fields', () => {
    const GATE_FIELDS = 'isRefresherOverdue|isRefresherDue|refresher_interval_months'
    // Same corrected shape as tests/phase36/no-refresher-gate.spec.ts
    // GATE_PATTERN (WR-06): the old `[<>!]` class missed equality gates
    // entirely (`isRefresherDue === true` starts with `=`) and bare
    // ternaries. This catches ===/==/!==/!=/</<=/>/>= comparisons, bare
    // ternary gates, and if-branches — while passing plain JSX props /
    // destructuring defaults (single `=`), optional props (`?:`), nullish
    // defaults (`??`), and string-literal label ternaries.
    const GATE_PATTERN = new RegExp(
      `(${GATE_FIELDS})\\s*(===|!==|==|!=|<=?|>=?|\\?(?![?.:]|\\s*['"\`]))|if\\s*\\([^)]*(${GATE_FIELDS})[^)]*\\)`
    )
    // Self-check: the pattern is live (an equality gate the old class missed
    // must match; the card's passive optional-prop syntax must not).
    expect('isRefresherDue === true ? blocked : open').toMatch(GATE_PATTERN)
    expect('isRefresherDue?: boolean').not.toMatch(GATE_PATTERN)
    expect(read(SOP_LIBRARY_CARD)).not.toMatch(GATE_PATTERN)
    expect(pageSrc).not.toMatch(GATE_PATTERN)
  })
})
