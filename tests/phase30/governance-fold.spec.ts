/**
 * UX-03 — One governance surface (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + orchestrator decision #1/#4):
 *   - Governance folds into /admin/sops?view=attention ("Needs attention"
 *     view) rendering the EXISTING GovernanceQueueRow + GovernanceFilterChips
 *     (moved VERBATIM — reuse, not rewrite, preserves the HARD constraint).
 *   - /admin/governance becomes a redirect() shim mapping legacy ?filter=X
 *     deep-links onto the new view's filter param (GQ-04 preserved).
 *   - APR-03/APR-04 preserved: approveStep( wired in GovernanceQueueRow AND
 *     builder PublishStage; awaiting-approval count + deep-link live on
 *     /admin/sops header chips (server-rendered — Pitfall 10).
 *   - GovernanceWidget + LibraryReviewCell removed as separate surfaces.
 *   - The old STATUS_TABS "Needs attention" (value=failed) renames to
 *     "Parse issues" (decision #4 — no naming collision).
 *   - Phase 28/29 server actions (governance.ts / approvals.ts) UNCHANGED.
 *
 * This file starts as test.fixme — the UX-03 plan flips it live.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ADMIN_SOPS_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx',
)
const QUEUE_ROW = path.join(
  ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx',
)
const PUBLISH_STAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'PublishStage.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-03 — governance folds into /admin/sops', () => {
  test.fixme('/admin/sops renders the needs-attention view (QueueRow + FilterChips) behind ?view=attention', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).toContain('GovernanceQueueRow')
    expect(src).toContain('GovernanceFilterChips')
    expect(src).toContain('listGovernanceQueue')
  })

  test.fixme('/admin/governance is a redirect shim mapping legacy ?filter= deep-links', () => {
    const src = read(
      path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx'),
    )
    expect(src).toContain('redirect(')
    expect(src).toContain('view=attention')
  })

  test.fixme('approveStep stays wired in GovernanceQueueRow AND PublishStage (APR-03/04 hard constraint)', () => {
    expect(read(QUEUE_ROW)).toContain('approveStep(')
    expect(read(PUBLISH_STAGE)).toContain('approveStep')
  })

  test.fixme('awaiting-approval count + deep-link survive on /admin/sops header chips', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).toContain('awaiting_approval')
  })

  test.fixme('GovernanceWidget and LibraryReviewCell no longer exist as separate surfaces', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceWidget.tsx')),
    ).toBe(false)
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'LibraryReviewCell.tsx')),
    ).toBe(false)
  })
})
