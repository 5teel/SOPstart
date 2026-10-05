/**
 * Phase 28 Plan 04 -- governance queue guards that SURVIVE the Office (Phase 59).
 *
 * The governance page, inbox wrapper and queue row were deleted in 59-14; their
 * wiring is asserted for the Office rows in tests/phase59/office-pane-structure.
 * What stays here:
 *   - the real data gate: listGovernanceQueue -> requireAdmin() admits only
 *     admin / safety_manager (src/actions/governance.ts)
 *   - OWN-02: OwnerPicker reuses getOrgMembers and wires setSopOwner
 *   - the next.config.ts redirects for the legacy /admin/sops and
 *     /admin/governance addresses
 *   - journeys.ts names no deleted governance route
 *
 * Registration: playwright.config.ts `phase28` project
 * Verify: `npx playwright test --list --project=phase28`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
const GOVERNANCE_ACTIONS = path.join(ROOT, 'src', 'actions', 'governance.ts')
const CHIPS = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceFilterChips.tsx')
const OWNER_PICKER = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'OwnerPicker.tsx')
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Governance inbox on /governance — GQ-01 (repointed 2026-09-29, Phase 54)
// ---------------------------------------------------------------------------

test.describe('governance queue — role guard', () => {
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
})

// ---------------------------------------------------------------------------
// legacy /admin/governance — next.config.ts redirect (Phase 43 D-01)
// ---------------------------------------------------------------------------

test.describe('legacy /admin/governance — next.config.ts redirect (Phase 43 D-01)', () => {
  test('still redirects to /governance, which the proxy sends on into the Office (59-13)', () => {
    const src = read(NEXT_CONFIG)
    expect(src).toContain("source: '/admin/governance',")
    expect(src).toContain("destination: '/governance',")
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

test.describe('journeys.ts — no deleted governance route (pathways coverage)', () => {
  const src = read(JOURNEYS)

  test('maps no step to the deleted /admin/governance page', () => {
    expect(src).not.toContain("route: '/admin/governance'")
  })

  test('maps the Office inbox in place of the governance route (Phase 59)', () => {
    expect(src).not.toContain("route: '/governance'")
  })
})
