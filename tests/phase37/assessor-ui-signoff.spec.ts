/**
 * ASR-01 -- the completion sign-off surface applies the same assessor gate
 * as observations: signOffCompletion's role array must include 'admin'
 * (37-RESEARCH Pitfall 2 -- the existing array is supervisor/safety_manager
 * only), the approve control is blocked for a non-assessor supervisor,
 * reject stays ungated (a sibling of D-03: rejecting never needs assessor
 * status), and the override reason sheet appears for admin/safety_manager.
 *
 * `test.fixme` stubs -- flipped LIVE in Plan 37-04.
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test } from '@playwright/test'

test.describe('ASR-01 -- signOffCompletion / sign-off UI assessor gate (requires chromium + live app)', () => {
  test.fixme(
    "signOffCompletion's role array includes 'admin' (37-RESEARCH Pitfall 2 -- the pre-existing array is supervisor/safety_manager only)",
    async ({ page }) => {
      await page.goto('/activity')
      // Sign off a completion as an admin session and assert success (not a role
      // rejection) -- proves the role array was widened to include admin.
    },
  )

  test.fixme(
    'the approve control is blocked for a non-assessor supervisor',
    async ({ page }) => {
      await page.goto('/activity')
      // Open a completion detail as a non-assessor supervisor and assert the
      // approve control is disabled/blocked.
    },
  )

  test.fixme(
    'reject stays ungated regardless of assessor status (D-03 sibling)',
    async ({ page }) => {
      await page.goto('/activity')
      // Assert the reject control remains enabled for a non-assessor supervisor.
    },
  )

  test.fixme(
    'the override reason sheet appears for admin/safety_manager approving without assessor status',
    async ({ page }) => {
      await page.goto('/activity')
      // Approve as admin/safety_manager and assert the override reason sheet is
      // presented before the sign-off completes.
    },
  )
})
