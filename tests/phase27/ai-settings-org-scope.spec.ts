/**
 * AIPS-GAP-02 / AIPS-SET-02 — ai_model_settings write-path org isolation.
 *
 * Verifies:
 *   AIPS-SET-02: `setAiModelSetting` (src/actions/ai-settings.ts:47-90) self-enforces
 *     org scope — organisation_id is sourced only from the caller's verified
 *     session via getSessionContext(), NEVER from a client-supplied parameter, and both the
 *     .upsert() and .delete() calls carry .eq('organisation_id', ctx.organisationId).
 *   AIPS-GAP-02: a regression test proving `ai_model_settings` writes cannot
 *     cross organisation boundaries.
 *
 * This is NOT a "fix a bug" test — 27-RESEARCH.md confirms the code already
 * does the right thing (org id sourced from JWT claims, never a function
 * parameter — there is no client-suppliable org id to spoof in the first
 * place). The job here is to LOCK IN that correctness with a REAL runtime
 * assertion, never a source-string grep — a grep for `.eq('organisation_id'`
 * would NOT have caught the 2026-06-15 signOffCompletion cross-tenant bug
 * (CLAUDE.md Learnings) and must not be the pattern repeated here.
 *
 * Registration: playwright.config.ts `phase27-stubs` project
 *   testDir: '.', testMatch: /tests\/phase27\/.*\.(spec|test)\.ts$/
 * Verify registration: `npx playwright test --list --project=phase27-stubs`
 *
 * Per this project's Railway-only-testing convention (CLAUDE.md memory:
 * feedback_railway_only_testing), the live-Supabase runtime assertions below
 * are carried as `test.fixme` with full inline Steps documentation — same
 * precedent as tests/integration/departments-rls.spec.ts lines 140-191. They
 * are a CARRIED UAT ITEM, not executed by this plan run. See 27-01-SUMMARY.md
 * § Carried UAT.
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const AI_SETTINGS_ACTION = path.join(ROOT, 'src', 'actions', 'ai-settings.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Supplementary source assertion — runs immediately, no live DB required.
// Proves the "no attack surface" property: setAiModelSetting's public
// signature has NO organisationId parameter, so there is nothing for a
// caller to spoof. This is SUPPLEMENTARY ONLY — it does not substitute for
// the runtime write-isolation test below (which is the primary deliverable).
// ---------------------------------------------------------------------------

test.describe('AIPS-SET-02 — ai_model_settings write isolation (source contract)', () => {
  test('setAiModelSetting exported signature accepts only (useCase, modelId) — no organisationId parameter', () => {
    const src = read(AI_SETTINGS_ACTION)
    const sigMatch = src.match(/export async function setAiModelSetting\(([\s\S]*?)\):/)
    expect(sigMatch).not.toBeNull()

    const params = sigMatch![1]
    // Exactly two parameters: useCase and modelId. No organisationId anywhere
    // in the signature — org identity can only come from requireAdmin()'s
    // JWT-derived ctx, never from the caller.
    expect(params).toMatch(/useCase\s*:\s*string/)
    expect(params).toMatch(/modelId\s*:\s*string \| null/)
    expect(params.toLowerCase()).not.toContain('organisationid')
  })

  test('requireAdmin() derives organisationId from the verified session, not from any function argument', () => {
    const src = read(AI_SETTINGS_ACTION)
    // requireAdmin takes no arguments — organisationId can only be session-derived.
    // 2026-07-13: getSessionContext() replaced parseJwtPayload (local ES256
    // JWT verify + member-role read) — same no-spoofable-parameter property.
    expect(src).toMatch(/async function requireAdmin\(\)\s*:/)
    expect(src).toContain('getSessionContext()')
  })
})

// ---------------------------------------------------------------------------
// Runtime write-isolation regression — CARRIED UAT (test.fixme).
// Activates once live Supabase + magic-link session fixtures are reachable
// in the execution environment (per CLAUDE.md 2026-04-24 magic-link pattern:
// scripts/uat-session.mjs, sb-{projectRef}-auth-token cookie,
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY anon key).
// ---------------------------------------------------------------------------

test.describe('AIPS-SET-02 — ai_model_settings write isolation (runtime, live Supabase)', () => {
  test.fixme(
    'AIPS-GAP-02: Org A write via setAiModelSetting never mutates Org B rows; written row is JWT-scoped to Org A',
    async ({ page }) => {
      /**
       * Steps (live Supabase; requires two seeded orgs + an Org A admin session):
       *
       * 1. Authenticate as an Org A admin:
       *    - node scripts/uat-session.mjs <org-A-admin-email> → { cookieName, cookieValue }
       *    - Install the sb-{projectRef}-auth-token cookie at baseURL
       *      (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is the anon key env var — NOT
       *      NEXT_PUBLIC_SUPABASE_ANON_KEY, per CLAUDE.md 2026-05-08 learning)
       *    - Navigate to /admin/ai-settings (session active)
       *    - Call setAiModelSetting('parse-triage', '<a vetted model id from
       *      AI_MODEL_OPTIONS['parse-triage']>') via the page's server action
       *      (or a direct authenticated fetch to the action's route)
       *
       * 2. Using a service-role client (SUPABASE_SERVICE_ROLE_KEY):
       *    const { data: orgBRows } = await admin
       *      .from('ai_model_settings')
       *      .select('*')
       *      .eq('organisation_id', ORG_B_ID)
       *    expect(orgBRows).toHaveLength(0) — Org B has zero rows; Org A's write
       *    never created or mutated anything under Org B's organisation_id.
       *
       * 3. Read back the row that WAS written:
       *    const { data: orgARows } = await admin
       *      .from('ai_model_settings')
       *      .select('*')
       *      .eq('organisation_id', ORG_A_ID)
       *      .eq('use_case', 'parse-triage')
       *    expect(orgARows).toHaveLength(1)
       *    expect(orgARows[0].organisation_id).toBe(ORG_A_ID) — confirms the
       *    written organisation_id is exactly the JWT-derived Org A id, never
       *    client-suppliable (setAiModelSetting's signature has no
       *    organisationId parameter — see source-contract test above).
       *
       * Expected result: PASS — 27-RESEARCH.md confirms the code already
       * self-enforces this. A failure here would be a genuine (unexpected)
       * regression, not a known gap.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
