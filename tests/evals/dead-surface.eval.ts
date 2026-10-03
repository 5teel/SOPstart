/**
 * Deployed-site eval — Phase 43 "Dead-Surface Removal & Route Truth".
 *
 * Proves the four dead-surface findings this phase fixes are actually
 * live in production, not just source-contract-pinned:
 *   A — /admin/blocks "New block" opens a real create form (D-03)
 *   C — the Access map (/sops?view=access) shows the Wiring view only,
 *       no Matrix/Illuminate lens toggle (D-05)
 *   D1/D2 — the legacy /admin/sops and /admin/governance URLs still land
 *       on real routes for an admin, and never leak the governance inbox
 *       to a worker (D-01)
 *
 * A and B run as `siteAdmin` in the isolated eval-site org, so test A's
 * create-and-archive round trip never writes to the real SOPstart org. C
 * reads the real org (read-only, as `admin`) because the Access map needs
 * a populated org tree to render meaningfully. The pathways 0-not-mapped
 * proof already lives in tests/evals/sop-surface.eval.ts test E — not
 * duplicated here. D1 runs as `siteAdmin`, D2 as `siteWorker`.
 *
 * Self-skips without EVAL_BASE_URL — the normal suite never touches
 * production. Run via `npm run eval -- --phase 43`.
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

test.describe('Phase 43 — dead-surface removal (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')
  test.use({ viewport: { width: 1440, height: 900 } })

  test('A — New block opens the create form, creates an item, and archives it', async ({ page, context }) => {
    const errors = watchConsole(page)
    await signInAs(context, 'siteAdmin')

    await page.goto('/admin/blocks')
    await page.getByRole('link', { name: 'New block' }).click()
    await expect(page).toHaveURL(/\/admin\/blocks\/new$/, SLOW)
    await expect(page.getByRole('heading', { name: 'New content' })).toBeVisible(SLOW)
    await expect(page.getByText('This page has moved or no longer exists.')).toHaveCount(0)
    await shot(page, 'new-block-form')

    const name = `EVAL content ${Date.now()}`
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByRole('radio', { name: 'Hazard' }).check()
    await page.getByLabel('Text', { exact: true }).fill('Eval-created hazard content — safe to archive.')
    await page.getByRole('button', { name: 'Create' }).click()

    await expect(page).toHaveURL(/\/admin\/blocks\/[0-9a-f-]{36}$/, SLOW)
    await expect(page.getByRole('heading', { name })).toBeVisible(SLOW)
    await shot(page, 'new-block-created')

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Archive block' }).click()
    await expect(page).toHaveURL(/\/admin\/blocks$/, SLOW)
    await expect(page.getByText(name)).toHaveCount(0)

    expect(errors).toEqual([])
  })

  test('C — Access map shows the Wiring view only', async ({ page, context }) => {
    await signInAs(context, 'admin')
    await page.goto('/sops?view=access')

    await expect(page.getByRole('button', { name: 'Back to your SOPs' })).toBeVisible(SLOW)
    await expect(page.getByPlaceholder('Search org or collections…')).toBeVisible(SLOW)
    await expect(page.getByText(/Illuminate/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Matrix/ })).toHaveCount(0)
    await expect(page.getByText(/coming soon/i)).toHaveCount(0)
    await shot(page, 'access-wiring-only')
  })

  test('D1 — legacy /admin/sops and /admin/governance land on real routes', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')

    await page.goto('/admin/sops')
    await expect(page).toHaveURL(/\/sops$/, SLOW)

    await page.goto('/admin/governance?filter=no_owner')
    await expect(page).toHaveURL(/\/governance(\?.*)?$/, SLOW)
    await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)
  })

  test('D2 — a worker following a legacy governance link never reaches the inbox', async ({ page, context }) => {
    await signInAs(context, 'siteWorker')

    await page.goto('/admin/governance')
    await expect(page).not.toHaveURL(/\/governance/, SLOW)
    await expect(page).toHaveURL(/\/sops/, SLOW)
    await expect(page.getByTestId('gov-inbox')).toHaveCount(0)
  })
})
