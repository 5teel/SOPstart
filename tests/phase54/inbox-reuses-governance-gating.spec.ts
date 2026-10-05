/**
 * Phase 54 / Plan 54-02 -- D-03 hard constraint (APR-03/04, Phase 29/41):
 * the inbox reuses GovernanceQueueRow / approveStep gating verbatim, it does
 * not re-implement approver precedence (approve-me before unowned before
 * stale-role).
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const QUEUE_ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const INBOX = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceInbox.tsx')
const INBOX_LIB = path.join(ROOT, 'src', 'lib', 'governance', 'inbox.ts')
const PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'governance', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

/** Strips // and /* *\/ comments so an explanatory comment quoting a
 *  forbidden literal (e.g. "does not call approveStep") never false-fails
 *  the absence check (CLAUDE.md 2026-09-28 x3). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

test.describe('inbox reuses governance gating, does not re-derive it (54-02)', () => {
  test('GovernanceInbox imports and renders GovernanceQueueRow, no local isCallerNextApprover copy', () => {
    const src = read(INBOX)
    expect(src).toContain("import { GovernanceQueueRow } from './GovernanceQueueRow'")
    expect(src).toContain('<GovernanceQueueRow')
    expect(src).not.toContain('isCallerNextApprover')
  })

  test('GovernanceInbox / inbox.ts / governance page never call approveStep, OwnerPicker, setSopOwner or confirmSopCurrent directly', () => {
    const forbidden = ['approveStep', 'OwnerPicker', 'setSopOwner', 'confirmSopCurrent']
    for (const file of [INBOX, INBOX_LIB, PAGE]) {
      const stripped = stripComments(read(file))
      const present = forbidden.filter((token) => stripped.includes(token))
      expect(present, `${file} references: ${present.join(', ')}`).toEqual([])
    }
  })

  test('GovernanceQueueRow still imports approveStep from @/actions/approvals', () => {
    const src = read(QUEUE_ROW)
    expect(src).toContain("import { approveStep } from '@/actions/approvals'")
  })

  test('approve-me precedence still checked before unowned before stale-role', () => {
    const src = read(QUEUE_ROW)
    const approveIdx = src.indexOf("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
    const unownedIdx = src.indexOf("row.flags.includes('unowned')")
    const staleIdx = src.indexOf("row.flags.includes('stale_role')")
    expect(approveIdx).toBeGreaterThan(-1)
    expect(unownedIdx).toBeGreaterThan(-1)
    expect(staleIdx).toBeGreaterThan(-1)
    expect(approveIdx).toBeLessThan(unownedIdx)
    expect(unownedIdx).toBeLessThan(staleIdx)
  })

  test('approve branch wired to handleApprove, handleApprove wraps approveStep(row.id) in startTransition', () => {
    const src = read(QUEUE_ROW)
    const branchMatch = src.match(/row\.isCallerNextApprover \? \(([\s\S]*?)\) : row\.flags\.includes\('unowned'\)/)
    expect(branchMatch).not.toBeNull()
    expect(branchMatch![1]).toContain('onClick={handleApprove}')

    const fnMatch = src.match(/function handleApprove\(\) \{([\s\S]*?)\n  \}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('startTransition(async () => {')
    expect(fnMatch![0]).toContain('await approveStep(row.id)')
  })

  test('confirmSopCurrent(row.id) and router.refresh() still present', () => {
    const src = read(QUEUE_ROW)
    expect(src).toContain('confirmSopCurrent(row.id)')
    expect(src).toContain('router.refresh()')
  })

  test('gov-row testid and the editor link survive', () => {
    const src = read(QUEUE_ROW)
    expect(src).toContain('data-testid="gov-row"')
    expect(src).toContain("focusHref(row.id, { mode: 'edit', from: 'office' })")
  })
})
