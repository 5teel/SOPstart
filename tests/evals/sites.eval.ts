/**
 * Deployed-site eval -- switchable sites (2026-10-11, ADR-0009). eval-admin is an admin of Visy and
 * the three demo sites (scripts/seed-demo-orgs.mjs). The account panel's site picker moves the
 * session into each demo site; each site map draws with its pictures; the run always ends back on
 * Visy, because every other eval expects eval-admin there. Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type Page } from '@playwright/test'
import { EVAL_ENV_READY, signInAs } from './lib/session'
import { shot, watchConsole } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }
const DEMO = ['Southern Rail Track Services', 'Kōwhai Electrical Trades School', 'Clearwater Beverages']

async function pick(page: Page, name: string) {
  const sw = page.getByTestId('home-menu').getByTestId('site-switch')
  await expect(sw).toHaveCount(1, SLOW)
  await sw.selectOption({ label: name })
  await expect(page.getByTestId('map-header')).toContainText(`${name} · site map`, SLOW)
}

test.describe('Switchable sites', () => {
  test.skip(!EVAL_ENV_READY, 'needs EVAL_BASE_URL and Supabase env')

  test('SITES-01 the account panel switches between Visy and the three demo sites, each with its pictured map', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: process.env.EVAL_BASE_URL })
    const page = await ctx.newPage()
    const errors = watchConsole(page)
    await signInAs(ctx, 'admin')
    try {
      await page.goto('/')
      const sw = page.getByTestId('home-menu').getByTestId('site-switch')
      await expect(sw).toHaveCount(1, SLOW)
      for (const n of ['Visy', ...DEMO]) await expect(sw.locator('option', { hasText: n })).toHaveCount(1)
      await expect(page.getByTestId('map-header')).toContainText('Visy · site map', SLOW)
      await expect(page.locator('[data-testid="site-map"] image').first()).toBeVisible(SLOW)
      await shot(page, '70-site-visy')
      for (const [i, name] of DEMO.entries()) {
        await pick(page, name)
        await expect(page.getByTestId('map-area').first()).toBeVisible(SLOW)
        await expect(page.locator('[data-testid="site-map"] image').first()).toBeVisible(SLOW)
        await page.waitForLoadState('networkidle')
        await shot(page, `7${i + 1}-site-${name.split(' ')[0].toLowerCase()}`)
        await page.getByTestId('map-area').first().click()
        await expect(page.getByTestId('map-object').first()).toBeVisible(SLOW)
        await page.waitForTimeout(800)
        await shot(page, `7${i + 1}-site-${name.split(' ')[0].toLowerCase()}-area`)
      }
    } finally {
      await pick(page, 'Visy')
      await ctx.close()
    }
    expect(errors).toEqual([])
  })
})
