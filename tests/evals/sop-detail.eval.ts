/**
 * Deployed-site eval — the SOP page as one document (2026-09-27).
 *
 * Fixture SOP: OTG Probe Maintenance (SOP-0068A), published, four procedures
 * (Pickup Lens 6 · Laser 13 · Mirror Cleaning 6 · Alignment 15) plus five
 * step-less reference sections — the shape that exposed every defect:
 * "Step 1 of 40", duplicated STEP 1 tool pills, an empty safety gate.
 *
 * Runs against EVAL_BASE_URL only (see sop-surface.eval.ts for the pattern).
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { EVAL_ENV_READY, signInAs } from './lib/session'

const SHOTS = path.join(process.cwd(), '.planning', 'evals', 'latest')
fs.mkdirSync(SHOTS, { recursive: true })
async function shot(page: Page, name: string, fullPage = false) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage })
}
const SLOW = { timeout: 25_000 }
const OTG = '/sops/125cf9f1-547e-4cc6-8baf-813d9236a691'

test.describe('SOP page — one document, one job (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')

  test('worker, desktop: Orient → Prepare → Do, one job at a time, no admin chrome', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signInAs(context, 'worker')
    await page.goto(OTG)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1, name: /OTG Probe Maintenance/ })).toBeVisible(SLOW)

    // Orient: the scope text leads, the four jobs are offered
    await expect(main.getByText(/Which job are you doing/)).toBeVisible()
    const chips = page.getByTestId('job-chip')
    await expect(chips).toHaveCount(4)
    await expect(chips.first()).toHaveAttribute('aria-checked', 'true')

    // Prepare: safety requirements are real content with an inline acknowledgement; tools are per job, no STEP 1 pills
    await expect(main.getByText(/Before you start/)).toBeVisible()
    await expect(main.getByText(/class II visible red laser/)).toBeVisible()
    await expect(page.getByTestId('safety-acknowledge')).toBeVisible()
    await expect(page.getByTestId('job-tools')).toContainText('Pickup Lens (OTG-2-43)')
    await expect(main.getByText(/^STEP 1$/i)).toHaveCount(0)

    // Do: the job's steps are IN the document, numbered within the job
    const steps = page.getByTestId('job-steps').locator('li')
    await expect(steps).toHaveCount(6)
    await expect(steps.first()).toContainText('Disconnect the power cable')

    // No admin chrome for a worker: no Flow tab, no Desktop/Mobile toggle
    await expect(page.getByRole('tab', { name: /Flow/i }).or(page.locator('header').getByText('FLOW'))).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Preview viewport' })).toHaveCount(0)
    await shot(page, 'sop-read-desktop', true)

    // Pick a different job: tools and steps follow it, and the URL carries it
    await chips.nth(2).click() // Mirror Cleaning
    await expect(page.getByTestId('job-tools')).toContainText('Q-tips')
    await expect(page.getByTestId('job-tools')).not.toContainText('Pickup Lens')
    await expect(steps).toHaveCount(6)
    expect(page.url()).toMatch(/[?&]job=[0-9a-f-]{36}/)

    // Acknowledge safety inline, then Walk it walks THIS job only, with no gate in the way
    await page.getByTestId('safety-acknowledge').click()
    await expect(page.getByTestId('safety-acknowledged')).toBeVisible()
    await page.getByTestId('walk-it').click()
    await expect(page.getByTestId('step-counter')).toContainText(/Step 1 of 6/i, SLOW)
    await expect(page.getByTestId('step-counter')).toContainText(/Mirror Cleaning/i)
    await expect(page.getByText('Before you start')).toHaveCount(0)
    await shot(page, 'sop-walk-desktop')
  })

  test('worker, phone: same document, glove-sized job chooser and Walk it', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAs(context, 'worker')
    await page.goto(OTG)
    await expect(page.getByTestId('job-chip')).toHaveCount(4, SLOW)
    await expect(page.getByTestId('job-steps').locator('li')).toHaveCount(6)
    await shot(page, 'sop-read-mobile', true)
    await page.getByTestId('job-chip').nth(1).click() // Laser Replacement
    await expect(page.getByTestId('job-steps').locator('li')).toHaveCount(13)
    await page.getByTestId('walk-it').click()
    await expect(page.getByText(/Step 1 of 13|STEP 1\/13/i).first()).toBeVisible(SLOW)
    await shot(page, 'sop-walk-mobile')
  })

  test('admin keeps the preview toggle and the Flow tab', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signInAs(context, 'admin')
    await page.goto(OTG)
    await expect(page.getByRole('group', { name: 'Preview viewport' })).toBeVisible(SLOW)
    await expect(page.locator('header').getByText(/^Flow$/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Edit in builder/ })).toBeVisible()
  })
})
