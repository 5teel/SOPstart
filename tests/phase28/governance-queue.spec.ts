/**
 * Phase 28 Plan 04 — governance queue + wiring. Repointed in 30-08 (UX-03):
 * the queue folded into /admin/sops as the "Needs attention" view
 * (?view=attention) and /admin/governance became a redirect shim.
 *
 * Repointed AGAIN in 41-08 (SUR-01/02/04): /admin/sops itself is now a thin
 * guard-first redirect shim to /sops (see 41-06). The queue read + rendering
 * moved to AdminAttentionLens.tsx (a next/dynamic({ssr:false}) lens fetched
 * by AdminSopSurface.tsx), and the real admin/safety_manager gate on the DATA
 * is listGovernanceQueue -> requireAdmin() in src/actions/governance.ts — the
 * shim's own redirect('/dashboard') is a second, shallower guard in front of
 * that, kept here so both layers stay pinned (CLAUDE.md 2026-07-13: a guard
 * pointing at an emptied file is a guard that stopped guarding).
 *
 * Verifies (source-contract, no live DB required):
 *   GQ-01: AdminAttentionLens calls listGovernanceQueue; the real data gate
 *     (requireAdmin() in governance.ts) guards admin/safety_manager; the
 *     shim (admin/sops/page.tsx) keeps its own front-door redirect; and
 *     AdminSopSurface.tsx resolves ?view=attention to the admin-attention
 *     scope.
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
const ATTENTION_LENS = path.join(ROOT, 'src', 'components', 'sop', 'lenses', 'AdminAttentionLens.tsx')
const GOVERNANCE_ACTIONS = path.join(ROOT, 'src', 'actions', 'governance.ts')
const ADMIN_SURFACE = path.join(ROOT, 'src', 'components', 'sop', 'AdminSopSurface.tsx')
const ROW = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
const CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const OWNER_PICKER = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'OwnerPicker.tsx')
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Needs-attention lens on /sops — GQ-01 (repointed 2026-09-13, Phase 41)
// ---------------------------------------------------------------------------

test.describe('needs-attention lens on /sops — queue read + role guard', () => {
  test('AdminAttentionLens calls listGovernanceQueue', () => {
    const src = read(ATTENTION_LENS)
    expect(src).toContain("import { listGovernanceQueue")
    expect(src).toContain('queryFn: listGovernanceQueue')
  })

  test('the shim keeps a front-door redirect for non-admins', () => {
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

  test('AdminSopSurface resolves ?view=attention to the admin-attention scope', () => {
    const src = read(ADMIN_SURFACE)
    expect(src).toContain("view === 'attention'")
    expect(src).toContain("scope: 'admin-attention'")
  })

  test('AdminAttentionLens renders the queue rows grouped by worst flag (chips deleted, sketch 004)', () => {
    const src = read(ATTENTION_LENS)
    expect(src).toContain('FLAG_PRIORITY.find(')
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

  test('redirects to the merged view on /sops, mapping legacy ?filter=X', () => {
    // Rule 1 (CLAUDE.md 2026-07-13): 41-06 retargeted this shim's destination
    // from /admin/sops?view=attention to /sops?view=attention when /admin/sops
    // itself became a shim — this assertion was stale against that change.
    expect(src).toContain('params.filter')
    expect(src).toContain("qp.set('filter', params.filter)") // 41-REVIEW WR-01: encoded via URLSearchParams, never interpolated
    expect(src).toContain("view: 'attention'")
    expect(src).toContain('redirect(`/sops?${qp.toString()}`)') // 41-REVIEW WR-01: destination built from URLSearchParams seeded with view=attention
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

test.describe('journeys.ts — shim + folded view mapped (pathways coverage)', () => {
  const src = read(JOURNEYS)

  test('contains a step with route: /admin/governance (the shim stays mapped)', () => {
    expect(src).toContain("route: '/admin/governance'")
  })

  test('maps the folded needs-attention view', () => {
    expect(src).toContain('view=attention')
  })
})
