/**
 * SB-LINE-05 — Sub-trade admin assignment + worker visibility (e2e).
 *
 * Verifies that:
 *   1. An admin can assign [fitter, sparky] to a worker via the team
 *      management page; the rows persist in `users_sub_trades`.
 *   2. An admin can assign an SOP to [fitter] via the assignment page;
 *      the rows persist in `sops_sub_trades`.
 *   3. After both writes, the worker (with [fitter]) sees the SOP in
 *      their library (covered indirectly — full RLS proof is in the
 *      integration test).
 *
 * Status: Wave-0 scaffold — Wave 4 plan ships the admin UI changes and
 * flips these `test.fixme` calls to `test`.
 */
import { test } from '@playwright/test'

test.describe('SB-LINE-05 — Sub-trade admin assignment (e2e)', () => {
  test.fixme(
    'admin assigns [fitter, sparky] to worker via team page; persists in users_sub_trades',
    async ({ page }) => {
      // TODO(wave-4):
      // 1. Mint admin session cookie
      // 2. await page.goto('/admin/team')
      // 3. Open worker row → multi-select picker
      // 4. Select Fitter, Select Sparky → click Save
      // 5. await expect(page.locator('[data-testid="worker-tags"][data-worker-id="<id>"]')).toContainText(/fitter.*sparky/i)
      // 6. Query supabase admin client: rows in users_sub_trades for that worker = 2
      void page
    }
  )

  test.fixme(
    'admin assigns SOP to [fitter] via assign page; persists in sops_sub_trades',
    async ({ page }) => {
      // TODO(wave-4):
      // 1. Mint admin session cookie
      // 2. await page.goto('/admin/sops/<sop-id>/assign')
      // 3. In sub-trade picker: select Fitter → Save
      // 4. await expect(page.locator('[data-testid="sop-tags"]')).toContainText(/fitter/i)
      // 5. Query supabase admin client: row in sops_sub_trades exists with (sop_id, fitter_id)
      void page
    }
  )
})
