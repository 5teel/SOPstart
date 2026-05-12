/**
 * SB-LINE-05 — Sub-trade RLS backward compatibility.
 *
 * Verifies that:
 *   1. A worker with no sub_trade rows can still read SOPs where
 *      `sops_sub_trades` is empty (backward-compat per D-11: empty
 *      means "all workers regardless of sub-trade").
 *   2. A worker with a [fitter] tag can read an SOP tagged [fitter];
 *      a worker without [fitter] cannot.
 *
 * Tests run against the live Supabase project via authenticated clients
 * (cookie-auth pattern from CLAUDE.md learning 2026-04-24). Wave 1 plan
 * adds migrations + RLS policies; this scaffold ensures the RLS
 * expression survives the schema extension without breaking Phase 12.5
 * worker access.
 *
 * Status: Wave-0 scaffold — Wave 1 (schema + RLS) flips to `test`.
 */
import { test } from '@playwright/test'

test.describe('SB-LINE-05 — Sub-trade RLS backward compat', () => {
  test.fixme(
    'worker with no sub_trade rows can read SOP with empty sops_sub_trades (backward compat)',
    async ({ page }) => {
      // TODO(wave-1):
      // 1. Seed: 1 org, 1 SOP (published, role=worker, NO sops_sub_trades rows),
      //    1 worker user with NO users_sub_trades rows
      // 2. Authenticate as the worker via cookie
      // 3. await page.goto('/sops/<sop-id>')
      // 4. await expect(page.locator('h1')).toContainText('<sop title>')
      // 5. (Negative parallel: also query supabase directly with worker JWT
      //    and assert .from('sops').select('id').eq('id', sopId).single() returns the row)
      void page
    }
  )

  test.fixme(
    'worker with fitter tag can read SOP tagged [fitter]; worker without cannot',
    async ({ page }) => {
      // TODO(wave-1):
      // 1. Seed: 1 org, 1 SOP tagged [fitter] via sops_sub_trades,
      //    workerA with [fitter] in users_sub_trades, workerB with no tags
      // 2. Authenticate as workerA → can read SOP
      // 3. Authenticate as workerB → cannot read SOP (RLS hides it from /sops)
      // 4. await expect(page.locator('[data-testid="sop-card-<sop-id>"]')).not.toBeVisible()
      void page
    }
  )
})
