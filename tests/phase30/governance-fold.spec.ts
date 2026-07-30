/**
 * UX-03 — One governance surface (flipped live in 30-08).
 *
 * Contract (30-RESEARCH § Test Map + orchestrator decisions #1/#4):
 *   - Governance folds into /admin/sops?view=attention ("Needs attention"
 *     view) rendering the EXISTING GovernanceQueueRow + GovernanceFilterChips
 *     (moved VERBATIM — reuse, not rewrite, preserves the HARD constraint).
 *   - /admin/governance is a redirect() shim mapping legacy ?filter=X
 *     deep-links onto the new view's filter param (GQ-04 preserved), with the
 *     admin guard IN FRONT of the redirect.
 *   - APR-03/APR-04 preserved: approveStep( wired in GovernanceQueueRow AND
 *     builder PublishStage; awaiting-approval count + deep-link live on
 *     /admin/sops header chips (server-rendered — Pitfall 10).
 *   - GovernanceWidget + LibraryReviewCell removed as separate surfaces.
 *   - The old STATUS_TABS "Needs attention" (value=failed) renamed to
 *     "Parse issues" (decision #4 — no naming collision).
 *   - Phase 28/29 server actions (governance.ts / approvals.ts) UNCHANGED.
 *   - /pathways coverage: every route in the App Router tree is mapped by a
 *     journeys.ts step (0 not-mapped — CLAUDE.md pathways rule).
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
const GOVERNANCE_SHIM = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx',
)
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-03 — governance folds into /admin/sops', () => {
  test('/admin/sops renders the needs-attention view (QueueRow + FilterChips) behind ?view=attention', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).toContain("params.view === 'attention'")
    expect(src).toContain('<GovernanceQueueRow')
    // 2026-07-30 (sketch 004): the chip row is gone — the attention view is
    // a grouped worst-first queue instead (every flag always visible).
    expect(src).not.toContain('<GovernanceFilterChips')
    expect(src).toContain('attentionGroups.map')
    expect(src).toContain('listGovernanceQueue')
  })

  test('/admin/governance is a redirect shim mapping legacy ?filter= deep-links, guard first', () => {
    const src = read(GOVERNANCE_SHIM)
    expect(src).toContain('redirect(')
    expect(src).toContain('view=attention')
    expect(src).toContain('view=attention&filter=${filter}')
    // Guard stays in front of the redirect (T-30-08-03).
    // 2026-07-13: member.role → role (shared getSessionContext auth refactor)
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    // No governance surface renders here anymore.
    expect(src).not.toContain('GovernanceQueueRow')
    expect(src).not.toContain('ApprovalChainEditor')
  })

  test('approveStep stays wired in GovernanceQueueRow AND PublishStage (APR-03/04 hard constraint)', () => {
    const row = read(QUEUE_ROW)
    // Verbatim move: the gate AND the wired call site survive (2026-06-05:
    // assert handler wiring, not token presence).
    expect(row).toContain("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
    expect(row).toContain('await approveStep(row.id)')
    expect(row).toContain('onClick={handleApprove}')
    expect(read(PUBLISH_STAGE)).toContain('approveStep')
  })

  test('awaiting-approval survives as an always-visible attention group (header chips deleted, sketch 004)', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).toContain("'overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role'")
    expect(src).toContain("awaiting_approval: 'Awaiting approval'")
    expect(src).toContain('attentionGroups.map')
  })

  test('GovernanceWidget and LibraryReviewCell no longer exist as separate surfaces', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceWidget.tsx')),
    ).toBe(false)
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'sops', 'LibraryReviewCell.tsx')),
    ).toBe(false)
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'admin', 'LibraryReviewCell.tsx')),
    ).toBe(false)
  })

  test('Parse issues lives in the rail filter menu; the folded view owns "Needs attention" (decision #4, sketch 004)', () => {
    const src = read(ADMIN_SOPS_PAGE)
    // 2026-07-30: failed-status moved from a top-level tab into the rail's
    // details Filter menu — still reachable, still named Parse issues.
    expect(src).toContain('Parse issues')
    expect(src).toContain('href="/admin/sops?status=failed"')
    expect(src).not.toContain("{ label: 'Needs attention', value: 'failed' }")
    // The folded view's tab carries the "Needs attention" name.
    expect(src).toContain('Needs attention')
    expect(src).toContain('href="/admin/sops?view=attention"')
  })
})

test.describe('pathways coverage — 0 not-mapped (CLAUDE.md pathways rule)', () => {
  test('every App Router page route is mapped by a journeys.ts step', () => {
    // Mirrors src/lib/journeys/routes.ts listAppRoutes() — the same walk the
    // /pathways "All screens" panel derives its inventory from.
    const appDir = path.join(ROOT, 'src', 'app')
    const found: string[] = []
    const walk = (dir: string, segs: string[]) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const name = entry.name
        if (name === 'api' || name.startsWith('@') || name.startsWith('_')) continue
        const isGroup = name.startsWith('(') && name.endsWith(')')
        const nextSegs = isGroup ? segs : [...segs, name]
        const full = path.join(dir, name)
        if (fs.existsSync(path.join(full, 'page.tsx'))) found.push('/' + nextSegs.join('/'))
        walk(full, nextSegs)
      }
    }
    walk(appDir, [])
    const journeys = read(JOURNEYS)
    const unmapped = found.filter((r) => !journeys.includes(`route: '${r}'`))
    expect(unmapped).toEqual([])
  })
})
