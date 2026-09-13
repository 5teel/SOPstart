/**
 * Phase 41 Plan 04 — source-contract spec for `AdminStatusLens`
 * (src/components/sop/lenses/AdminStatusLens.tsx) and `AdminAttentionLens`
 * (src/components/sop/lenses/AdminAttentionLens.tsx).
 *
 * Pins: each lens's single-action data fetch, the callback-only exit
 * contracts (onClearFilter / onBack — no router.push, no <Link, no href=),
 * the worst-flag-per-row grouping via FLAG_PRIORITY.find(, and the SUR-04
 * single-builder-chain rule across the merged surface's client files.
 *
 * Also duplicates the APR-03/04 approval-gating assertions from
 * tests/phase29/queue-approve-action.spec.ts onto GovernanceQueueRow — that
 * file is being repointed in 41-08, so the safety-critical assertion must
 * not go unguarded while the move is in flight (CLAUDE.md 2026-07-13 stale
 * source-contract guard learning).
 *
 * All assertions run against COMMENT-STRIPPED source so the files' own
 * explanatory comments (which quote these same tokens) cannot satisfy an
 * assertion about the code. Normalises \r\n to \n per CLAUDE.md 2026-07-18.
 *
 * Registration: playwright.config.ts `phase41` project
 *   testDir: '.', testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase41 -g "lens"`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STATUS_LENS = path.join(ROOT, 'src', 'components', 'sop', 'lenses', 'AdminStatusLens.tsx')
const ATTENTION_LENS = path.join(ROOT, 'src', 'components', 'sop', 'lenses', 'AdminAttentionLens.tsx')
const QUEUE_ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const MILLER_BROWSER = path.join(ROOT, 'src', 'components', 'admin', 'SopMillerBrowser.tsx')
const WORKER_BROWSER = path.join(ROOT, 'src', 'components', 'sop', 'SopWorkerBrowser.tsx')
const SOPS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')
const LENSES_DIR = path.join(ROOT, 'src', 'components', 'sop', 'lenses')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

/** Strips // line comments and /* block comments *[/] so assertions can't be
 * satisfied by a comment merely quoting the token being checked. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('AdminStatusLens — client wrapper', () => {
  test("opens with 'use client'", () => {
    const raw = read(STATUS_LENS)
    expect(raw.trimStart().startsWith("'use client'")).toBe(true)
  })

  test('calls listAdminSopRows inside a useQuery and renders SopMillerBrowser', () => {
    const code = stripComments(read(STATUS_LENS))
    expect(code).toContain('useQuery(')
    expect(code).toContain('listAdminSopRows(')
    expect(code).toContain('SopMillerBrowser')
  })

  test('contains the "Open in library" filtered banner', () => {
    const code = stripComments(read(STATUS_LENS))
    expect(code).toContain('Open in library')
  })

  test('onClearFilter is a button handler, not a link — no href=, no <Link, no router.push', () => {
    const code = stripComments(read(STATUS_LENS))
    expect(code).toContain('onClearFilter')
    expect(code).toMatch(/onClick=\{onClearFilter\}/)
    expect(code).not.toContain('href=')
    expect(code).not.toContain('<Link')
    expect(code).not.toContain('router.push')
  })

  test('contains zero references to the builder route — the row/detail links stay inside SopMillerBrowser', () => {
    const code = stripComments(read(STATUS_LENS))
    expect(code).not.toContain('admin/sops/builder')
  })

  test('onResult is invoked inside a useEffect, not during render', () => {
    const code = stripComments(read(STATUS_LENS))
    const effectIndex = code.indexOf('useEffect(')
    const callIndex = code.indexOf('onResult?.(')
    expect(effectIndex).toBeGreaterThan(-1)
    expect(callIndex).toBeGreaterThan(-1)
    const between = code.slice(effectIndex, callIndex)
    expect(between.split('\n').length).toBeLessThanOrEqual(6)
  })

  test('renders loading, error and success branches', () => {
    const code = stripComments(read(STATUS_LENS))
    expect(code).toContain('isLoading')
    expect(code).toMatch(/'error'\s*in\s*data/)
    expect(code).toContain('{data.error}')
  })
})

test.describe('AdminAttentionLens — client wrapper', () => {
  test("opens with 'use client'", () => {
    const raw = read(ATTENTION_LENS)
    expect(raw.trimStart().startsWith("'use client'")).toBe(true)
  })

  test('calls listGovernanceQueue inside a useQuery and renders GovernanceQueueRow', () => {
    const code = stripComments(read(ATTENTION_LENS))
    expect(code).toContain('useQuery(')
    expect(code).toContain('listGovernanceQueue')
    expect(code).toContain('GovernanceQueueRow')
  })

  test('imports FLAG_PRIORITY / FLAG_STYLE / FLAG_LABEL / FLAG_DESC from @/lib/governance/flag-display', () => {
    const code = stripComments(read(ATTENTION_LENS))
    expect(code).toMatch(/import\s*\{\s*FLAG_PRIORITY,\s*FLAG_STYLE,\s*FLAG_LABEL,\s*FLAG_DESC\s*\}\s*from\s*'@\/lib\/governance\/flag-display'/)
  })

  test('derives one worst flag per row via FLAG_PRIORITY.find(', () => {
    const code = stripComments(read(ATTENTION_LENS))
    expect(code).toContain('FLAG_PRIORITY.find(')
  })

  test('groups are built in FLAG_PRIORITY order with empty groups filtered out', () => {
    const code = stripComments(read(ATTENTION_LENS))
    expect(code).toMatch(/FLAG_PRIORITY\s*\n?\s*\.map\(/)
    expect(code).toContain('.filter((g) => g.rows.length > 0)')
  })

  test('contains the CLEAR-panel copy', () => {
    const code = stripComments(read(ATTENTION_LENS))
    expect(code).toContain('Nothing needs attention')
    expect(code).toContain('Every SOP is owned, current, and correctly assigned.')
  })

  test('exit is a callback (onBack) — no router.push, no <Link, no href=', () => {
    const code = stripComments(read(ATTENTION_LENS))
    expect(code).toContain('onBack')
    expect(code).not.toContain('router.push')
    expect(code).not.toContain('<Link')
    expect(code).not.toContain('href=')
  })
})

// ---------------------------------------------------------------------------
// Preservation assertions (T-41-06 / APR-03/04 hard constraint) — duplicated
// from tests/phase29/queue-approve-action.spec.ts deliberately, since that
// file is repointed in 41-08 and the approval-gating contract must never be
// unguarded during the move.
// ---------------------------------------------------------------------------
test.describe('GovernanceQueueRow — approval gating preserved (APR-03/04 duplicate guard)', () => {
  test('imports approveStep from @/actions/approvals', () => {
    const src = stripComments(read(QUEUE_ROW))
    expect(src).toContain("import { approveStep } from '@/actions/approvals'")
  })

  test('Approve branch is gated on awaiting_approval && isCallerNextApprover', () => {
    const src = stripComments(read(QUEUE_ROW))
    expect(src).toContain("row.flags.includes('awaiting_approval') && row.isCallerNextApprover")
  })

  test('Approve onClick is wired to handleApprove', () => {
    const src = stripComments(read(QUEUE_ROW))
    const branchMatch = src.match(/row\.isCallerNextApprover \? \(([\s\S]*?)\) : row\.flags\.includes\('unowned'\)/)
    expect(branchMatch).not.toBeNull()
    expect(branchMatch![1]).toContain('onClick={handleApprove}')
  })
})

// ---------------------------------------------------------------------------
// SUR-04 — exactly one direct list→builder link across the merged client
// surface, and it lives in SopMillerBrowser.
// ---------------------------------------------------------------------------
test.describe('SUR-04 — single list→builder chain', () => {
  test('SopMillerBrowser still contains the builder link', () => {
    const src = stripComments(read(MILLER_BROWSER))
    expect(src).toContain('admin/sops/builder')
  })

  test('no other lens, SopWorkerBrowser, or sops/page.tsx contains a builder href', () => {
    const lensFiles = fs
      .readdirSync(LENSES_DIR)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => path.join(LENSES_DIR, f))

    const candidates = [...lensFiles, WORKER_BROWSER, SOPS_PAGE]
    let violations = 0
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue
      const src = stripComments(read(file))
      if (src.includes('admin/sops/builder')) violations++
    }
    expect(violations).toBe(0)
  })
})
