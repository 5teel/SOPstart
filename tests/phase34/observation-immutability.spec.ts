/**
 * OBS-01 (append-only) — `sop_observations` has no UPDATE or DELETE path,
 * enforced at the RLS level (not just hidden in the UI).
 *
 * Contract (34-RESEARCH.md § Pattern 1, 34-PATTERNS.md § migration):
 *   - `supabase/migrations/00052_supervisor_observations.sql` creates the
 *     `sop_observations_insert_recorder` INSERT policy.
 *   - No `for update` / `for delete` policy exists anywhere in that file —
 *     append-only is a hard DB-level guarantee, matching
 *     `sop_completions`/`completion_sign_offs` (D-15) and `sop_review_events`.
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

test.describe('OBS-01 — append-only migration source contract', () => {
  test('sop_observations_insert_recorder INSERT policy exists (green-when-absent — flips live in 34-03)', () => {
    if (!fs.existsSync(MIGRATION)) {
      test.skip(true, 'supabase/migrations/00052_supervisor_observations.sql not yet created — waiting for Plan 34-02/34-03')
      return
    }
    const sql = read(MIGRATION)
    expect(sql).toContain('create policy sop_observations_insert_recorder')
  })

  test('no UPDATE or DELETE policy on sop_observations — append-only is a hard DB guarantee', () => {
    if (!fs.existsSync(MIGRATION)) {
      test.skip(true, 'supabase/migrations/00052_supervisor_observations.sql not yet created — waiting for Plan 34-02/34-03')
      return
    }
    const sql = read(MIGRATION)
    expect(sql.toLowerCase()).not.toContain('for update')
    expect(sql.toLowerCase()).not.toContain('for delete')
  })
})

// ---------------------------------------------------------------------------
// Runtime — requires chromium + live app + authenticated session
// (Railway-only UAT convention, CLAUDE.md 2026-04-24/2026-05-08).
// ---------------------------------------------------------------------------

test.describe('OBS-01 — append-only runtime (requires chromium + live app)', () => {
  test.fixme(
    'an authenticated UPDATE attempt on an existing sop_observations row is denied by RLS (no rows affected / policy error), not a 500',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Attempt a client-side/PostgREST UPDATE against an existing observation row
      // as an authenticated supervisor/admin session and assert RLS denial
      // (0 rows affected or an explicit policy-violation error) — never a 500.
    },
  )
})
