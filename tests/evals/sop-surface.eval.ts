/**
 * Deployed-site eval — Phase 54 "Admin — Inbox, Floor Health, Library Table".
 *
 * Replaces the Phase 41 Miller/scope-column eval: admin `/sops` is now a
 * plain checks table (AdminLibraryTable), the attention lens moved to its
 * own route (/governance), and the worker desktop/mobile fallback is
 * WorkerSimpleList (no Miller frame anywhere — D-09/D-10). Runs against
 * EVAL_BASE_URL (normally https://sopstart.com via `npm run eval`) as the
 * two real-org eval fixture accounts, asserts the surface at DOM level, and
 * saves screenshots for the visual items into .planning/evals/latest/.
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production.
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
const table = (page: Page) => page.getByTestId('library-table')
const rows = (page: Page) => page.getByTestId('lib-row')

test.describe('Phase 54 — admin library table + worker fallback (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')

  test.describe('admin, desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('A — library table: checks row, one builder chain per row, header/search', async ({ page, context }) => {
      const errors = watchConsole(page)
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await expect(table(page)).toBeVisible(SLOW)
      await expect(rows(page).first()).toBeVisible(SLOW)

      const firstChecks = rows(page).first().getByTestId('lib-check')
      await expect(firstChecks).toHaveCount(5)
      const states = await firstChecks.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
      expect(states.every((s) => s === 'ok' || s === 'warn' || s === 'bad')).toBe(true)

      // Never spell a deleted testid here — the deletion sweep scans evals
      // too. Assert the retired scope-column text is gone instead.
      await expect(page.getByText('Needs attention', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Show', { exact: true })).toHaveCount(0)

      await expect(page.getByRole('searchbox', { name: 'Search SOPs' })).toBeVisible()

      const firstTitleLink = rows(page).first().locator('a[href^="/sops/"]').first()
      expect(await firstTitleLink.getAttribute('href')).toMatch(/^\/sops\/[0-9a-f-]{36}$/)
      const firstEdit = rows(page).first().getByTestId('lib-edit')
      expect(await firstEdit.getAttribute('href')).toMatch(/^\/admin\/sops\/builder\/[0-9a-f-]{36}$/)

      const rowCount = await rows(page).count()
      await expect(page.locator('a[href^="/admin/sops/builder/"]')).toHaveCount(rowCount) // one chain per row

      await expect(page.locator('header').getByRole('link', { name: 'SOPs', exact: true })).toHaveCount(1)
      await shot(page, 'admin-library')
      expect(errors).toEqual([])
    })

    test('B — chips narrow the table and resolve deep links', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await expect(table(page)).toBeVisible(SLOW)

      await page.getByTestId('lib-chip-status').selectOption('DRAFT')
      await expect
        .poll(async () => {
          const statuses = await page.getByTestId('lib-status').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))
          return statuses.length > 0 && statuses.every((s) => s === 'DRAFT')
        }, SLOW)
        .toBe(true)

      await page.goto('/sops?status=draft')
      await expect(table(page)).toBeVisible(SLOW)
      await expect(page.getByTestId('lib-chip-status')).toHaveValue('DRAFT')
      const statuses = await page.getByTestId('lib-status').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))
      expect(statuses.every((s) => s === 'DRAFT')).toBe(true)

      await page.goto('/sops?owner=me')
      await expect(table(page)).toBeVisible(SLOW)
      await expect(page.getByTestId('lib-chip-owner')).toHaveValue('me')

      await page.goto('/sops')
      await expect(table(page)).toBeVisible(SLOW)
      const search = page.getByRole('searchbox', { name: 'Search SOPs' })
      await search.fill('zzzz-no-such-sop')
      await expect(page.getByText('No SOPs match these filters.')).toBeVisible(SLOW)
      await shot(page, 'admin-library-filtered')
      await search.fill('')
    })

    test('C — Access lens opens full-width and returns without a reload', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await expect(table(page)).toBeVisible(SLOW)

      await page.evaluate(() => { (window as unknown as { __eval: number }).__eval = 1 })
      await page.getByTestId('lib-access').click()
      const back = page.getByRole('button', { name: /Back to your SOPs/ })
      await expect(back).toBeVisible(SLOW)
      await expect(page.getByRole('heading', { name: /Whole site/i })).toBeVisible(SLOW)
      await expect(table(page)).toBeHidden()
      await shot(page, 'admin-access')

      await back.click()
      await expect(table(page)).toBeVisible(SLOW)
      expect(await page.evaluate(() => (window as unknown as { __eval?: number }).__eval)).toBe(1) // no full reload

      await page.goto('/sops?view=access')
      await expect(page.getByRole('button', { name: /Back to your SOPs/ })).toBeVisible(SLOW)
    })

    test('D — legacy governance URLs land on /governance; legacy status URL keeps resolving onto the table', async ({ page, context }) => {
      await signInAs(context, 'admin')

      await page.goto('/admin/sops?view=attention')
      await expect(page).toHaveURL(/\/governance$/)
      await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)

      await page.goto('/sops?view=attention')
      await expect(page).toHaveURL(/\/governance$/)
      await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)
      await shot(page, 'admin-governance')

      await page.goto('/admin/governance')
      await expect(page).toHaveURL(/\/governance$/)
      await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)

      await page.goto('/admin/sops?status=draft')
      await expect(page).toHaveURL(/\/sops\?.*status=draft/)
      await expect(table(page)).toBeVisible(SLOW)
    })

    test('E — pathways map reports zero unmapped screens', async ({ page, context }) => {
      await signInAs(context, 'admin')
      await page.goto('/pathways')
      await page.getByRole('button', { name: /All screens/ }).click()
      await expect(page.getByText(/^0 not mapped yet$/)).toBeVisible(SLOW)
    })
  })

  test.describe('worker', () => {
    test('F1 — desktop: no library table, no Governance link, worker list or plant', async ({ page, context }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const errors = watchConsole(page)
      await signInAs(context, 'worker')
      await page.goto('/sops')
      await expect(table(page)).toHaveCount(0)
      await expect(page.locator('header').getByRole('link', { name: 'Governance', exact: true })).toHaveCount(0)

      const list = page.getByTestId('worker-list')
      const door = page.getByRole('button', { name: /Browse the library/ })
      await expect(list.or(door)).toBeVisible(SLOW)
      await shot(page, 'worker-sops')
      if (await door.isVisible()) {
        await door.click()
        await expect(list).toBeVisible(SLOW)
      }
      const row = page.getByTestId('worker-list-row').first()
      if (await row.isVisible().catch(() => false)) {
        await expect(
          row
            .getByRole('button', { name: /Add to your SOPs/ })
            .or(row.getByRole('button', { name: /Remove from your SOPs/ }))
            .or(row.getByRole('button', { name: /Ask to be taken off this/ }))
        ).toBeVisible()
      }

      await page.goto('/admin/sops?view=attention')
      await expect(page).not.toHaveURL(/\/governance$/)
      expect(errors).toEqual([])
    })

    test('F2 — mobile: no library table, no Governance link', async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAs(context, 'worker')
      await page.goto('/sops')
      await expect(table(page)).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Governance', exact: true })).toHaveCount(0)
      await shot(page, 'worker-mobile')
    })

    test('F3 — admin on a phone renders no library table (an admin on a phone is a worker, D-07)', async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAs(context, 'admin')
      await page.goto('/sops')
      await expect(table(page)).toHaveCount(0)
      const list = page.getByTestId('worker-list').or(page.getByTestId('phone-home'))
      await expect(list).toBeVisible(SLOW)
      await shot(page, 'admin-mobile')
    })
  })
})
