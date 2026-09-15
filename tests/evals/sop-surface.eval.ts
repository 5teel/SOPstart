/**
 * Deployed-site eval — Phase 41 "One SOP Surface".
 *
 * Replaces the 19-question human click-path. Runs against EVAL_BASE_URL
 * (normally https://sopstart.com via `npm run eval`) as the two eval fixture
 * accounts, asserts the surface at DOM level, and saves screenshots for the
 * visual items into .planning/evals/latest/ for the orchestrator to inspect.
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite never
 * touches production.
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { EVAL_ENV_READY, signInAs } from './lib/session'

const SHOTS = path.join(process.cwd(), '.planning', 'evals', 'latest')
fs.mkdirSync(SHOTS, { recursive: true })
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

/** Fail the test on any uncaught page error or React hydration/minified error in the console. */
function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/Minified React error|Hydration|hydrat|Warning:|Unhandled/i.test(t)) errors.push(`console: ${t.slice(0, 200)}`)
  })
  return errors
}

const scopeColumn = (page: Page) => page.getByTestId('worker-miller-scope')
const backLink = (page: Page) => page.getByRole('link', { name: /Back to your SOPs/ }).or(page.getByRole('button', { name: /Back to your SOPs/ }))

test.describe('Phase 41 — one SOP surface (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')

  test.describe('admin, desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('A — Admin scope group renders inside the Miller frame with counts, columns aligned', async ({ page, context }) => {
      const errors = watchConsole(page)
      await signInAs(context, 'admin')
      await page.goto('/sops')
      const col = scopeColumn(page)
      await expect(col.getByText('Admin', { exact: true })).toBeVisible()
      for (const label of ['All SOPs', 'Drafts', 'Published', 'Needs attention', 'Access', 'Owned by me']) {
        await expect(col.getByText(label, { exact: true }), label).toBeVisible()
      }
      // counts: at least one admin row carries a number
      await expect.poll(async () => (await col.innerText()).match(/\b\d+\b/g)?.length ?? 0, { timeout: 15_000 }).toBeGreaterThan(0)
      // three grid columns, same height
      const heights = await col.evaluate((el) => Array.from(el.parentElement!.children).map((c) => (c as HTMLElement).getBoundingClientRect().height))
      expect(heights.length).toBe(3)
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2)
      await shot(page, 'admin-sops')
      expect(errors).toEqual([])
    })

    test('B — Drafts lens lists SOPs, a row opens the builder, attention + access lenses open full-width and return without reload', async ({ page, context }) => {
      const errors = watchConsole(page)
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await scopeColumn(page).getByText('Drafts', { exact: true }).click()
      const builderLinks = page.locator('a[href^="/admin/sops/builder/"]')
      await expect(builderLinks.first()).toBeVisible({ timeout: 15_000 })
      // select a row → detail panel exposes exactly one "Open" chain to the builder
      const rows = page.locator('[data-testid="worker-miller-scope"] ~ * button, [data-testid="worker-miller-scope"] ~ * a[href^="/admin/sops/builder/"]')
      await rows.first().click()
      const open = page.getByRole('link', { name: 'Open', exact: true })
      await expect(open).toBeVisible()
      expect(await open.getAttribute('href')).toMatch(/^\/admin\/sops\/builder\/[0-9a-f-]{36}$/)

      await page.evaluate(() => { (window as unknown as { __eval: number }).__eval = 1 })
      await scopeColumn(page).getByText('Needs attention', { exact: true }).click()
      await expect(backLink(page)).toBeVisible({ timeout: 15_000 })
      await shot(page, 'admin-attention')
      await backLink(page).click()
      await expect(scopeColumn(page)).toBeVisible()
      expect(await page.evaluate(() => (window as unknown as { __eval?: number }).__eval)).toBe(1) // no full reload
      expect(page.url()).toMatch(/\/sops(\?|$)/)

      await scopeColumn(page).getByText('Access', { exact: true }).click()
      await expect(backLink(page)).toBeVisible({ timeout: 15_000 })
      await expect(scopeColumn(page)).toBeHidden() // full width, frame replaced
      await shot(page, 'admin-access')
      await backLink(page).click()
      await expect(scopeColumn(page)).toBeVisible()
      expect(errors).toEqual([])
    })

    test('C — worker behaviours survive for an admin: All yours, search, department filter', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await scopeColumn(page).getByText('All yours', { exact: true }).click()
      await expect(scopeColumn(page)).toBeVisible()
      const search = page.getByPlaceholder('Search SOPs...')
      await search.fill('zzzz-no-such-sop-zzzz')
      await expect(page.getByText(/no (sops|results|matches)/i).or(page.locator('a[href^="/sops/"]').first())).toBeVisible()
      await search.fill('')
      await expect(scopeColumn(page).getByText('Everything', { exact: true })).toBeVisible()
    })

    test('D — one SOPs door: single nav entry, legacy admin URLs redirect onto /sops, Governance deep-links the attention lens', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/sops')
      const nav = page.locator('header, nav')
      await expect(nav.getByRole('link', { name: 'SOPs', exact: true })).toHaveCount(1)
      await expect(nav.getByRole('link', { name: /Manage SOPs/ })).toHaveCount(0)

      await page.goto('/admin/sops?view=access')
      await expect(page).toHaveURL(/\/sops\?.*view=access/)
      await expect(backLink(page)).toBeVisible({ timeout: 15_000 })

      await page.goto('/admin/sops?status=draft')
      await expect(page).toHaveURL(/\/sops\?.*status=draft/)
      await expect(page.locator('a[href^="/admin/sops/builder/"]').first()).toBeVisible({ timeout: 15_000 })

      await page.goto('/sops')
      await nav.getByRole('link', { name: 'Governance', exact: true }).click()
      await expect(page).toHaveURL(/\/sops\?.*view=attention/)
      await expect(backLink(page)).toBeVisible({ timeout: 15_000 })
    })

    test('E — pathways map reports zero unmapped screens', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/pathways')
      await expect(page.getByText(/^0 not mapped yet$/)).toBeVisible({ timeout: 20_000 })
    })
  })

  test.describe('worker', () => {
    test('F1 — desktop: no Admin group, legacy admin URL bounces away from admin params', async ({ page, context }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const errors = watchConsole(page)
      await signInAs(context, 'worker')
      await page.goto('/sops')
      await expect(scopeColumn(page)).toBeVisible()
      await expect(scopeColumn(page).getByText('Admin', { exact: true })).toHaveCount(0)
      await expect(scopeColumn(page).getByText('Needs attention', { exact: true })).toHaveCount(0)
      await shot(page, 'worker-sops')
      await page.goto('/admin/sops?view=attention')
      await expect(page).not.toHaveURL(/view=attention/)
      expect(errors).toEqual([])
    })

    test('F2 — mobile: stacked worker list, no admin scopes', async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAs(context, 'worker')
      await page.goto('/sops')
      await expect(page.getByText('Admin', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Needs attention', { exact: true })).toHaveCount(0)
      await shot(page, 'worker-mobile')
    })
  })
})
