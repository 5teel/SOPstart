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
 *
 * DOM facts (probed 2026-09-15): desktop rows are `li > button` inside the
 * Miller frame; the only list→builder chain is the "Open" link in the detail
 * pane after a row is selected; mobile rows are `a[href^=/admin/sops/builder]`
 * with `lg:hidden`. Admin status lenses span two grid columns (`lg:col-span-2`),
 * so the frame has 2 children under an admin status scope and 3 under a worker
 * scope. Server actions take 2–5 s on prod — wait generously.
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { EVAL_ENV_READY, signInAs } from './lib/session'

const SHOTS = path.join(process.cwd(), '.planning', 'evals', 'latest')
fs.mkdirSync(SHOTS, { recursive: true })
async function shot(page: Page, name: string) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

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

const SLOW = { timeout: 25_000 }
const scopeColumn = (page: Page) => page.getByTestId('worker-miller-scope')
const frame = (page: Page) => scopeColumn(page).locator('..')
const rows = (page: Page) => frame(page).locator('li > button')
const backLink = (page: Page) => page.getByRole('link', { name: /Back to your SOPs/ }).or(page.getByRole('button', { name: /Back to your SOPs/ }))

test.describe('Phase 41 — one SOP surface (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')

  test.describe('admin, desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('A — Admin scope group renders inside the Miller frame with counts, one department group, columns aligned', async ({ page, context }) => {
      const errors = watchConsole(page)
      await signInAs(context, 'admin')
      await page.goto('/sops')
      const col = scopeColumn(page)
      await expect(col.getByText('Admin', { exact: true })).toBeVisible()
      for (const label of ['All SOPs', 'Drafts', 'Published', 'Needs attention', 'Access', 'Owned by me']) {
        await expect(col.getByText(label, { exact: true }), label).toBeVisible()
      }
      await expect(rows(page).first()).toBeVisible(SLOW)
      // counts next to the admin rows
      await expect.poll(async () => (await col.innerText()).match(/All SOPs\s*\d+/) !== null, SLOW).toBe(true)
      // exactly one "By department" group — two identical headers was the 2026-09-15 defect
      await expect(col.getByText('By department', { exact: true })).toHaveCount(1)
      // grid columns share one height
      const heights = await col.evaluate((el) => Array.from(el.parentElement!.children).map((c) => (c as HTMLElement).getBoundingClientRect().height))
      expect(heights.length).toBeGreaterThanOrEqual(2)
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2)
      await shot(page, 'admin-sops')
      expect(errors).toEqual([])
    })

    test('B — Drafts lens lists SOPs, a selected row exposes one Open→builder chain, attention + access lenses take over full-width and return without reload', async ({ page, context }) => {
      const errors = watchConsole(page)
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await scopeColumn(page).getByText('Drafts', { exact: true }).click()
      await expect(rows(page).first()).toBeVisible(SLOW)
      await rows(page).first().click()
      const open = page.getByRole('link', { name: 'Open', exact: true })
      await expect(open).toBeVisible(SLOW)
      expect(await open.getAttribute('href')).toMatch(/^\/admin\/sops\/builder\/[0-9a-f-]{36}$/)
      await expect(page.locator('a[href^="/admin/sops/builder/"]:visible')).toHaveCount(1) // one chain, not two

      await page.evaluate(() => { (window as unknown as { __eval: number }).__eval = 1 })
      await scopeColumn(page).getByText('Needs attention', { exact: true }).click()
      await expect(backLink(page)).toBeVisible(SLOW)
      await shot(page, 'admin-attention')
      await backLink(page).click()
      await expect(scopeColumn(page)).toBeVisible(SLOW)
      expect(await page.evaluate(() => (window as unknown as { __eval?: number }).__eval)).toBe(1) // no full reload
      expect(page.url()).toMatch(/\/sops(\?|$)/)

      await scopeColumn(page).getByText('Access', { exact: true }).click()
      await expect(backLink(page)).toBeVisible(SLOW)
      await expect(scopeColumn(page)).toBeHidden() // full width, frame replaced
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 45_000 }) // data settled (~3 s on prod)
      await expect(page.getByText(/Whole site/i)).toBeVisible()
      await shot(page, 'admin-access')
      await backLink(page).click()
      await expect(scopeColumn(page)).toBeVisible(SLOW)
      expect(errors).toEqual([])
    })

    test('C — worker behaviours survive for an admin: All yours scope, search overlay, department filter', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await scopeColumn(page).getByText('All yours', { exact: true }).click()
      await expect(scopeColumn(page).getByText('All departments', { exact: true })).toBeVisible(SLOW)
      await expect(scopeColumn(page).getByText('By department', { exact: true })).toHaveCount(1)
      await page.getByRole('button', { name: 'Search SOPs' }).click()
      const search = page.getByPlaceholder('Search SOPs...')
      await expect(search).toBeVisible()
      await search.fill('forming')
      await page.waitForTimeout(500)
      await page.keyboard.press('Escape')
      await scopeColumn(page).getByText('Everything', { exact: true }).click()
      await expect(page.getByTestId('worker-miller-row').first()).toBeVisible(SLOW)
    })

    test('D — one SOPs door: single nav entry, legacy admin URLs redirect onto /sops, Governance deep-links the attention lens', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/sops')
      const nav = page.locator('header')
      await expect(nav.getByRole('link', { name: 'SOPs', exact: true })).toHaveCount(1)
      await expect(nav.getByRole('link', { name: /Manage SOPs/ })).toHaveCount(0)

      await page.goto('/admin/sops?view=access')
      await expect(page).toHaveURL(/\/sops\?.*view=access/)
      await expect(backLink(page)).toBeVisible(SLOW)

      await page.goto('/admin/sops?status=draft')
      await expect(page).toHaveURL(/\/sops\?.*status=draft/)
      await expect(rows(page).first()).toBeVisible(SLOW)

      await page.goto('/sops')
      await nav.getByRole('link', { name: 'Governance', exact: true }).click()
      await expect(page).toHaveURL(/\/sops\?.*view=attention/)
      await expect(backLink(page)).toBeVisible(SLOW)
    })

    test('E — pathways map reports zero unmapped screens', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/pathways')
      await page.getByRole('button', { name: /All screens/ }).click()
      await expect(page.getByText(/^0 not mapped yet$/)).toBeVisible(SLOW)
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
