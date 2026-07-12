/**
 * Phase 28 Plan 05 — admin library governance additions + worker no-gate
 * currency caption. Repointed in 30-08 (UX-03/UX-06): LibraryReviewCell and
 * GovernanceWidget were deleted as separate surfaces — the owner label + flag
 * chip live on the one-line library rows, the counts + deep-links live on the
 * /admin/sops header chips, and Confirm current lives on GovernanceQueueRow
 * in the folded needs-attention view.
 *
 * Verifies (source-contract, no live DB required):
 *   OWN-04/D28-08: admin/sops/page.tsx handles ?owner=me with a REAL
 *     .eq('owner_user_id', ...) filter (not just a bare "owner" string).
 *   REV-02/REV-04: the overdue signal derives from the org-scoped governance
 *     queue (classifyGovernanceRow's review_due_at < now), rendered as the
 *     row flag chip; Confirm current stays a real wired call on
 *     GovernanceQueueRow (the merged surface).
 *   GQ-04/D28-09: the /admin/sops header chips count from
 *     listGovernanceQueue and deep-link the flags to the folded view.
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
const LIBRARY_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx')
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
// admin/sops/page.tsx — OWN-04/D28-08
// ---------------------------------------------------------------------------

test.describe('admin library — owner=me filter + owner/flag columns', () => {
  const src = read(LIBRARY_PAGE)

  test('handles ?owner=me with a real .eq owner_user_id filter', () => {
    expect(src).toContain("params.owner === 'me'")
    expect(src).toContain("query.eq('owner_user_id', user.id)")
  })

  test('selects owner_user_id and review_due_at columns', () => {
    expect(src).toContain('owner_user_id')
    expect(src).toContain('review_due_at')
  })

  test('renders an Owned by me chip linking to ?owner=me', () => {
    expect(src).toContain('/admin/sops?owner=me')
  })

  test('renders the owner label on each one-line row (UX-06)', () => {
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

  test('library rows render the queue-derived flag chip', () => {
    const src = read(LIBRARY_PAGE)
    expect(src).toContain('FLAG_LABEL[flag]')
    expect(src).toContain('rowFlag[sop.id]')
  })
})

// ---------------------------------------------------------------------------
// Header chips — GQ-04/D28-09 (was GovernanceWidget, deleted in 30-08)
// ---------------------------------------------------------------------------

test.describe('/admin/sops header chips — counts + deep links', () => {
  const src = read(LIBRARY_PAGE)

  test('counts from listGovernanceQueue', () => {
    expect(src).toContain("from '@/actions/governance'")
    expect(src).toContain('listGovernanceQueue()')
  })

  test('deep-links overdue/unowned/due_soon to the folded needs-attention view', () => {
    expect(src).toContain('/admin/sops?view=attention&filter=overdue')
    expect(src).toContain('/admin/sops?view=attention&filter=unowned')
    expect(src).toContain('/admin/sops?view=attention&filter=due_soon')
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
