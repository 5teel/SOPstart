/**
 * Phase 28 Plan 04 — governance queue + wiring. Repointed in 30-08 (UX-03):
 * the queue folded into /admin/sops as the "Needs attention" view
 * (?view=attention) and /admin/governance became a redirect shim.
 *
 * Verifies (source-contract, no live DB required):
 *   GQ-01: the folded /admin/sops view calls listGovernanceQueue, guards the
 *     admin/safety_manager role, and the filter chips link all 5 filter
 *     values (including stale_role — GQ-03) onto ?view=attention.
 *   GQ-02: GovernanceQueueRow WIRES a real confirmSopCurrent( call — not a
 *     bare prop-name reference (CLAUDE.md 2026-06-05 dead-feature learning) —
 *     and renders exactly one primary action per row via if/else-if branching
 *     on flags.
 *   OWN-02: OwnerPicker calls setSopOwner( and reuses getOrgMembers (not a
 *     hand-rolled second member query).
 *   GQ-04: /admin/governance is a guard-first redirect shim that maps legacy
 *     ?filter=X deep-links onto the folded view's filter param.
 *   Pathways coverage: journeys.ts still maps route: '/admin/governance'
 *     (the shim) AND the folded view.
 *
 * Registration: playwright.config.ts `phase28` project
 *   testDir: '.', testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase28`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SHIM = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx')
const FOLDED_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx')
const ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const OWNER_PICKER = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'OwnerPicker.tsx')
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// admin/sops/page.tsx (folded view) — GQ-01
// ---------------------------------------------------------------------------

test.describe('folded governance view on /admin/sops — queue read + role guard', () => {
  const src = read(FOLDED_PAGE)

  test('calls listGovernanceQueue', () => {
    expect(src).toContain('listGovernanceQueue(')
  })

  test('guards admin/safety_manager role and redirects otherwise', () => {
    // 2026-07-13: member.role → role (shared getSessionContext auth refactor)
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    expect(src).toContain("redirect('/dashboard')")
  })

  test('reads the ?filter= searchParam behind ?view=attention', () => {
    expect(src).toContain('params.filter')
    expect(src).toContain("params.view === 'attention'")
  })

  test('renders the queue rows and filter chips (moved verbatim, not reimplemented)', () => {
    expect(src).toContain('<GovernanceQueueRow')
    expect(src).toContain('<GovernanceFilterChips')
  })
})

// ---------------------------------------------------------------------------
// admin/governance/page.tsx — redirect shim (GQ-04 deep-links preserved)
// ---------------------------------------------------------------------------

test.describe('governance page — redirect shim mapping legacy ?filter=', () => {
  const src = read(SHIM)

  test('keeps the admin guard IN FRONT of the redirect', () => {
    expect(src).toContain("['admin', 'safety_manager'].includes(member.role)")
    expect(src).toContain("redirect('/dashboard')")
  })

  test('redirects to the folded view, mapping legacy ?filter=X', () => {
    expect(src).toContain('params.filter')
    expect(src).toContain('view=attention&filter=${filter}')
    expect(src).toContain("'/admin/sops?view=attention'")
  })

  test('no longer renders any governance surface itself', () => {
    expect(src).not.toContain('GovernanceQueueRow')
    expect(src).not.toContain('GovernanceFilterChips')
    expect(src).not.toContain('ApprovalChainEditor')
  })
})

// ---------------------------------------------------------------------------
// GovernanceQueueRow.tsx — GQ-02
// ---------------------------------------------------------------------------

test.describe('GovernanceQueueRow — one wired primary action per row', () => {
  const src = read(ROW)

  test('wires the real confirmSopCurrent( call, not a bare prop reference', () => {
    expect(src).toContain("import { confirmSopCurrent } from '@/actions/governance'")
    expect(src).toContain('confirmSopCurrent(row.id)')
  })

  test('renders exactly one primary action, chosen by flag priority (unowned > stale_role > confirm)', () => {
    expect(src).toMatch(/row\.flags\.includes\('unowned'\)/)
    expect(src).toMatch(/row\.flags\.includes\('stale_role'\)/)
    expect(src).toContain('<OwnerPicker')
    expect(src).toContain(`href={\`/admin/sops/\${row.id}/assign\`}`)
  })
})

// ---------------------------------------------------------------------------
// GovernanceFilterChips.tsx — GQ-01/GQ-03
// ---------------------------------------------------------------------------

test.describe('GovernanceFilterChips — all 5 chips link the folded view', () => {
  const src = read(CHIPS)

  test('includes all five filter values', () => {
    for (const value of ['all', 'overdue', 'due_soon', 'unowned', 'stale_role']) {
      expect(src).toContain(`value: '${value}'`)
    }
  })

  test('links to /admin/sops?view=attention&filter=<value> (stale_role included, GQ-03)', () => {
    expect(src).toContain('/admin/sops?view=attention&filter=${chip.value}')
    expect(src).toContain("'/admin/sops?view=attention'")
  })
})

// ---------------------------------------------------------------------------
// OwnerPicker.tsx — OWN-02
// ---------------------------------------------------------------------------

test.describe('OwnerPicker — reuses getOrgMembers, wires setSopOwner', () => {
  const src = read(OWNER_PICKER)

  test('reuses getOrgMembers rather than hand-rolling a second member query', () => {
    expect(src).toContain("import { getOrgMembers, type OrgMemberWithProfile } from '@/actions/assignments'")
    expect(src).toContain('getOrgMembers()')
  })

  test('wires the real setSopOwner( call on member pick', () => {
    expect(src).toContain("import { setSopOwner } from '@/actions/governance'")
    expect(src).toContain('setSopOwner(sopId, userId)')
  })

  test('surfaces the { error } result inline rather than swallowing it', () => {
    expect(src).toMatch(/if \('error' in result\)/)
    expect(src).toContain('setError(result.error)')
  })
})

// ---------------------------------------------------------------------------
// journeys.ts — pathways coverage
// ---------------------------------------------------------------------------

test.describe('journeys.ts — shim + folded view mapped (pathways coverage)', () => {
  const src = read(JOURNEYS)

  test('contains a step with route: /admin/governance (the shim stays mapped)', () => {
    expect(src).toContain("route: '/admin/governance'")
  })

  test('maps the folded needs-attention view', () => {
    expect(src).toContain('view=attention')
  })
})
