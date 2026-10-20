/**
 * Deployed-site eval: the signed-out homepage at /welcome.
 *
 * Signed out (no session minted, so no OTP budget spent). Proves the root sends a
 * visitor to the homepage, the brandmark animates in on the left, every story
 * section and module renders and animates in when scrolled to, at desktop and
 * phone size, with no sideways scroll. Screenshots are read by eye.
 *
 * Self-skips when EVAL_BASE_URL is unset.
 */
import { test, expect } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'
import { shot, watchConsole } from './lib/plant-fixture'

const STORIES = ['accessible', 'accountable', 'tracked', 'secure', 'modules']
const MODULES = ['SOPs', 'PMs', 'Lockout / tagout', 'Safety meetings', 'Permits to work']

test.describe('homepage', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL not set')

  test('a signed-out visit to / lands on the homepage, brandmark first', async ({ page }) => {
    const errors = watchConsole(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByTestId('homepage')).toBeVisible()
    const mark = page.getByRole('img', { name: 'SOPstart' }).first()
    await expect(mark).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login')
    await page.waitForTimeout(3500) // the brandmark and the lead lines have landed
    await shot(page, 'welcome-desktop-entry')
    // Desktop: the brandmark side stays put while the story scrolls.
    const before = await mark.boundingBox()
    await page.mouse.wheel(0, 2500)
    await page.waitForTimeout(500)
    expect((await mark.boundingBox())?.y).toBe(before?.y)
    expect(errors).toEqual([])
  })

  for (const [label, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`HOME-01 every section and module renders and animates in (${label})`, async ({ page }) => {
      test.setTimeout(90_000)
      const errors = watchConsole(page)
      await page.setViewportSize(size)
      await page.goto('/welcome')
      for (const id of STORIES) {
        const s = page.locator(`#${id}`)
        await s.scrollIntoViewIfNeeded()
        await expect(s).toHaveAttribute('data-in', '')
        await page.waitForTimeout(3500) // the example's animation has played out
        await shot(page, `welcome-${label}-${id}`)
        // Animated in: nothing in the section is left invisible.
        const hidden = await s.evaluate((el) => [...el.querySelectorAll('.hp-a')].filter((n) => getComputedStyle(n).opacity !== '1').length)
        expect(hidden, `${id} has elements still hidden`).toBe(0)
      }
      for (const m of MODULES) await expect(page.locator('#modules').getByRole('heading', { name: m, exact: true })).toHaveCount(1)
      await expect(page.getByTestId('enquiries-cta')).toHaveAttribute('href', 'mailto:enquiries@sopstart.com')
      await expect(page.getByText(/founder|Simon Scott|20 years/i)).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `.planning/evals/latest/home-${label}-full.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }
})
