/**
 * UX-03 — One governance surface (flipped live in 30-08; repointed in 41-06
 * when /admin/sops became a redirect shim and the fold moved onto /sops;
 * repointed again in 54-05 when the queue moved off /sops?view=attention
 * onto its own route, /governance; repointed in 59-14 when the page, the inbox
 * wrapper and the queue row were deleted -- the Office Inbox tab replaces them).
 *
 * Contract (30-RESEARCH § Test Map + orchestrator decisions #1/#4):
 *   - Governance now lives in the Office Inbox tab; the inbox is read through
 *     loadInbox (listGovernanceQueue) and derived by src/lib/governance/inbox.ts.
 *   - /admin/governance is a next.config.ts redirect to /governance, which the
 *     proxy sends on into the Office (GQ-04 -- legacy ?filter=X bookmarks land
 *     on the whole inbox).
 *   - APR-03/APR-04 preserved: approveStep( wired in the Office ApprovePanel; the focus
 *     editor's PublishBar withholds Publish while a chain is pending and names the
 *     approver (58-15: the old builder's publish stage and its own Approve button are
 *     gone; approving happens from the governance inbox).
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
const INBOX = path.join(
  ROOT, 'src', 'lib', 'governance', 'inbox.ts',
)
const OFFICE_PANE = path.join(ROOT, 'src', 'components', 'office', 'OfficePane.tsx')
const APPROVE_PANEL = path.join(ROOT, 'src', 'components', 'office', 'ApprovePanel.tsx')
const FLAG_DISPLAY = path.join(
  ROOT, 'src', 'lib', 'governance', 'flag-display.ts',
)
const PUBLISH_BAR = path.join(ROOT, 'src', 'components', 'focus', 'admin', 'PublishBar.tsx')
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-03 — governance lives in the Office Inbox tab', () => {
  test('the governance page is gone; the inbox is read through loadInbox and the Office pane', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', '(protected)', 'governance'))).toBe(false)
    expect(read(path.join(ROOT, 'src', 'lib', 'governance', 'load-inbox.ts'))).toContain('listGovernanceQueue()')
    expect(read(OFFICE_PANE)).toContain('InboxTab')
  })

  test('/admin/governance is still a next.config.ts redirect to /governance (Phase 43 D-01)', () => {
    const config = read(NEXT_CONFIG)
    expect(config).toContain("source: '/admin/governance',")
    expect(config).toContain("destination: '/governance',")
  })

  test('approveStep stays wired in the Office ApprovePanel AND the focus PublishBar defers to the chain (APR-03/04 hard constraint)', () => {
    // 2026-06-05: assert handler wiring, not token presence.
    expect(read(APPROVE_PANEL)).toContain('await approveStep(sopId)')
    // The editor never publishes around a pending chain: it reads the approval status,
    // withholds the Publish button while pending, and the dialog reports pending approval.
    const bar = read(PUBLISH_BAR)
    expect(bar).toContain('getApprovalStatus(')
    expect(bar).toContain("approval.data?.state === 'pending'")
    expect(bar).toContain('isAdmin && !pending')
    expect(bar).toContain('onPendingApproval={() => setSentNow(true)}')
  })

  test('awaiting-approval survives as an always-visible inbox chip', () => {
    // Priority ordering lives in the shared flag-display.ts (41-04); the
    // inbox classifier derives its own chip from the same flag.
    expect(read(FLAG_DISPLAY)).toContain(
      "'overdue', 'due_soon', 'awaiting_approval', 'unowned', 'stale_role'",
    )
    const inbox = read(INBOX)
    expect(inbox).toContain("{ key: 'approve', label: 'Approve' }")
    expect(inbox).toContain("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
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

  test('stuck conversions reach the inbox (Try again -> re-queue, Open -> focus editor) and the Access lens stays reachable from the Office Access tab', () => {
    // Phase 54: the tab rail / Miller scope column is gone. Stuck/failed
    // conversions surface as inbox rows with a Retry link into the focus editor;
    // the Access lens is mounted by the Office Access tab (59-11; the
    // /admin/access bridge page was deleted in 59-14).
    const inbox = read(INBOX)
    expect(inbox).toContain("if (!lib.stuck && !lib.parseFailed) continue")
    expect(inbox).toContain("{ label: 'Try again', href, retry: { sopId: lib.id, isVideo: pr.isVideo } }")
    expect(read(OFFICE_PANE)).toContain('<AdminAccessLens')
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'access'))).toBe(false)
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
