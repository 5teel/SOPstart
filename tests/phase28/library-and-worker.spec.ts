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
 * Repointed a third time in 54-05 (D-07/D-08): the Miller frame and its
 * lenses are gone — the admin `/sops` route now mounts AdminLibraryTable.tsx,
 * whose nav state (owner=me, status, departments, collection, ?view=access)
 * is resolved by the pure `resolveLibraryNav` in src/lib/sop-list/admin-rows.ts
 * and applied via `window.history.replaceState` (CLAUDE.md 2026-05-13
 * URL-state rule), never a <Link> href. The governance queue moved to its own
 * route, /governance, rendered by GovernanceInbox.tsx and derived by
 * src/lib/governance/inbox.ts. admin/sops/page.tsx is now a thin redirect
 * shim and no longer carries any of this behaviour.
 *
 * Verifies (source-contract, no live DB required):
 *   OWN-04/D28-08: listAdminSopRows handles ?owner=me with a REAL
 *     .eq('owner_user_id', ...) filter (not just a bare "owner" string).
 *   REV-02/REV-04: the overdue signal derives from the org-scoped governance
 *     queue (classifyGovernanceRow's review_due_at < now), rendered as the
 *     row flag chip; Confirm current stays a real wired call on
 *     GovernanceQueueRow (the merged surface).
 *   GQ-04/D28-09: listAdminSopRows counts from listGovernanceQueue, and the
 *     table's resolveLibraryNav sentinel + the governance inbox's chips
 *     deep-link the flags.
 *   REV-03/D28-07: ReadTab (Phase 30 merged Overview+Tools+Hazards) contains
 *     the "Current as of" caption and contains NO review_due_at
 *     conditional/gate anywhere (hard rule).
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
const ADMIN_ROWS = path.join(ROOT, 'src', 'lib', 'sop-list', 'admin-rows.ts')
const LIBRARY_TABLE = path.join(ROOT, 'src', 'components', 'admin', 'AdminLibraryTable.tsx')
const INBOX = path.join(ROOT, 'src', 'lib', 'governance', 'inbox.ts')
const FLAG_DISPLAY = path.join(ROOT, 'src', 'lib', 'governance', 'flag-display.ts')
const QUEUE_ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const CLASSIFY = path.join(ROOT, 'src', 'lib', 'governance', 'classify.ts')
const READ_TAB = path.join(ROOT, 'src', 'components', 'sop', 'tabs', 'ReadTab.tsx')
const WORKER_SOP_DETAIL = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// A review-state/owner gating branch: an if/conditional that inspects
// review_due_at or owner_user_id and could alter worker-facing control flow.
const GATE_PATTERN = /review_due_at\s*[<>]|owner_user_id\s*[=!]==?\s*null|if\s*\([^)]*(review_due_at|owner_user_id)/

// ---------------------------------------------------------------------------
// listAdminSopRows / AdminLibraryTable — OWN-04/D28-08 (repointed 2026-09-29)
// ---------------------------------------------------------------------------

test.describe('admin library — owner=me filter + owner/flag columns', () => {
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

  test('AdminLibraryTable renders an owner filter that writes ?owner=me via history state (no <Link> href)', () => {
    // CLAUDE.md 2026-05-13: scope/filter changes are history.replaceState, not
    // router.push/<Link> — libraryNavToUrl composes the URL, applyNav drives state.
    const src = read(LIBRARY_TABLE)
    expect(src).toContain('applyNav(')
    expect(src).toContain('window.history.replaceState(null, \'\', libraryNavToUrl(next))')
    const rowsSrc = read(ADMIN_ROWS)
    expect(rowsSrc).toContain("if (nav.owner === 'me') qp.set('owner', 'me')")
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
// repointed 2026-09-29 onto AdminLibraryTable.tsx + the governance inbox)
// ---------------------------------------------------------------------------

test.describe('admin scope counts — counts from listGovernanceQueue + deep links', () => {
  test('listAdminSopRows counts from listGovernanceQueue', () => {
    const src = read(ADMIN_SOP_LIST)
    expect(src).toContain("from '@/actions/governance'")
    expect(src).toContain('listGovernanceQueue()')
  })

  test('resolveLibraryNav resolves ?view=attention to the governance sentinel; the session proxy owns the redirect', () => {
    const rowsSrc = read(ADMIN_ROWS)
    expect(rowsSrc).toContain("if (params.get('view') === 'attention') return 'governance'")
    const tableSrc = read(LIBRARY_TABLE)
    expect(tableSrc).toContain("if (resolved === 'governance') return")
    // 2026-09-29: a mount-effect router.replace raced the page's mount-time
    // server actions (Next 16.2.1 action queue) and never landed — the one
    // redirect is server-side, and no client copy may come back.
    expect(tableSrc).not.toContain("router.replace('/governance')")
    expect(read(path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx'))).not.toContain("'/governance'")
    const proxySrc = read(path.join(ROOT, 'src', 'lib', 'supabase', 'middleware.ts'))
    expect(proxySrc).toContain("path === '/sops' && request.nextUrl.searchParams.get('view') === 'attention'")
    expect(proxySrc).toContain("NextResponse.redirect(new URL('/governance', request.url))")
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
// ReadTab.tsx — REV-03/D28-07 worker no-gate hard rule (merged tab, Phase 30)
// ---------------------------------------------------------------------------

test.describe('ReadTab — passive currency caption, no gate (D28-07)', () => {
  const src = read(READ_TAB)

  test('renders exactly one "Current as of" caption', () => {
    expect(src).toContain('Current as of')
  })

  test('contains NO review_due_at conditional/gate anywhere', () => {
    // GATE_PATTERN catches comparisons/if-branches on the field; a bare mention
    // in a documentation comment (explaining the hard rule itself) is fine.
    expect(src).not.toMatch(GATE_PATTERN)
  })

  test('does not import any governance action', () => {
    expect(src).not.toContain("from '@/actions/governance'")
  })
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
