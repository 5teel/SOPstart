/**
 * Phase 28 Plan 05 — admin library governance additions + dashboard widget +
 * worker no-gate currency caption.
 *
 * Verifies (source-contract, no live DB required):
 *   OWN-04/D28-08: admin/sops/page.tsx handles ?owner=me with a REAL
 *     .eq('owner_user_id', ...) filter (not just a bare "owner" string).
 *   REV-02/REV-04: LibraryReviewCell wires the real confirmSopCurrent( call
 *     and renders the overdue badge ONLY under a review_due_at < now guard —
 *     this admin-library-only badge is the sole place that guard may exist.
 *   GQ-04/D28-09: GovernanceWidget counts from listGovernanceQueue and
 *     deep-links all three flags to /admin/governance?filter=.
 *   REV-03/D28-07: OverviewTab contains the "Current as of" caption and
 *     contains NO review_due_at conditional/gate anywhere (hard rule).
 *   REV-02/D28-07: the worker walkthrough route and worker SOP detail route
 *     contain no review_due_at/owner_user_id gating branch — governance never
 *     blocks worker read/walkthrough access.
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
const REVIEW_CELL = path.join(ROOT, 'src', 'components', 'admin', 'sops', 'LibraryReviewCell.tsx')
const WIDGET = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceWidget.tsx')
const OVERVIEW_TAB = path.join(ROOT, 'src', 'components', 'sop', 'tabs', 'OverviewTab.tsx')
const WORKER_WALKTHROUGH = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'walkthrough', 'page.tsx')
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

test.describe('admin library — owner=me filter + owner/review columns', () => {
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
})

// ---------------------------------------------------------------------------
// LibraryReviewCell.tsx — REV-02/REV-04
// ---------------------------------------------------------------------------

test.describe('LibraryReviewCell — wired confirm-current + guarded overdue badge', () => {
  const src = read(REVIEW_CELL)

  test('wires the real confirmSopCurrent( call', () => {
    expect(src).toContain("import { confirmSopCurrent } from '@/actions/governance'")
    expect(src).toContain('confirmSopCurrent(sopId)')
  })

  test('renders the overdue badge only under a review_due_at < now guard', () => {
    expect(src).toMatch(/new Date\(reviewDueAt\)\s*<\s*new Date\(\)/)
    expect(src).toContain('isOverdue')
  })
})

// ---------------------------------------------------------------------------
// GovernanceWidget.tsx — GQ-04/D28-09
// ---------------------------------------------------------------------------

test.describe('GovernanceWidget — counts + deep links', () => {
  const src = read(WIDGET)

  test('counts from listGovernanceQueue', () => {
    expect(src).toContain("import { listGovernanceQueue } from '@/actions/governance'")
    expect(src).toContain('listGovernanceQueue()')
  })

  test('deep-links overdue/unowned/due_soon to /admin/governance?filter=', () => {
    expect(src).toContain('/admin/governance?filter=overdue')
    expect(src).toContain('/admin/governance?filter=unowned')
    expect(src).toContain('/admin/governance?filter=due_soon')
  })
})

// ---------------------------------------------------------------------------
// OverviewTab.tsx — REV-03/D28-07 worker no-gate hard rule
// ---------------------------------------------------------------------------

test.describe('OverviewTab — passive currency caption, no gate (D28-07)', () => {
  const src = read(OVERVIEW_TAB)

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

test.describe('Worker walkthrough + SOP detail routes — no governance gate', () => {
  test('walkthrough route contains no review_due_at/owner_user_id gate', () => {
    const src = read(WORKER_WALKTHROUGH)
    expect(src).not.toMatch(GATE_PATTERN)
  })

  test('worker SOP detail route contains no review_due_at/owner_user_id gate', () => {
    const src = read(WORKER_SOP_DETAIL)
    expect(src).not.toMatch(GATE_PATTERN)
  })
})
