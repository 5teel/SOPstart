/**
 * Deployed-site eval -- Phase 52 "Worker Home: The Plant" (D-16).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) as the eval-site-worker fixture, a worker member of the isolated
 * "SOPstart Eval Site" org (never the shared SOPstart eval org
 * bd2c2b88…), with a PUBLISHED "Eval plant fixture SOP" assigned to it and
 * linked to "EVAL Press".
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production. Provision fixtures first: `node scripts/eval-fixtures.mjs`.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_PLANT_SOP_TITLE, signInAs } from './lib/session'
import { ensurePlantFixture, realOrgHasDrawnSite, shot, watchConsole } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }

async function readWorldTransform(page: Page) {
  const world = page.getByTestId('plant-world')
  const scale = parseFloat((await world.getAttribute('data-scale')) ?? '0')
  const x = parseFloat((await world.getAttribute('data-x')) ?? '0')
  const y = parseFloat((await world.getAttribute('data-y')) ?? '0')
  return { scale, x, y }
}

function closeTo(actual: number, expected: number, tol = 0.01) {
  return Math.abs(actual - expected) <= tol
}

test.describe('Phase 52 — worker plant home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  let db: SupabaseClient
  let plantSopId: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const fixture = await ensurePlantFixture(db)
    plantSopId = fixture.plantSopId
  })

  test('eval-site worker at 1440 sees the scene, a pin on EVAL Press, the Now card, the panel, a chip fit, the ask highlight and the voice dialog — no scope column, no console errors', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteWorker')
    await page.goto('/sops')

    // 1. The scene renders.
    const stage = page.getByTestId('plant-stage')
    await expect(stage).toBeVisible(SLOW)
    await expect
      .poll(async () => stage.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth), SLOW)
      .toBeGreaterThan(0)
    // >=1, not ===1: 54-06's governance.eval.ts permanently added a second
    // machine ("EVAL Oven") to this same eval-site org/layout so it can prove
    // the "machines with no procedures" inbox row -- this eval only needs to
    // know the scene painted at least the one it cares about (EVAL Press,
    // asserted by name below).
    await expect
      .poll(async () => page.getByTestId('plant-machine').count(), { timeout: SLOW.timeout })
      .toBeGreaterThanOrEqual(1)

    // 2. No scope column, no worker list search box -- the plant replaces
    // both. { exact: true } is required: Playwright's default name match is
    // a case-insensitive substring, and "Ask or search SOPs" (PlantAskBar)
    // contains "search SOPs" -- a loose match here would count the ask bar.
    await expect(page.getByTestId('worker-list')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Search SOPs', exact: true })).toHaveCount(0)

    // 3. A pin on EVAL Press.
    const press = page.locator('[data-testid="plant-machine"][data-machine-name="EVAL Press"]')
    await expect(press).toHaveAttribute('data-pin', /^[1-9]\d*$/, { timeout: 45_000 })
    await expect(page.getByTestId('plant-pin').first()).toBeVisible()
    await shot(page, 'plant-home')

    // 4. The Now card.
    const nowCard = page.getByTestId('plant-now-card')
    await expect(nowCard).toBeVisible(SLOW)
    await expect(nowCard).toContainText(EVAL_PLANT_SOP_TITLE)
    await expect(page.getByTestId('plant-now-walk')).toHaveAttribute('href', `/sops/${plantSopId}?tab=walk`)

    // 5. Click the machine -- panel opens, camera flies in.
    const fit = await readWorldTransform(page)
    await press.click()
    const panel = page.getByTestId('plant-panel')
    await expect(panel).toHaveAttribute('data-open', 'true', SLOW)
    const panelRow = panel.getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(panelRow).toBeVisible(SLOW)
    await expect(panelRow.getByTestId('plant-rel-badge')).toHaveAttribute('data-rel', 'never')
    await expect(panelRow.getByTestId('plant-panel-walk')).toHaveAttribute('href', `/sops/${plantSopId}?tab=walk`)
    await expect
      .poll(async () => {
        const s = (await readWorldTransform(page)).scale
        return closeTo(s, 1.5) && !closeTo(s, fit.scale)
      }, SLOW)
      .toBe(true)
    await shot(page, 'plant-home-panel')

    // 6. Close -- camera returns to fit.
    await page.getByTestId('plant-panel-close').click()
    await expect(panel).toHaveAttribute('data-open', 'false', SLOW)
    await expect
      .poll(async () => closeTo((await readWorldTransform(page)).scale, fit.scale), SLOW)
      .toBe(true)

    // 7. Department chip fits the camera to the zone.
    await page.getByTestId('plant-zone-chip').filter({ hasText: 'Forming' }).click()
    await expect
      .poll(async () => {
        const t = await readWorldTransform(page)
        return !closeTo(t.scale, fit.scale) || !closeTo(t.x, fit.x) || !closeTo(t.y, fit.y)
      }, SLOW)
      .toBe(true)
    await shot(page, 'plant-home-zone')
    await page.getByTestId('plant-zone-chip').filter({ hasText: 'Whole site' }).click()

    // 8. Ask bar highlights matching machines.
    const ask = page.getByTestId('plant-ask')
    await ask.fill('press')
    await expect(press).toHaveAttribute('data-highlighted', 'true', SLOW)
    await ask.fill('zzzz-no-match')
    await expect(page.locator('[data-testid="plant-machine"][data-highlighted="true"]')).toHaveCount(0)
    await ask.fill('plant fixture')
    await expect(press).toHaveAttribute('data-highlighted', 'true', SLOW)
    await shot(page, 'plant-home-ask')
    await ask.fill('')

    // 9. Voice dialog opens and closes (the token is only fetched on mic press
    // inside the modal, so opening here never starts the microphone).
    await page.getByTestId('plant-ask-mic').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await shot(page, 'plant-home-voice')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // 10. Show me reopens the panel on the Now card's machine.
    await page.getByTestId('plant-now-show').click()
    await expect(panel).toHaveAttribute('data-open', 'true', SLOW)
    await expect(panel).toContainText('EVAL Press')

    // 11. No console errors across the whole flow.
    expect(errors).toEqual([])
  })

  test('a worker whose org has no site still sees the list', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Fallback proof needs a real-org account whose org has NO drawn site.
    // If Simon has drawn one at /admin/site since this eval last ran, the
    // list branch is unreachable with this account -- skip rather than fail.
    const hasDrawnSite = await realOrgHasDrawnSite(db)
    test.skip(hasDrawnSite, 'real SOPstart org now has a drawn site — fallback not reachable with eval-worker')

    await signInAs(context, 'worker')
    await page.goto('/sops')
    await expect(page.getByTestId('worker-list')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-stage')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Search SOPs', exact: true })).toBeVisible()
    await shot(page, 'plant-home-fallback')
  })
})
