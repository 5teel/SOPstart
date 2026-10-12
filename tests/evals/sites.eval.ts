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

// The areas one level in from the open one (or the top level): clickable and not dimmed.
const next = (page: Page) => page.locator('[data-testid="map-area"][role="button"]:not([data-state="dim"])')
const area = (page: Page, name: string) => page.locator(`[data-testid="map-area"][role="button"][aria-label^="${name},"]`)

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
      await pick(page, 'Visy') // a failed earlier run can leave the session on a demo site
      await expect(page.locator('[data-testid="site-map"] image').first()).toBeVisible(SLOW)
      await shot(page, '70-site-visy')
      for (const [i, name] of DEMO.entries()) {
        await pick(page, name)
        await expect(page.getByTestId('map-area').first()).toBeVisible(SLOW)
        await expect(page.locator('[data-testid="site-map"] image').first()).toBeVisible(SLOW)
        await page.waitForLoadState('networkidle')
        await shot(page, `7${i + 1}-site-${name.split(' ')[0].toLowerCase()}`)
        // ADR-0010: drill in one level at a time until SOPs show (a parent area opens onto its sub-areas).
        for (let depth = 0; depth < 4 && (await page.getByTestId('map-object').count()) === 0; depth++) {
          await next(page).first().dispatchEvent('click') // plates overlap in screen space; a centre click can hit a nearer one
          await page.waitForTimeout(700)
        }
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

  test('SITES-02 a tiered site opens one level at a time, and the packing setting changes the layout', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: process.env.EVAL_BASE_URL })
    const page = await ctx.newPage()
    const errors = watchConsole(page)
    await signInAs(ctx, 'admin')
    const setPacking = async (p: 'balanced' | 'rows') => {
      await page.goto('/?s=manage&view=site')
      const opt = page.locator(`[data-testid="map-packing-option"][data-packing="${p}"]`)
      await expect(opt).toHaveCount(1, SLOW)
      await opt.click()
      await expect(opt).toHaveAttribute('aria-pressed', 'true', SLOW)
      await page.goto('/')
      await expect(page.getByTestId('site-map')).toHaveAttribute('data-packing', p, SLOW)
    }
    try {
      await page.goto('/')
      await pick(page, 'Clearwater Beverages')
      // top level: two parent areas and the warehouse, each signed with what is inside
      await expect(area(page, 'Production Hall')).toHaveCount(1, SLOW)
      await expect(area(page, 'Utilities')).toHaveCount(1)
      await expect(area(page, 'Filling Line')).toHaveCount(0) // a sub-area is not a button until its parent is open
      await area(page, 'Production Hall').dispatchEvent('click')
      await expect(page.getByTestId('map-header')).toContainText('Production Hall', SLOW)
      await expect(area(page, 'Filling Line')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('area-filter')).toContainText('Production Hall')
      await page.waitForTimeout(800)
      await shot(page, '74-tiers-production-hall')
      await area(page, 'Filling Line').dispatchEvent('click')
      await expect(page.getByTestId('map-crumb-area')).toContainText('Production Hall', SLOW)
      await expect(page.getByTestId('map-object').first()).toBeVisible(SLOW)
      await page.waitForTimeout(800)
      await shot(page, '75-tiers-filling-line')
      await page.keyboard.press('Escape') // up one level, not to the whole site
      await expect(page.getByTestId('map-header')).toContainText('Production Hall', SLOW)
      await expect(page.getByTestId('map-crumb-area')).toHaveCount(0)

      // packing is an org setting: Rows, then back to Balanced
      await setPacking('rows')
      await page.waitForTimeout(800)
      await shot(page, '76-tiers-rows')
      await setPacking('balanced')
      await shot(page, '77-tiers-balanced')
    } finally {
      await pick(page, 'Visy').catch(() => {})
      await ctx.close()
    }
    expect(errors).toEqual([])
  })
})
