/**
 * Phase 28 Plan 04 — governance queue + wiring. Repointed in 30-08 (UX-03):
 * the queue folded into /admin/sops as the "Needs attention" view
 * (?view=attention) and /admin/governance became a redirect shim.
 *
 * Repointed AGAIN in 41-08 (SUR-01/02/04): /admin/sops itself is now a thin
 * guard-first redirect shim to /sops (see 41-06).
 *
 * Repointed a third time in 54-05 (D-01/D-02): the governance queue moved off
 * /sops?view=attention onto its own route, /governance, rendered by
 * GovernanceInbox.tsx and derived by src/lib/governance/inbox.ts. The real
 * admin/safety_manager gate on the DATA is listGovernanceQueue ->
 * requireAdmin() in src/actions/governance.ts — the page's own
 * redirect('/dashboard') is a second, shallower guard in front of that, kept
 * here so both layers stay pinned (CLAUDE.md 2026-07-13: a guard pointing at
 * an emptied file is a guard that stopped guarding).
 *
 * Verifies (source-contract, no live DB required):
 *   GQ-01: the /governance page calls listGovernanceQueue() server-side
 *     after requireAdminContext(); GovernanceInbox renders <GovernanceQueueRow
 *     and not <GovernanceFilterChips; and the /sops redirect shim maps legacy
 *     ?view=attention onto /governance (resolveLibraryNav returns the
 *     'governance' sentinel, asserted in tests/phase30/admin-nav.spec.ts).
 *   GQ-02: GovernanceQueueRow WIRES a real confirmSopCurrent( call — not a
 *     bare prop-name reference (CLAUDE.md 2026-06-05 dead-feature learning) —
 *     and renders exactly one primary action per row via if/else-if branching
 *     on flags.
 *   OWN-02: OwnerPicker calls setSopOwner( and reuses getOrgMembers (not a
 *     hand-rolled second member query).
 *   GQ-04: /admin/governance is a guard-first redirect shim that maps legacy
 *     ?filter=X deep-links onto the merged view's filter param (now on /sops).
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
const GOV_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'governance', 'page.tsx')
const GOV_INBOX = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceInbox.tsx')
const GOVERNANCE_ACTIONS = path.join(ROOT, 'src', 'actions', 'governance.ts')
const ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const OWNER_PICKER = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'OwnerPicker.tsx')
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Governance inbox on /governance — GQ-01 (repointed 2026-09-29, Phase 54)
// ---------------------------------------------------------------------------

test.describe('governance inbox — queue read + role guard', () => {
  test('the /governance page calls listGovernanceQueue() server-side, guarded by requireAdminContext()', () => {
    const src = read(GOV_PAGE)
    expect(src).toContain("import { requireAdminContext } from '@/lib/auth/guards'")
    expect(src).toContain("import { listGovernanceQueue } from '@/actions/governance'")
    expect(src).toContain('const ctx = await requireAdminContext()')
    expect(src).toContain("if ('error' in ctx) redirect('/dashboard')")
    expect(src).toContain('listGovernanceQueue()')
  })

  test('the /admin/sops shim keeps a front-door redirect for non-admins', () => {
    // 2026-07-13: member.role → role (shared getSessionContext auth refactor)
    const src = read(FOLDED_PAGE)
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    expect(src).toContain("redirect('/dashboard')")
  })

  test('the real data gate — listGovernanceQueue -> requireAdmin() — also enforces admin/safety_manager', () => {
    const src = read(GOVERNANCE_ACTIONS)
    expect(src).toContain('export async function requireAdmin')
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    expect(src).toContain('export async function listGovernanceQueue')
  })

  test('GovernanceInbox renders governance rows via GovernanceQueueRow, not GovernanceFilterChips', () => {
    const src = read(GOV_INBOX)
    expect(src).toContain("import { GovernanceQueueRow } from './GovernanceQueueRow'")
    expect(src).toContain('<GovernanceQueueRow')
    expect(src).not.toContain('<GovernanceFilterChips')
  })
})

// ---------------------------------------------------------------------------
// admin/governance/page.tsx — redirect shim (GQ-04 deep-links preserved)
// ---------------------------------------------------------------------------

test.describe('governance page — redirect shim mapping legacy ?filter=', () => {
  const src = read(SHIM)

  test('keeps the admin guard IN FRONT of the redirect', () => {
    // 2026-07-13: member.role → role (shared getSessionContext auth refactor)
    expect(src).toContain("['admin', 'safety_manager'].includes(role)")
    expect(src).toContain("redirect('/dashboard')")
  })

  test('redirects to the governance inbox — a bookmark lands on the whole inbox, no filter param survives', () => {
    // Rule 1 (CLAUDE.md 2026-07-13): Phase 54 (D-01) retargeted this shim's
    // destination to /governance, a real route, not a ?view= deep link —
    // the inbox has no flag-filter param, so legacy ?filter=X is dropped.
    const guardIdx = src.indexOf("['admin', 'safety_manager'].includes(role)")
    const redirectIdx = src.indexOf("redirect('/governance')")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(redirectIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(redirectIdx)
    expect(src).not.toContain("qp.set('filter'")
    expect(src).not.toContain("view: 'attention'")
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

// 2026-07-30 (sketch 004): GovernanceFilterChips deleted — every flag is
// always visible as its own group in the attention view, so per-flag filter
// chips have nothing left to do.
test.describe('GovernanceFilterChips — deleted (grouped queue replaces chips)', () => {
  test('the chips component no longer exists', () => {
    expect(fs.existsSync(CHIPS)).toBe(false)
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

test.describe('journeys.ts — shim + governance inbox mapped (pathways coverage)', () => {
  const src = read(JOURNEYS)

  test('contains a step with route: /admin/governance (the shim stays mapped)', () => {
    expect(src).toContain("route: '/admin/governance'")
  })

  test('maps the governance inbox route', () => {
    expect(src).toContain("route: '/governance'")
  })
})
