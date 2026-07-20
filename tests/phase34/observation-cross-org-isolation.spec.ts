/**
 * Success Criterion 4 — Cross-org write/read isolation: an org-B
 * supervisor cannot write an observation about an org-A worker; an
 * org-B session cannot read org-A observations.
 *
 * This is the codebase's recurring service-role write-hole class
 * (2026-06-15, 2026-06-26 x2, 2026-07-05 Learnings). Because Pattern 1
 * (34-RESEARCH.md) is RLS-only (no admin client), this is the primary
 * proof that the RLS policy — not app code — enforces tenant isolation.
 *
 * Contract:
 *   - `supabase/migrations/00052_supervisor_observations.sql`'s
 *     `sop_observations_read_org` policy scopes on
 *     `organisation_id = public.current_organisation_id()` OR
 *     `observed_worker_id = auth.uid()` — the worker branch matches
 *     ONLY the caller's own id, never a widened `= any(...)` form
 *     (Information Disclosure threat per 34-RESEARCH.md § Known Threat
 *     Patterns).
 *
 * Runtime pattern: two ephemeral throwaway orgs + two magic-link
 * sessions, per the Phase 32-05 precedent (CLAUDE.md decision log) —
 * createGrant/materializeSopAccess-style actions cannot be invoked
 * directly outside a Next.js request scope, so cross-org proof requires
 * real HTTP round-trips against a live app.
 *
 * Flipped LIVE in: 34-03.
 *
 * Registration: playwright.config.ts `phase34` project
 *   testDir: '.', testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase34`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00052_supervisor_observations.sql')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-4 — cross-org isolation source contract', () => {
  test('sop_observations_read_org scopes on org OR self — never a widened observed_worker_id = any(...) form (green-when-absent — flips live in 34-03)', () => {
    if (!fs.existsSync(MIGRATION)) {
      test.skip(true, 'supabase/migrations/00052_supervisor_observations.sql not yet created — waiting for Plan 34-02/34-03')
      return
    }
    const sql = read(MIGRATION)
    expect(sql).toContain('create policy sop_observations_read_org')
    expect(sql).toContain('organisation_id = public.current_organisation_id()')
    expect(sql).toContain('observed_worker_id = auth.uid()')
    expect(sql).not.toMatch(/observed_worker_id\s*=\s*any\s*\(/i)
  })
})

// ---------------------------------------------------------------------------
// Runtime — requires chromium + live app + two ephemeral throwaway orgs
// (Railway-only UAT convention, CLAUDE.md 2026-04-24/2026-05-08; ephemeral-org
// pattern per Phase 32-05, CLAUDE.md decision log).
// ---------------------------------------------------------------------------

test.describe('SC-4 — cross-org isolation runtime (requires chromium + live app + two ephemeral orgs)', () => {
  test.fixme(
    'an org-B supervisor CANNOT insert an observation about an org-A worker — RLS denies the write',
    async ({ page }) => {
      // Spin up two throwaway orgs (org-A, org-B) + two magic-link sessions.
      // As the org-B supervisor, attempt to record an observation naming an
      // org-A worker id — expect RLS insert denial, not a 500 or a silent success.
    },
  )

  test.fixme(
    'an org-B session reading observations returns ZERO org-A observation rows',
    async ({ page }) => {
      // As the org-B session, list observations and assert the result set
      // contains no rows belonging to org-A (organisation_id mismatch).
    },
  )
})
