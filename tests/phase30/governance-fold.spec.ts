/**
 * UX-03 — One governance surface (flipped live in 30-08; repointed in 41-06
 * when /admin/sops became a redirect shim and the fold moved onto /sops;
 * repointed again in 54-05 when the queue moved off /sops?view=attention
 * onto its own route, /governance).
 *
 * Contract (30-RESEARCH § Test Map + orchestrator decisions #1/#4):
 *   - Governance now lives at /governance, a server page that reads
 *     listGovernanceQueue and renders the EXISTING GovernanceQueueRow (moved
 *     VERBATIM — reuse, not rewrite, preserves the HARD constraint) via
 *     GovernanceInbox.tsx / src/lib/governance/inbox.ts.
 *   - /admin/governance is a redirect() shim to /governance (GQ-04 —
 *     legacy ?filter=X bookmarks land on the whole inbox), with the admin
 *     guard IN FRONT of the redirect.
 *   - APR-03/APR-04 preserved: approveStep( wired in GovernanceQueueRow; the focus
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
const GOV_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'governance', 'page.tsx',
)
const GOV_INBOX = path.join(
  ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceInbox.tsx',
)
const INBOX = path.join(
  ROOT, 'src', 'lib', 'governance', 'inbox.ts',
)
const ACCESS_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'access', 'page.tsx',
)
const QUEUE_ROW = path.join(
  ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx',
)
const FLAG_DISPLAY = path.join(
  ROOT, 'src', 'lib', 'governance', 'flag-display.ts',
)
const PUBLISH_BAR = path.join(ROOT, 'src', 'components', 'focus', 'admin', 'PublishBar.tsx')
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-03 — governance lives at /governance', () => {
  test('/governance reads listGovernanceQueue server-side and renders the inbox with the unmodified GovernanceQueueRow', () => {
    const page = read(GOV_PAGE)
    expect(page).toContain('await loadInbox(')
    expect(read(path.join(ROOT, 'src', 'lib', 'governance', 'load-inbox.ts'))).toContain('listGovernanceQueue()')
    expect(page).toContain('<GovernanceInbox')
    // The inbox itself renders the derived queue via unmodified GovernanceQueueRow.
    const inbox = read(GOV_INBOX)
    expect(inbox).toContain('<GovernanceQueueRow')
    expect(inbox).toContain("from '@/lib/governance/inbox'")
  })

  test('/admin/governance is a next.config.ts redirect and /governance guards itself (Phase 43 D-01)', () => {
    const config = read(NEXT_CONFIG)
    expect(config).toContain("source: '/admin/governance',")
    expect(config).toContain("destination: '/governance',")
    const page = read(GOV_PAGE)
    expect(page).toContain('requireAdminContext()')
    expect(page).toContain("redirect('/')")
    // No unrelated governance surface renders here.
    expect(page).not.toContain('ApprovalChainEditor')
    expect(page).not.toContain('GovernanceQueueRow')
  })

  test('approveStep stays wired in GovernanceQueueRow AND the focus PublishBar defers to the chain (APR-03/04 hard constraint)', () => {
    const row = read(QUEUE_ROW)
    // Verbatim move: the gate AND the wired call site survive (2026-06-05:
    // assert handler wiring, not token presence).
    expect(row).toContain("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
    expect(row).toContain('await approveStep(row.id)')
    expect(row).toContain('onClick={handleApprove}')
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

  test('stuck conversions reach the inbox (Retry -> focus editor) and the Access lens stays reachable from its own admin page', () => {
    // Phase 54: the tab rail / Miller scope column is gone. Stuck/failed
    // conversions surface as inbox rows with a Retry link into the focus editor;
    // the Access lens is mounted by its own admin-gated page, /admin/access
    // (57-07; the library table that used to host it is gone, 57-09).
    const inbox = read(INBOX)
    expect(inbox).toContain("if (!lib.stuck && !lib.parseFailed) continue")
    expect(inbox).toContain("action: { label: 'Retry', href: focusHref(lib.id, { mode: 'edit', from: 'office' }) }")
    const access = read(ACCESS_PAGE)
    expect(access).toContain('await requireAdminContext()')
    expect(access).toContain('<AdminAccessLens pinnedSopId={pinnedSopId} />')
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
    // Phase 58-14: these two pages are redirect-only (the proxy 307s their addresses to the focus
    // editor before they render), so no pathway names them; 58-16 deletes the directories and this exemption.
    const redirectOnly = ['/admin/sops/builder/[sopId]', '/admin/sops/[sopId]/versions']
    const unmapped = found.filter((r) => !redirectOnly.includes(r) && !journeys.includes(`route: '${r}'`))
    expect(unmapped).toEqual([])
  })
})
