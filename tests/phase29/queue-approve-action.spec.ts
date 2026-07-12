import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 05 Task 3 — governance queue Approve action + awaiting_approval
 * surfacing (source-contract, no live DB required).
 *
 * Verifies:
 *   - GovernanceQueueRow's Approve branch condition is
 *     `awaiting_approval && isCallerNextApprover`, positioned BEFORE the
 *     unowned/stale_role branches, and its onClick calls approveStep(row.id)
 *     wired inside a useTransition (not a bare/empty handler — CLAUDE.md
 *     2026-06-05 dead-feature learning).
 *   - GovernanceFilterChips CHIPS includes awaiting_approval.
 *   - GovernanceWidget counts object + Link both carry awaiting_approval.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const QUEUE_ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const FILTER_CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const WIDGET = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceWidget.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('GovernanceQueueRow — awaiting_approval priority Approve branch', () => {
  const src = read(QUEUE_ROW)

  test('imports approveStep from src/actions/approvals', () => {
    expect(src).toContain("import { approveStep } from '@/actions/approvals'")
  })

  test('handleApprove calls approveStep(row.id) inside startTransition', () => {
    const fnMatch = src.match(/function handleApprove\(\) \{([\s\S]*?)\n  \}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('startTransition(async () => {')
    expect(fnMatch![0]).toContain('await approveStep(row.id)')
  })

  test('Approve branch is gated on awaiting_approval && isCallerNextApprover, BEFORE unowned/stale_role', () => {
    const approveIdx = src.indexOf("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
    const unownedIdx = src.indexOf("row.flags.includes('unowned')")
    const staleIdx = src.indexOf("row.flags.includes('stale_role')")
    expect(approveIdx).toBeGreaterThan(-1)
    expect(unownedIdx).toBeGreaterThan(-1)
    expect(staleIdx).toBeGreaterThan(-1)
    expect(approveIdx).toBeLessThan(unownedIdx)
    expect(approveIdx).toBeLessThan(staleIdx)
  })

  test('Approve button onClick is wired to handleApprove (not empty)', () => {
    const branchMatch = src.match(/row\.isCallerNextApprover \? \(([\s\S]*?)\) : row\.flags\.includes\('unowned'\)/)
    expect(branchMatch).not.toBeNull()
    expect(branchMatch![1]).toContain('onClick={handleApprove}')
  })
})

test.describe('GovernanceFilterChips — awaiting_approval chip', () => {
  const src = read(FILTER_CHIPS)

  test('GovernanceFilter union includes awaiting_approval', () => {
    expect(src).toMatch(/export type GovernanceFilter = [^\n]*'awaiting_approval'/)
  })

  test('CHIPS array includes the awaiting_approval entry', () => {
    expect(src).toContain("{ label: 'Awaiting approval', value: 'awaiting_approval' }")
  })
})

test.describe('GovernanceWidget — awaiting_approval count + link', () => {
  const src = read(WIDGET)

  test('counts object includes awaiting_approval', () => {
    expect(src).toContain('awaiting_approval: 0')
  })

  test('increments counts.awaiting_approval from row.flags', () => {
    expect(src).toContain("if (row.flags.includes('awaiting_approval')) counts.awaiting_approval++")
  })

  test('renders a Link to /admin/governance?filter=awaiting_approval', () => {
    expect(src).toContain('href="/admin/governance?filter=awaiting_approval"')
  })
})
