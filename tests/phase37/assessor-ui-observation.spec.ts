/**
 * ASR-01 -- observation-recording UI surfaces the assessor gate: the
 * advancing verdict button is disabled when the recorder is blocked (D-08),
 * needs_support stays enabled in the same modal (D-09), blocked copy teaches
 * the rule, the override disclosure names the audit trail, a "Request
 * assessment" CTA exists, and the assessment-requests panel renders subject
 * + SOP + an assess action.
 *
 * `test.fixme` stubs -- flipped LIVE in Plan 37-05.
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test } from '@playwright/test'

test.describe('ASR-01 -- RecordObservationModal assessor gate UI (requires chromium + live app)', () => {
  test.fixme(
    'the advancing (performed_to_sop) verdict button is disabled when the recorder is blocked (D-08)',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Open the record modal as a non-assessor supervisor and assert the
      // performed_to_sop button is disabled.
    },
  )

  test.fixme(
    'needs_support stays enabled in the same modal even when the recorder is blocked from advancing (D-09)',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Open the record modal as a non-assessor supervisor and assert the
      // needs_support button remains enabled.
    },
  )

  test.fixme(
    'the blocked-advancing copy teaches the rule (why the button is disabled)',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Assert explanatory copy is present near the disabled button.
    },
  )

  test.fixme(
    'the override disclosure (admin/safety_manager path) names the permanent audit trail',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Open the record modal as admin/safety_manager, trigger the override path,
      // and assert the disclosure copy names the audit trail.
    },
  )

  test.fixme(
    'a "Request assessment" CTA exists on the blocked-advancing state',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Assert the Request assessment CTA renders when a non-assessor is blocked.
    },
  )

  test.fixme(
    'the assessment-requests panel renders subject + SOP + an assess action per request',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Assert AssessmentRequestsPanel lists subject worker, SOP name, and an
      // action to assess/resolve the request.
    },
  )
})
