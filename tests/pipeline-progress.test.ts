import { test, expect } from '@playwright/test'

test.describe('Unified pipeline progress page (PATH-04)', () => {
  test.fixme('progress page renders 5 named stages: Uploading, Parsing, Review, Generating video, Ready', async ({ page }) => {})
  test.fixme('active stage label uses text-brand-yellow font-semibold with aria-current="step"', async ({ page }) => {})
  test.fixme('Review stage shows orange checkpoint panel with "Review SOP now" CTA that deep-links to /admin/sops/[sopId]/review', async ({ page }) => {})
  test.fixme('Ready stage shows green panel with "Preview and publish video" CTA that deep-links to /admin/sops/[sopId]/video', async ({ page }) => {})
  test.fixme('progress page subscribes to realtime and falls back to 5s polling after 5s', async ({ page }) => {})
  test.fixme('review page shows "Back to pipeline" link when opened from the pipeline flow', async ({ page }) => {})
})
