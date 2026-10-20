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

const SCENES = ['hook', 'reveal', 'machines', 'structure', 'walk', 'ai', 'outro']

test.describe('promo reel', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL not set')

  test('a signed-out visit to / lands on the reel, which plays on its own', async ({ page }) => {
    const errors = watchConsole(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    const reel = page.getByTestId('promo-reel')
    await expect(reel).toHaveAttribute('data-scene', 'hook', { timeout: 25_000 })
    await expect(reel).toHaveAttribute('data-scene', 'reveal', { timeout: 8_000 })
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login')
    // The brand mark is a named image (63-04): the header carries it.
    await expect(page.getByRole('img', { name: 'SOPstart' }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  // The homepage below the reel: every section renders, with its screenshots loaded and no sideways scroll.
  for (const [label, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`HOME-01 the homepage sections render (${label})`, async ({ page }) => {
      const errors = watchConsole(page)
      await page.setViewportSize(size)
      await page.goto('/welcome')
      for (const heading of [
        'SOPs your people actually follow',
        'We take care of the SOPs. You run the site.',
        'From the document on the shelf to a signed-off record',
        'A safer, faster site with the paperwork done',
      ]) {
        const h = page.getByRole('heading', { name: heading })
        await expect(h).toHaveCount(1)
        await h.scrollIntoViewIfNeeded()
      }
      for (const img of await page.locator('#how-it-works img').all()) {
        await img.scrollIntoViewIfNeeded()
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
      }
      // A sales page, not a bio: no founder or career details.
      await expect(page.getByText(/founder|Simon Scott|20 years/i)).toHaveCount(0)
      await expect(page.getByTestId('enquiries-cta')).toHaveAttribute('href', 'mailto:enquiries@sopstart.com')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `.planning/evals/latest/home-${label}-full.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }

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
        // Mid-transition (brag checklist: no muddy double exposures), then
        // settled after the camera glide (1.2 s), entrances and taps.
        await page.waitForTimeout(600)
        await page.screenshot({ path: `.planning/evals/latest/welcome-${label}-${i + 1}-${id}-mid.png` })
        await page.waitForTimeout(4400)
        await shot(page, `welcome-${label}-${i + 1}-${id}`)
        // A scene's panel fits its column: nothing (like Sent for sign-off) is cut off.
        const column = page.getByTestId('reel-column')
        if (await column.count()) {
          // Content only: the decorative tap rings (aria-hidden) spread past the edge as they fade.
          const [bottom, limit] = await column.evaluate((el) => [
            Math.max(...[...el.querySelectorAll('*')].filter((n) => !n.closest('[aria-hidden="true"]')).map((n) => n.getBoundingClientRect().bottom)),
            el.getBoundingClientRect().bottom,
          ])
          expect(bottom, `${id} panel is cut off at ${label} size`).toBeLessThanOrEqual(limit + 1)
        }
      }
      expect(errors).toEqual([])
    })
  }
})
