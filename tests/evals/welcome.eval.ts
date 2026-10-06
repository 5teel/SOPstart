/**
 * Deployed-site eval: the signed-out promo reel at /welcome.
 *
 * Signed out (no session minted, so no OTP budget spent). Proves the root
 * sends a visitor to the reel, the reel advances on its own, and every scene
 * renders at desktop and phone size: one screenshot per scene, read by eye.
 *
 * Self-skips when EVAL_BASE_URL is unset.
 */
import { test, expect } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'
import { shot, watchConsole } from './lib/plant-fixture'

const SCENES = ['intro', 'machines', 'structure', 'visual', 'ai', 'outro']

test.describe('promo reel', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL not set')

  test('a signed-out visit to / lands on the reel, which plays on its own', async ({ page }) => {
    const errors = watchConsole(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    const reel = page.getByTestId('promo-reel')
    await expect(reel).toHaveAttribute('data-scene', 'intro', { timeout: 25_000 })
    await expect(reel).toHaveAttribute('data-scene', 'machines', { timeout: 12_000 })
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login')
    expect(errors).toEqual([])
  })

  for (const [label, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`every scene renders (${label})`, async ({ page }) => {
      test.setTimeout(120_000)
      const errors = watchConsole(page)
      await page.setViewportSize(size)
      await page.goto('/welcome')
      const reel = page.getByTestId('promo-reel')
      await expect(reel).toBeVisible({ timeout: 25_000 })
      await page.getByRole('button', { name: 'Pause' }).click()
      const dots = page.getByTestId('reel-dot')
      await expect(dots).toHaveCount(SCENES.length)
      for (const [i, id] of SCENES.entries()) {
        await dots.nth(i).click()
        await expect(reel).toHaveAttribute('data-scene', id)
        // Camera glide (1.8 s) plus the scene's staggered entrances.
        await page.waitForTimeout(5500)
        await shot(page, `welcome-${label}-${i + 1}-${id}`)
      }
      expect(errors).toEqual([])
    })
  }
})
