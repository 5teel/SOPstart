import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 05 Task 3 -- awaiting_approval surfacing (source-contract, no
 * live DB required). The governance queue row that carried the Approve branch
 * was deleted in 59-14 with the governance page; the Office rows replace it
 * (tests/phase59/office-pane-structure.spec.ts pins the approve-before-owner
 * precedence, tests/phase59/approve-actions.spec.ts pins the panel's
 * approveStep call).
 *
 * Verifies:
 *   - GovernanceFilterChips no longer exists.
 *   - INBOX_CHIPS/flag-display.ts carry the awaiting_approval group +
 *     plain-language blurb.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const FILTER_CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const INBOX = path.join(ROOT, 'src', 'lib', 'governance', 'inbox.ts')
const FLAG_DISPLAY = path.join(ROOT, 'src', 'lib', 'governance', 'flag-display.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// 2026-07-30 (sketch 004) / 2026-09-29 (Phase 54): GovernanceFilterChips
// deleted — the governance inbox is a derived, chip-filterable queue, so
// awaiting_approval is always represented as its own Approve chip.
test.describe('Office inbox — awaiting_approval surfaced (chips deleted)', () => {
  test('GovernanceFilterChips is gone from disk', () => {
    expect(fs.existsSync(FILTER_CHIPS)).toBe(false)
  })

  test('awaiting_approval is its own inbox chip with a plain-language blurb', () => {
    const inboxSrc = read(INBOX)
    expect(inboxSrc).toContain("{ key: 'approve', label: 'Approve' }")
    expect(inboxSrc).toContain("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
    const flagSrc = read(FLAG_DISPLAY)
    expect(flagSrc).toContain("FLAG_PRIORITY: GovernanceFlag[] = ['overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role']")
    expect(flagSrc).toContain("awaiting_approval: 'Awaiting approval'")
    expect(flagSrc).toContain("awaiting_approval: 'waiting on an approval step'")
  })
})
