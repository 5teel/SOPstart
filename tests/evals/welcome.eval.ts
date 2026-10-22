/**
 * Deployed-site eval: the signed-out homepage at /welcome.
 *
 * Signed out (no session minted, so no OTP budget spent). Proves the root sends a
 * visitor to the homepage; the page is one screen (no vertical scroll); the
 * slides change on their own and stop once the visitor takes over; the Send us 3 SOPs offer opens the enquiries address; privacy and terms are public; every slide
 * fits its screen at desktop and phone size; no Potenco and no founder details.
 * One screenshot per slide, read by eye.
 *
 * Self-skips when EVAL_BASE_URL is unset.
 */
import { test, expect, type Page } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'
import { shot, watchConsole } from './lib/plant-fixture'

const SLIDES = ['intro', 'how', 'accessible', 'accountable', 'audit', 'modules', 'founding']
const current = (page: Page) => page.locator('[data-testid="slide"][data-in]')
const noPageScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)

test.describe('homepage', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL not set')

  test('a signed-out visit to / lands on the homepage, which changes slides on its own until touched', async ({ page }) => {
    test.setTimeout(60_000)
    const errors = watchConsole(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    // The story arrives after the wordmark's two words have joined, before its tape is done.
    await page.waitForTimeout(1000)
    expect(Number(await page.locator('main').evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.1)
    await page.screenshot({ path: '.planning/evals/latest/welcome-desktop-joining.png' })
    await expect(page.getByRole('img', { name: 'SOPstart' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login')
    await expect(current(page)).toHaveAttribute('id', 'intro')
    await page.waitForTimeout(3500) // the wordmark has gathered and its tape swept in
    await shot(page, 'welcome-desktop-entry')
    expect(await noPageScroll(page)).toBe(true)
    // Autoplay moves on by itself.
    await expect(current(page)).toHaveAttribute('id', 'how', { timeout: 15_000 })
    // A manual pick stops it.
    await page.getByTestId('slide-dot').nth(4).click()
    await expect(current(page)).toHaveAttribute('id', 'audit')
    await page.waitForTimeout(11_000)
    await expect(current(page)).toHaveAttribute('id', 'audit')
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
    await expect(page.getByText(/Potenco|founder|Simon Scott/i)).toHaveCount(0)
    // The offer opens the enquiries address with its own subject line.
    await page.getByTestId('offer').click()
    await expect(page.getByTestId('offer-popover')).toBeVisible()
    await expect(page.getByTestId('offer-email')).toHaveAttribute('href', /^mailto:enquiries@sopstart\.com\?subject=/)
    await shot(page, 'welcome-desktop-offer')
    await page.keyboard.press('Escape')
    expect(errors).toEqual([])
  })

  test('the privacy and terms pages are public', async ({ page }) => {
    for (const [path, heading] of [['/privacy', 'Privacy'], ['/terms', 'Terms of use']] as const) {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(path + '$'))
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await shot(page, 'welcome-legal' + path.replace('/', '-'))
    }
  })

  for (const [label, size] of [
    ['desktop', { width: 1440, height: 900 }],
    ['laptop', { width: 1280, height: 720 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`HOME-01 every slide fits one screen (${label})`, async ({ page }) => {
      test.setTimeout(90_000)
      const errors = watchConsole(page)
      await page.setViewportSize(size)
      await page.goto('/welcome')
      const dots = page.getByTestId('slide-dot')
      await expect(dots).toHaveCount(SLIDES.length)
      for (const [i, id] of SLIDES.entries()) {
        await dots.nth(i).click()
        const s = current(page)
        await expect(s).toHaveAttribute('id', id)
        await page.waitForTimeout(3800) // the example's animation has played out
        await shot(page, `welcome-${label}-${i + 1}-${id}`)
        const [overflow, hidden] = await s.evaluate((el) => {
          const box = el.getBoundingClientRect()
          const shown = [...el.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().width > 0)
          return [
            shown.filter((n) => n.getBoundingClientRect().bottom > box.bottom + 1 || n.getBoundingClientRect().top < box.top - 1).length,
            shown.filter((n) => n.classList.contains('hp-a') && getComputedStyle(n).opacity !== '1').length,
          ]
        })
        expect(overflow, `${id} is cut off at ${label} size`).toBe(0)
        expect(hidden, `${id} has elements still hidden`).toBe(0)
        expect(await noPageScroll(page), `${id} scrolls the page at ${label} size`).toBe(true)
      }
      expect(errors).toEqual([])
    })
  }
})
