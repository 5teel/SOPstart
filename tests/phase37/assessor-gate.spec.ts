/**
 * ASR-01 -- the assessor gate on recordObservation: an advancing
 * ('performed_to_sop') observation requires the recorder to be a signed-off
 * assessor for the SOP, UNLESS the recorder is admin/safety_manager AND
 * supplies an override reason (D-05). needs_support observations never
 * touch the predicate at all (D-03/D-04 branch-before-gate).
 *
 * `test.fixme` stubs -- flipped LIVE in Plan 37-03.
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test } from '@playwright/test'

test.describe('ASR-01 -- recordObservation assessor gate (requires chromium + live app)', () => {
  test.fixme(
    'recordObservation calls isSignedOffAssessor ONLY inside the verdict === "performed_to_sop" branch (D-03/D-04 branch-before-gate) -- a needs_support observation never evaluates the predicate',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Record a needs_support observation as a non-assessor supervisor and assert
      // it succeeds without ever invoking isSignedOffAssessor.
    },
  )

  test.fixme(
    'a non-assessor supervisor recording an advancing (performed_to_sop) observation is rejected with NOT_SIGNED_OFF_ASSESSOR',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Record an advancing observation as a supervisor who is not a signed-off
      // assessor for the SOP and assert the NOT_SIGNED_OFF_ASSESSOR error code.
    },
  )

  test.fixme(
    'an admin/safety_manager recording an advancing observation WITHOUT an override reason is rejected with ASSESSOR_OVERRIDE_REQUIRED',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Record an advancing observation as admin/safety_manager, omit overrideReason,
      // assert ASSESSOR_OVERRIDE_REQUIRED.
    },
  )

  test.fixme(
    'an admin/safety_manager override insert stamps is_assessor_override = true and persists the reason',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Record an advancing observation as admin/safety_manager WITH an override
      // reason and assert the inserted row carries is_assessor_override = true.
    },
  )

  test.fixme(
    'needs_support observations reach the insert without touching the assessor predicate at all',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Record a needs_support observation as a plain (non-assessor) supervisor and
      // assert success -- the predicate is never consulted for this verdict.
    },
  )
})
