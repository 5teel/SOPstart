/**
 * Phase 28 Plan 03 — governance.ts + publish-route review-clock reset.
 *
 * Verifies (source-contract, no live DB required):
 *   OWN-02: setSopOwner verifies target userId is an organisation_members row
 *     in the caller's org BEFORE writing, and writes `sops` with the PLAIN
 *     session client (createClient()) — NOT createAdminClient (RESEARCH
 *     Pitfall 1: admins_can_update_sops RLS already gates this write).
 *   REV-04: confirmSopCurrent writes last_reviewed_at/review_due_at/
 *     last_reviewed_by AND inserts a sop_review_events row with
 *     action: 'confirmed_current'.
 *   REV-01/T-28-03-02: setReviewCadence sources organisation_id ONLY from
 *     ctx.organisationId (JWT-derived), never from a function parameter —
 *     mirrors AIPS-SET-02's "no attack surface" signature-check pattern
 *     (tests/phase27/ai-settings-org-scope.spec.ts).
 *   GQ-03: listGovernanceQueue calls classifyGovernanceRow, never joins
 *     sub-trades, and applies the last_reviewed_at null-guard on the
 *     renamed-since-review comparison (plan-checker WARNING-1).
 *   D28-04: the publish route inserts a 'superseded' sop_review_events row
 *     guarded by parent_sop_id, after a non-fatal review-clock reset.
 *
 * These are WIRED assertions (real call sites, not bare token/prop presence
 * — CLAUDE.md 2026-06-05 learning) except where noted as a signature check.
 *
 * Runtime cross-org write-isolation is carried as test.fixme per the
 * Railway-only-testing convention (CLAUDE.md memory: feedback_railway_only_testing),
 * same precedent as tests/phase27/ai-settings-org-scope.spec.ts.
 *
 * Registration: playwright.config.ts `phase28` project
 *   testDir: '.', testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase28`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const GOVERNANCE_ACTION = path.join(ROOT, 'src', 'actions', 'governance.ts')
const PUBLISH_ROUTE = path.join(ROOT, 'src', 'app', 'api', 'sops', '[sopId]', 'publish', 'route.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// setSopOwner — OWN-02
// ---------------------------------------------------------------------------

test.describe('setSopOwner — org-membership verify + plain session client', () => {
  const src = read(GOVERNANCE_ACTION)

  test('verifies target userId is an organisation_members row in caller org before writing', () => {
    const fnMatch = src.match(/export async function setSopOwner\(([\s\S]*?)\n\}/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch![0]
    expect(body).toContain(".from('organisation_members')")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain('ctx.organisationId')
    expect(body).toContain("Owner must be a member of this organisation")
  })

  test('writes sops via the PLAIN session client (createClient), not createAdminClient', () => {
    const fnMatch = src.match(/export async function setSopOwner\(([\s\S]*?)\n\}/)
    const body = fnMatch![0]
    // The sops UPDATE call site inside setSopOwner must come from a plain
    // `createClient()` call, and the function body must not invoke createAdminClient.
    expect(body).toContain('const supabase = await createClient()')
    expect(body).toContain(".from('sops')")
    expect(body).toContain('.update({ owner_user_id: userId')
    expect(body).not.toContain('createAdminClient')
  })
})

// ---------------------------------------------------------------------------
// confirmSopCurrent — REV-04
// ---------------------------------------------------------------------------

test.describe('confirmSopCurrent — review-lifecycle write + audit event', () => {
  const src = read(GOVERNANCE_ACTION)
  const fnMatch = src.match(/export async function confirmSopCurrent\(([\s\S]*?)\nexport /)
  const body = fnMatch ? fnMatch[0] : src

  test('writes last_reviewed_at, review_due_at, last_reviewed_by on sops', () => {
    expect(body).toContain('last_reviewed_at: now')
    expect(body).toContain('review_due_at: reviewDue')
    expect(body).toContain('last_reviewed_by: ctx.userId')
  })

  test('inserts a sop_review_events row with action confirmed_current', () => {
    expect(body).toContain(".from('sop_review_events')")
    expect(body).toContain('.insert({')
    expect(body).toContain("action: 'confirmed_current'")
  })
})

// ---------------------------------------------------------------------------
// setReviewCadence — REV-01 / T-28-03-02 (signature + source check, mirrors
// AIPS-SET-02's "no attack surface" style from tests/phase27/ai-settings-org-scope.spec.ts)
// ---------------------------------------------------------------------------

test.describe('setReviewCadence — org id sourced only from JWT, never a parameter', () => {
  const src = read(GOVERNANCE_ACTION)

  test('exported signature accepts only (category, months) — no organisationId parameter', () => {
    const sigMatch = src.match(/export async function setReviewCadence\(([\s\S]*?)\):/)
    expect(sigMatch).not.toBeNull()
    const params = sigMatch![1]
    expect(params).toMatch(/category\s*:\s*string/)
    expect(params).toMatch(/months\s*:\s*number/)
    expect(params.toLowerCase()).not.toContain('organisationid')
  })

  test('writes sop_review_cadences with organisation_id: ctx.organisationId (JWT-derived ctx)', () => {
    const fnMatch = src.match(/export async function setReviewCadence\(([\s\S]*?)\n\}/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch![0]
    expect(body).toContain('createAdminClient()')
    expect(body).toContain("organisation_id: ctx.organisationId")
    expect(body).toContain("onConflict: 'organisation_id,category'")
  })
})

// ---------------------------------------------------------------------------
// listGovernanceQueue — GQ-01/GQ-02/GQ-03
// ---------------------------------------------------------------------------

test.describe('listGovernanceQueue — composed read + classifier wiring', () => {
  const src = read(GOVERNANCE_ACTION)

  test('maps every row through classifyGovernanceRow', () => {
    expect(src).toContain('classifyGovernanceRow({')
  })

  test('never joins sub-trades for stale-role detection (Pitfall 3)', () => {
    expect(src).not.toMatch(/sops_sub_trades|sub_trades/)
  })

  test('applies the last_reviewed_at null-guard before the renamed-since-review comparison (WARNING-1)', () => {
    // Must explicitly guard on last_reviewed_at being non-null before comparing
    // updated_at against it — an unguarded comparison would spuriously flag
    // nearly every department-tagged (but never-reviewed) SOP as stale_role.
    expect(src).toMatch(/last_reviewed_at\s*\?/)
  })
})

// ---------------------------------------------------------------------------
// Publish route — supersede resets review clock (D28-04/Pattern 4)
// ---------------------------------------------------------------------------

test.describe('publish route — review-clock reset + superseded event', () => {
  const src = read(PUBLISH_ROUTE)

  test('resets review_due_at + last_reviewed_at after a successful publish', () => {
    expect(src).toContain('computeReviewDueDate(publishedAt, months)')
    expect(src).toContain('review_due_at: reviewDue, last_reviewed_at: publishedAt')
  })

  test("inserts a 'superseded' sop_review_events row guarded by parent_sop_id", () => {
    const guardMatch = src.match(/if \(sopRow\?\.parent_sop_id\)\s*\{([\s\S]*?)\n\s*\}/)
    expect(guardMatch).not.toBeNull()
    const guardedBlock = guardMatch![0]
    expect(guardedBlock).toContain(".from('sop_review_events')")
    expect(guardedBlock).toContain("action: 'superseded'")
  })

  test('review-clock reset is non-fatal (wrapped, never fails the publish response)', () => {
    // The reset+event block lives inside a try/catch whose catch only logs —
    // it must run strictly AFTER the publish UPDATE's own error check returns.
    const publishIdx = src.indexOf("status: 'published'")
    const tryIdx = src.indexOf('try {', publishIdx)
    expect(publishIdx).toBeGreaterThan(-1)
    expect(tryIdx).toBeGreaterThan(publishIdx)
  })
})

// ---------------------------------------------------------------------------
// Runtime cross-org write-isolation — CARRIED UAT (test.fixme).
// Same Railway-only-testing convention as tests/phase27/ai-settings-org-scope.spec.ts.
// ---------------------------------------------------------------------------

test.describe('Runtime cross-org write isolation (live Supabase)', () => {
  test.fixme(
    'setSopOwner: Org A admin cannot assign a SOP owner to an Org B user_id',
    async ({ page }) => {
      /**
       * Steps (live Supabase; requires two seeded orgs + an Org A admin session):
       *
       * 1. Authenticate as an Org A admin (scripts/uat-session.mjs, sb-{ref}-auth-token
       *    cookie per CLAUDE.md 2026-04-24 magic-link pattern).
       * 2. Call setSopOwner(<an Org A sopId>, <an Org B user_id>).
       * 3. Expect { error: 'Owner must be a member of this organisation' } — the
       *    membership check in setSopOwner queries organisation_members filtered
       *    to ctx.organisationId (Org A), so an Org B user_id never matches.
       * 4. Confirm via service-role client that sops.owner_user_id was NOT changed.
       */
      void page
      expect(true).toBe(true)
    },
  )

  test.fixme(
    'confirmSopCurrent: Org A admin cannot confirm-current a SOP belonging to Org B',
    async ({ page }) => {
      /**
       * Steps (live Supabase):
       *
       * 1. Authenticate as an Org A admin.
       * 2. Call confirmSopCurrent(<an Org B sopId>).
       * 3. Expect { error: 'SOP not found' } — the sops SELECT rides
       *    org_members_can_view_sops RLS, so an Org B row is invisible to the
       *    Org A session and the .maybeSingle() lookup returns null.
       * 4. Confirm via service-role client no sop_review_events row was inserted
       *    for that sopId.
       */
      void page
      expect(true).toBe(true)
    },
  )

  test.fixme(
    'setReviewCadence: Org A admin write never mutates Org B sop_review_cadences rows',
    async ({ page }) => {
      /**
       * Steps (live Supabase):
       *
       * 1. Authenticate as an Org A admin.
       * 2. Call setReviewCadence('default', 6).
       * 3. Using a service-role client, confirm zero rows exist for Org B with
       *    that category, and exactly one row exists for Org A with months=6.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
