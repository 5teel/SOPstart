/**
 * Phase 28 Plan 05 — admin library governance additions + worker no-gate
 * currency caption. Repointed in 30-08 (UX-03/UX-06): LibraryReviewCell and
 * GovernanceWidget were deleted as separate surfaces — the owner label + flag
 * chip live on the one-line library rows, the counts + deep-links live on the
 * /admin/sops header chips, and Confirm current lives on GovernanceQueueRow
 * in the folded needs-attention view.
 *
 * Repointed AGAIN in 41-08 (SUR-01/02/04): the admin library rows moved to
 * `listAdminSopRows` (src/actions/admin-sop-list.ts).
 *
 * Repointed a third time in 54-05, and again in 57-09 (D-13): the admin library
 * table is deleted -- there is no admin list page. The governance queue lives
 * at /governance (GovernanceInbox.tsx, src/lib/governance/inbox.ts) and the
 * legacy ?view=attention address is redirected by the session proxy.
 *
 * Verifies (source-contract, no live DB required):
 *   OWN-04/D28-08: listAdminSopRows handles ?owner=me with a REAL
 *     .eq('owner_user_id', ...) filter (not just a bare "owner" string).
 *   REV-02/REV-04: the overdue signal derives from the org-scoped governance
 *     queue (classifyGovernanceRow's review_due_at < now), rendered as the
 *     row flag chip; Confirm current stays a real wired call on
 *     GovernanceQueueRow (the merged surface).
 *   GQ-04/D28-09: listAdminSopRows counts from listGovernanceQueue, and the
 *     session proxy + the governance inbox's chips deep-link the flags.
 *   REV-03/D28-07: every worker focus file (58-15; the tabbed read page is
 *     gone) contains NO review_due_at conditional/gate (hard rule).
 *   REV-02/D28-07: the worker SOP detail route contains no
 *     review_due_at/owner_user_id gating branch — governance never blocks
 *     worker read/walkthrough access.
 *
 * Registration: playwright.config.ts `phase28` project
 *   testDir: '.', testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase28`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ADMIN_SOP_LIST = path.join(ROOT, 'src', 'actions', 'admin-sop-list.ts')
const INBOX = path.join(ROOT, 'src', 'lib', 'governance', 'inbox.ts')
const FLAG_DISPLAY = path.join(ROOT, 'src', 'lib', 'governance', 'flag-display.ts')
const QUEUE_ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const CLASSIFY = path.join(ROOT, 'src', 'lib', 'governance', 'classify.ts')
const WORKER_SOP_DETAIL = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')
// 58-15: the worker's read/walk surface is the focus screen -- its frame, browse
// document, walker, walk steps, review/send panels and the walk hook + actions.
const FOCUS = (f: string) => path.join(ROOT, 'src', 'components', 'focus', f)
const WORKER_FOCUS_FILES = [
  'FocusFrame.tsx', 'FocusTopBar.tsx', 'FocusRail.tsx', 'BrowseDocument.tsx', 'FocusWalker.tsx',
  'WalkStep.tsx', 'ReviewAndSend.tsx', 'SentPanel.tsx', 'ResumeCard.tsx', 'KindChip.tsx',
].map(FOCUS)
const WALK_HOOK = path.join(ROOT, 'src', 'hooks', 'useWalk.ts')
const WALK_ACTIONS = path.join(ROOT, 'src', 'actions', 'walk.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// A review-state/owner gating branch: an if/conditional that inspects
// review_due_at or owner_user_id and could alter worker-facing control flow.
const GATE_PATTERN = /review_due_at\s*[<>]|owner_user_id\s*[=!]==?\s*null|if\s*\([^)]*(review_due_at|owner_user_id)/

// ---------------------------------------------------------------------------
// listAdminSopRows — OWN-04/D28-08 (repointed 2026-09-29; table retired 57-09)
// ---------------------------------------------------------------------------

test.describe('admin rows — owner=me filter + owner/flag columns', () => {
  test('listAdminSopRows handles ?owner=me with a real .eq owner_user_id filter', () => {
    const src = read(ADMIN_SOP_LIST)
    expect(src).toContain("params.owner === 'me'")
    expect(src).toContain("query.eq('owner_user_id', user.id)")
  })

  test('listAdminSopRows selects owner_user_id and review_due_at columns', () => {
    const src = read(ADMIN_SOP_LIST)
    expect(src).toContain('owner_user_id')
    expect(src).toContain('review_due_at')
  })

  test('renders the owner label on each one-line row (UX-06)', () => {
    const src = read(ADMIN_SOP_LIST)
    expect(src).toContain('ownerLabelById[sop.owner_user_id]')
  })
})

// ---------------------------------------------------------------------------
// Merged surface — REV-02/REV-04 (was LibraryReviewCell, deleted in 30-08)
// ---------------------------------------------------------------------------

test.describe('merged surface — wired confirm-current + queue-derived overdue signal', () => {
  test('GovernanceQueueRow wires the real confirmSopCurrent( call', () => {
    const src = read(QUEUE_ROW)
    expect(src).toContain("import { confirmSopCurrent } from '@/actions/governance'")
    expect(src).toContain('confirmSopCurrent(row.id)')
  })

  test('overdue derives from the review_due_at < now classification (server-side, admin surfaces only)', () => {
    const src = read(CLASSIFY)
    expect(src).toMatch(/due < now/)
    expect(src).toContain("flags.push('overdue')")
  })

  test('listAdminSopRows renders the queue-derived flag chip (rowFlag -> flagLabel on MillerSop)', () => {
    const src = read(ADMIN_SOP_LIST)
    expect(src).toContain('FLAG_LABEL[flag]')
    expect(src).toContain('rowFlag[sop.id]')
  })
})

// ---------------------------------------------------------------------------
// Header/scope chips — GQ-04/D28-09 (was GovernanceWidget, deleted in 30-08;
// repointed 2026-09-29, 57-09 onto the proxy + the governance inbox)
// ---------------------------------------------------------------------------

test.describe('admin scope counts — counts from listGovernanceQueue + deep links', () => {
  test('listAdminSopRows counts from listGovernanceQueue', () => {
    const src = read(ADMIN_SOP_LIST)
    expect(src).toContain("from '@/actions/governance'")
    expect(src).toContain('listGovernanceQueue()')
  })

  test('the session proxy owns the ?view=attention redirect; no client copy', () => {
    // 2026-09-29: a mount-effect router.replace raced the page's mount-time
    // server actions (Next 16.2.1 action queue) and never landed — the one
    // redirect is server-side, and no client copy may come back.
    const proxySrc = read(path.join(ROOT, 'src', 'lib', 'supabase', 'middleware.ts'))
    expect(proxySrc).toContain("path === '/sops'")
    expect(proxySrc).toContain('officeRedirectFor(path, request.nextUrl.search)')
    expect(read(path.join(ROOT, 'src', 'lib', 'shell', 'place.ts'))).toContain("view === 'attention' ? '/?place=office'")
  })

  test('the governance inbox groups by chip; every flag from classify.ts is still represented', () => {
    // 2026-07-30/2026-09-29: per-flag filter chips replaced by the derived
    // inbox — INBOX_CHIPS covers the actionable subset (owner/overdue/approve),
    // and flag-display.ts still names every GovernanceFlag for GovernanceQueueRow.
    const inboxSrc = read(INBOX)
    expect(inboxSrc).toContain("{ key: 'owner', label: 'No owner' }")
    expect(inboxSrc).toContain("{ key: 'overdue', label: 'Overdue' }")
    expect(inboxSrc).toContain("{ key: 'approve', label: 'Approve' }")
    const flagSrc = read(FLAG_DISPLAY)
    for (const flag of ['overdue', 'due_soon', 'unowned', 'stale_role', 'awaiting_approval']) {
      expect(flagSrc).toContain(`${flag}:`)
    }
  })
})

// ---------------------------------------------------------------------------
// The focus screen — REV-03/D28-07 worker no-gate hard rule. 58-15: the tabbed
// read page and its "Current as of" caption are gone with no successor (the
// focus screen shows no currency caption), so the caption assertion is dropped;
// the no-gate half survives on every worker focus file.
// ---------------------------------------------------------------------------

test.describe('focus screen worker files — no review gate (D28-07)', () => {
  test('GATE_PATTERN self-check: matches a review_due_at comparison', () => {
    expect('if (sop.review_due_at < now)').toMatch(GATE_PATTERN)
  })

  for (const file of [...WORKER_FOCUS_FILES, WALK_HOOK, WALK_ACTIONS]) {
    const rel = path.relative(ROOT, file)
    test(`${rel} contains NO review_due_at/owner_user_id conditional/gate and no governance action import`, () => {
      const src = read(file)
      expect(src).not.toMatch(GATE_PATTERN)
      expect(src).not.toContain("from '@/actions/governance'")
    })
  }
})

// ---------------------------------------------------------------------------
// Worker routes — REV-02/D28-07 no-block hard rule
// ---------------------------------------------------------------------------

test.describe('Worker SOP detail route — no governance gate', () => {
  test('worker SOP detail route contains no review_due_at/owner_user_id gate', () => {
    const src = read(WORKER_SOP_DETAIL)
    expect(src).not.toMatch(GATE_PATTERN)
  })
})
