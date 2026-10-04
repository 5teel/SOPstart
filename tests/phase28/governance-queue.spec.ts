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
 * redirect to the site root is a second, shallower guard in front of that, kept
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
 *   GQ-04: legacy /admin/governance is now a next.config.ts redirect (Phase
 *     43, D-01) straight to /governance — the inbox has no flag-filter param,
 *     so a legacy ?filter=X bookmark lands on the whole inbox.
 *   Pathways coverage: journeys.ts maps route: '/governance' and no longer
 *     maps the deleted /admin/governance page.
 *
 * Registration: playwright.config.ts `phase28` project
 *   testDir: '.', testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase28`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
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
    expect(src).toContain("import { loadInbox } from '@/lib/governance/load-inbox'")
    expect(src).toContain('const ctx = await requireAdminContext()')
    expect(src).toContain("if ('error' in ctx) redirect('/')")
    expect(src).toContain('await loadInbox(')
    // the queue read itself lives in loadInbox (Phase 57 D-16)
    expect(read(path.join(ROOT, 'src', 'lib', 'governance', 'load-inbox.ts'))).toContain('listGovernanceQueue()')
  })

  test('legacy /admin/sops is a next.config.ts redirect to /sops (Phase 43 D-01)', () => {
    const src = read(NEXT_CONFIG)
    expect(src).toContain("source: '/admin/sops',")
    expect(src).toContain("destination: '/sops',")
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
// legacy /admin/governance — next.config.ts redirect (Phase 43 D-01)
// ---------------------------------------------------------------------------

test.describe('legacy /admin/governance — next.config.ts redirect (Phase 43 D-01)', () => {
  test('redirects to /governance, which guards itself (asserted in the first describe above)', () => {
    const src = read(NEXT_CONFIG)
    expect(src).toContain("source: '/admin/governance',")
    expect(src).toContain("destination: '/governance',")
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

test.describe('journeys.ts — governance inbox mapped, deleted shim is not (pathways coverage)', () => {
  const src = read(JOURNEYS)

  test('maps no step to the deleted /admin/governance page', () => {
    expect(src).not.toContain("route: '/admin/governance'")
  })

  test('maps the governance inbox route', () => {
    expect(src).toContain("route: '/governance'")
  })
})
