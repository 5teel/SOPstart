import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 05 Task 3 — governance queue Approve action + awaiting_approval
 * surfacing (source-contract, no live DB required). Repointed in 30-08
 * (UX-03): GovernanceWidget was deleted — the awaiting-approval count +
 * deep-link now live on the /admin/sops header chips (APR-03/APR-04 hard
 * constraint); QueueRow + FilterChips survive the fold verbatim.
 *
 * Repointed in 41-08 (Phase 41, SUR-01/02/04): the attention view's grouped
 * queue rendering moved off admin/sops/page.tsx (now a redirect shim) onto
 * AdminAttentionLens.tsx, a next/dynamic({ssr:false}) lens fed by
 * listGovernanceQueue. The approveStep/isCallerNextApprover/handleApprove
 * assertions below read GovernanceQueueRow.tsx, which did NOT move — that
 * file is deliberately double-guarded: this spec AND
 * tests/phase41/status-attention-lenses.spec.ts (41-04) both pin it, so the
 * approval-gate contract had two live guards throughout the Phase 41 move.
 *
 * Verifies:
 *   - GovernanceQueueRow's Approve branch condition is
 *     `awaiting_approval && isCallerNextApprover`, positioned BEFORE the
 *     unowned/stale_role branches, and its onClick calls approveStep(row.id)
 *     wired inside a useTransition (not a bare/empty handler — CLAUDE.md
 *     2026-06-05 dead-feature learning).
 *   - GovernanceFilterChips CHIPS includes awaiting_approval.
 *   - AdminAttentionLens/flag-display.ts carry the awaiting_approval group +
 *     plain-language blurb.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const QUEUE_ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const FILTER_CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const ATTENTION_LENS = path.join(ROOT, 'src', 'components', 'sop', 'lenses', 'AdminAttentionLens.tsx')
const FLAG_DISPLAY = path.join(ROOT, 'src', 'lib', 'governance', 'flag-display.ts')

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

// 2026-07-30 (sketch 004): GovernanceFilterChips deleted — the attention
// view is a grouped worst-first queue, so awaiting_approval is ALWAYS
// visible as its own group instead of behind a chip/filter.
test.describe('AdminAttentionLens — awaiting_approval surfaced (chips deleted)', () => {
  test('GovernanceFilterChips is gone from AdminAttentionLens.tsx and from disk', () => {
    const src = read(ATTENTION_LENS)
    expect(src).not.toContain('GovernanceFilterChips')
    expect(fs.existsSync(FILTER_CHIPS)).toBe(false)
  })

  test('awaiting_approval is a grouped section with a plain-language blurb', () => {
    const flagSrc = read(FLAG_DISPLAY)
    expect(flagSrc).toContain("FLAG_PRIORITY: GovernanceFlag[] = ['overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role']")
    expect(flagSrc).toContain("awaiting_approval: 'Awaiting approval'")
    expect(flagSrc).toContain("awaiting_approval: 'waiting on an approval step'")
    const lensSrc = read(ATTENTION_LENS)
    expect(lensSrc).toContain('attentionGroups.map')
  })
})
