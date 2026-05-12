/**
 * SB-LINE-01 — Desktop walkthrough layout variant.
 *
 * Verifies that:
 *   1. At ≥1024px viewport width, the route renders DesktopWalkthrough
 *      with computed body font-size ≥ 24px (far-readable from a seated
 *      Visy operator desk at a 22"+ HD monitor).
 *   2. At < 1024px (390×844 iPhone 14), the route renders
 *      MobileWalkthrough byte-identical to the Phase 12.5 baseline
 *      (no regression on the touch-device flow).
 *
 * Status: Wave-0 scaffold — both tests use `test.fixme` so they appear
 * in `--list` but do not run until Wave 2 ships the DesktopWalkthrough
 * variant.
 *
 * Auth pattern: cookie-based session via @supabase/ssr token (see
 * CLAUDE.md learning 2026-04-24, "magic-link session install via
 * hash-fragment cookies"). Wave 2 executor will add a beforeEach helper
 * that calls Supabase admin client to mint a worker session and set
 * `sb-{projectRef}-auth-token`.
 */
import { test } from '@playwright/test'

test.describe('SB-LINE-01 — Desktop walkthrough layout', () => {
  test.fixme(
    'renders DesktopWalkthrough with computed font-size >= 24px at 1920×1080',
    async ({ page }) => {
      // TODO(wave-2):
      // 1. Mint worker session cookie for org with seeded Visy SOP fixture
      // 2. await page.setViewportSize({ width: 1920, height: 1080 })
      // 3. await page.goto('/sops/<visy-sop-id>')
      // 4. const fontSize = await page.locator('[data-walkthrough="desktop"] p').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
      // 5. expect(fontSize).toBeGreaterThanOrEqual(24)
      void page
    }
  )

  test.fixme(
    'renders MobileWalkthrough byte-identical to Phase 12.5 at 390×844',
    async ({ page }) => {
      // TODO(wave-2):
      // 1. Mint worker session cookie
      // 2. await page.setViewportSize({ width: 390, height: 844 })
      // 3. await page.goto('/sops/<visy-sop-id>')
      // 4. await expect(page.locator('[data-walkthrough="mobile"]')).toHaveScreenshot('mobile-walkthrough-baseline.png', { maxDiffPixelRatio: 0.01 })
      void page
    }
  )
})
