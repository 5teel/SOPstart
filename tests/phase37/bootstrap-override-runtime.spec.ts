/**
 * ASR-01 -- success criterion 2 bootstrap probe: an org with ZERO signed-off
 * assessors must not be permanently locked out of recording advancing
 * observations / approving sign-offs. An admin override succeeds and lands
 * is_assessor_override = true with a reason; a plain supervisor in the same
 * org is rejected (the override path is admin/safety_manager only, D-05/D-06).
 *
 * `test.fixme` runtime stub -- flipped LIVE in Plan 37-06.
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test } from '@playwright/test'

test.describe('ASR-01 -- bootstrap override (zero signed-off assessors in org) (requires chromium + live app)', () => {
  test.fixme(
    'in an org with zero signed-off assessors, an admin override succeeds and the inserted row has is_assessor_override = true with a non-empty reason',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Ephemeral org with zero signed-off assessors; admin records an advancing
      // observation with an override reason; assert success + is_assessor_override = true.
    },
  )

  test.fixme(
    'in the same zero-assessor org, a plain supervisor attempting the override path is rejected',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Same ephemeral org; plain supervisor attempts an advancing observation
      // (no assessor status, not admin/safety_manager) -- assert rejection.
    },
  )
})
