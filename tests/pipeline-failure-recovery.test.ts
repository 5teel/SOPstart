import { test, expect } from '@playwright/test'

test.describe('Pipeline failure recovery (PATH-05)', () => {
  test.fixme('video generation failure after publish keeps the SOP status=published', async ({ page }) => {})
  test.fixme('progress page renders "Video generation failed" panel with "Go to video panel" CTA', async ({ page }) => {})
  test.fixme('"Go to video panel" navigates to /admin/sops/[sopId]/video where retry button exists', async ({ page }) => {})
  test.fixme('parse failure on pipeline-linked SOP shows existing ParseJobStatus failed state', async ({ page }) => {})
})
