/**
 * Deployed-site eval — Phase 43 "Dead-Surface Removal & Route Truth".
 *
 * Proves the dead-surface findings this phase fixes are actually
 * live in production, not just source-contract-pinned:
 *   C — the Access map shows the Wiring view only, no Matrix/Illuminate
 *       lens toggle (D-05); the legacy list address's access view lands on
 *       the People section's Access tab (Phase 63)
 *   D1/D2 — the legacy admin list and governance URLs still land on real
 *       places for an admin (the home, Sign-offs), and never open the
 *       Sign-offs inbox for a worker (D-01)
 *
 * C reads the real org (read-only, as `admin`) because the Access map needs
 * a populated org tree to render meaningfully. The pathways 0-not-mapped
 * proof lives in the pathways spec, not here. (Test A, the content-library create form, went with the
 * library in Phase 55.) D1 runs as `siteAdmin`, D2 as `siteWorker`.
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

const SLOW = { timeout: 25_000 }

test.describe('Phase 43 — dead-surface removal (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')
  test.use({ viewport: { width: 1440, height: 900 } })

  test('C — Access map shows the Wiring view only', async ({ page, context }) => {
    await signInAs(context, 'admin')
    const legacyList = '/sops'
    await page.goto(`${legacyList}?view=access`)

    await expect(page).toHaveURL((u) => u.pathname === '/' && u.searchParams.get('tab') === 'access', SLOW)
    await expect(page.getByPlaceholder('Search org or collections…')).toBeVisible(SLOW)
    await expect(page.getByText(/Illuminate/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Matrix/ })).toHaveCount(0)
    await expect(page.getByText(/coming soon/i)).toHaveCount(0)
    await shot(page, 'access-wiring-only')
  })

  test('D1 — legacy /admin/sops and /admin/governance land on real routes', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')

    await page.goto('/admin/sops')
    await expect(page).toHaveURL((u) => u.pathname === '/' && u.search === '', SLOW)

    await page.goto('/admin/governance?filter=no_owner')
    await expect(page).toHaveURL((u) => u.pathname === '/' && u.searchParams.get('s') === 'signoffs', SLOW)
    await expect(page.getByTestId('office-pane')).toBeVisible(SLOW)
  })

  test('D2 — a worker following a legacy governance link never reaches the inbox', async ({ page, context }) => {
    await signInAs(context, 'siteWorker')

    await page.goto('/admin/governance')
    await expect(page).not.toHaveURL(/\/governance/, SLOW)
    await expect(page).toHaveURL((u) => u.pathname === '/', SLOW)
    await expect(page.getByTestId('office-pane')).toHaveCount(0)
    await expect(page.getByTestId('office-row')).toHaveCount(0)
  })
})
