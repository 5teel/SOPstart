/**
 * Deployed-site eval -- Phase 53 "Phone: Scan or Ask" (D-12).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) at 390x844 as the eval-site worker/admin fixtures, plus the
 * real-org eval-worker (no site). Provision fixtures first:
 * `node scripts/eval-fixtures.mjs`.
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_BASE_URL, EVAL_PLANT_SOP_TITLE, signInAs } from './lib/session'
import { ensurePlantFixture, realOrgHasDrawnSite, shot, watchConsole } from './lib/plant-fixture'

const SLOW = { timeout: 30_000 }

declare global {
  interface Window {
    __evalMarker?: boolean
  }
}

test.describe('Phase 53 — phone home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  let db: SupabaseClient
  let plantSopId: string
  let pressId: string
  let pressCode: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const fixture = await ensurePlantFixture(db)
    plantSopId = fixture.plantSopId
    pressId = fixture.pressId
    pressCode = fixture.pressCode
  })

  test('eval-site worker at 390×844: ask bar, Now card, floor picture, Scan → machine sheet lists EVAL Press under Forming → /m/<code> → Walk it', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteWorker')
    await page.goto('/sops')

    // 1. The phone home renders -- ask bar, no scene renderer, no toolbar search.
    await expect(page.getByTestId('phone-home')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-ask')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-stage')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Search SOPs', exact: true })).toHaveCount(0)

    // 2. The Now card (no Show me) shows the fixture SOP once the worker's
    // first sync completes.
    const nowCard = page.getByTestId('plant-now-card')
    await expect(nowCard).toContainText(EVAL_PLANT_SOP_TITLE, { timeout: 45_000 })
    await expect(page.getByTestId('plant-now-walk')).toHaveAttribute('href', `/sops/${plantSopId}?tab=walk`)
    await expect(page.getByTestId('plant-now-read')).toHaveAttribute('href', `/sops/${plantSopId}`)
    await expect(page.getByTestId('plant-now-show')).toHaveCount(0)

    // 3. The floor thumbnail is a real image.
    const thumb = page.getByTestId('phone-thumb')
    await thumb.scrollIntoViewIfNeeded()
    await expect
      .poll(async () => thumb.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth), SLOW)
      .toBeGreaterThan(0)

    // 4. The Scan button is a real glove-sized target.
    const scanButton = page.getByTestId('phone-scan')
    await expect(scanButton).toBeVisible(SLOW)
    await expect.poll(async () => (await scanButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(60)

    await expect(page.getByText('Everything else')).toBeVisible()
    await shot(page, 'phone-home')

    // 5. Tap the thumbnail -- the machine sheet lists EVAL Press under Forming.
    await thumb.click()
    const sheet = page.getByTestId('machine-sheet')
    await expect(sheet).toBeVisible(SLOW)
    const pressRow = sheet.locator(
      'xpath=//div[@data-testid="machine-sheet-group" and @data-department-name="Forming"]/parent::div//*[@data-testid="machine-sheet-row" and @data-machine-name="EVAL Press"]'
    )
    await expect(pressRow).toHaveAttribute('data-pin', /^[1-9]\d*$/, { timeout: 45_000 })
    await expect(pressRow).toHaveAttribute('href', `/m/${pressCode}`)
    await shot(page, 'phone-machine-sheet')

    // 6. Tapping the row is a client-side navigation, not a full reload.
    await page.evaluate(() => {
      window.__evalMarker = true
    })
    await pressRow.click()
    await expect(page).toHaveURL(new RegExp(`/m/${pressCode}$`))
    expect(await page.evaluate(() => window.__evalMarker)).toBe(true)

    await expect(page.getByTestId('machine-view')).toBeVisible(SLOW)
    const panel = page.getByTestId('plant-panel')
    await expect(panel).toContainText('EVAL Press')
    await expect(panel).toContainText('Forming')
    const panelRow = panel.getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(panelRow.getByTestId('plant-rel-badge')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('plant-panel-close')).toHaveCount(0)
    const walkLink = panelRow.getByTestId('plant-panel-walk')
    await expect(walkLink).toHaveAttribute('href', `/sops/${plantSopId}?tab=walk`)
    await shot(page, 'phone-machine')

    // 7. Walk › takes the worker into the walkthrough.
    await walkLink.click()
    await expect(page).toHaveURL(new RegExp(`/sops/${plantSopId}\\?tab=walk$`))

    expect(errors).toEqual([])
  })

  test('Scan with no camera falls back to typing the code, which opens /m/<code>', async ({ page, context }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteWorker')
    await page.goto('/sops')

    await page.getByTestId('phone-scan').click()
    const sheet = page.getByTestId('scan-sheet')
    await expect(sheet).toBeVisible(SLOW)
    // The eval context is never granted camera permission, so getUserMedia
    // rejects and the sheet falls straight to the code-entry field -- the
    // real denied path, not a simulated one.
    const codeEntry = page.getByTestId('scan-code-entry')
    await expect(codeEntry).toBeVisible({ timeout: 15_000 })
    await shot(page, 'phone-scan-fallback')

    await codeEntry.fill('nope')
    await page.getByTestId('scan-code-go').click()
    await expect(page.getByTestId('scan-code-error')).toBeVisible()
    await expect(page).toHaveURL(/\/sops$/)

    await page.evaluate(() => {
      window.__evalMarker = true
    })
    await codeEntry.fill(pressCode.toLowerCase())
    await page.getByTestId('scan-code-go').click()
    await expect(page).toHaveURL(new RegExp(`/m/${pressCode}$`))
    expect(await page.evaluate(() => window.__evalMarker)).toBe(true)
    await expect(page.getByTestId('machine-view')).toBeVisible(SLOW)

    expect(errors).toEqual([])
  })

  test('logged out, /m/<code> goes to /login?next=…, and a signed-in visit to that login URL lands on the machine', async ({
    page,
    context,
  }) => {
    await page.goto(`/m/${pressCode}`)
    const loginUrl = new URL(page.url())
    expect(loginUrl.pathname).toBe('/login')
    expect(loginUrl.searchParams.get('next')).toBe(`/m/${pressCode}`)

    await signInAs(context, 'siteWorker')
    await page.goto(loginUrl.pathname + loginUrl.search)
    await expect(page).toHaveURL(new RegExp(`/m/${pressCode}$`))
    await expect(page.getByTestId('machine-view')).toBeVisible(SLOW)
  })

  test('a worker in another org gets a 404 for the EVAL Press code', async ({ page, context }) => {
    // The app's not-found.tsx boundary (Phase 30) is a friendly, navigable
    // page rather than a bare browser 404 -- Next.js serves it with a 200
    // status for this fully-dynamic route, so the assertion is on CONTENT
    // (no machine data ever renders), not the HTTP status code.
    await signInAs(context, 'worker')
    await page.goto(`/m/${pressCode}`)
    await expect(page.getByText('PAGE NOT FOUND')).toBeVisible()
    await expect(page.getByTestId('machine-view')).toHaveCount(0)
    await expect(page.getByText('EVAL Press')).toHaveCount(0)

    await page.goto('/m/nope')
    await expect(page.getByText('PAGE NOT FOUND')).toBeVisible()
    await expect(page.getByTestId('machine-view')).toHaveCount(0)
  })

  test('eval-site admin: the plate page renders at A6 with the QR, name, department and code; print hides the controls; the site editor links to it; a worker cannot open the plate', async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 397, height: 559 })
    await signInAs(context, 'siteAdmin')
    await page.goto(`/admin/site/plate/${pressId}`)

    const plate = page.getByTestId('machine-plate')
    await expect(plate).toBeVisible(SLOW)
    await expect(plate).toHaveAttribute('data-plate-url', `${new URL(EVAL_BASE_URL).origin}/m/${pressCode}`)
    await expect(page.getByTestId('plate-qr').locator('svg')).toHaveCount(1)
    await expect(page.getByTestId('plate-code')).toHaveText(pressCode)
    await expect(plate).toContainText('EVAL Press')
    await expect(plate).toContainText('Forming')
    await shot(page, 'phone-plate')

    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('plate-print')).toBeHidden()
    await shot(page, 'phone-plate-print')
    await page.emulateMedia({ media: null })

    // The site editor's selected-machine panel links to this same plate.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/site')
    const row = page.getByTestId('site-machine-row').filter({ hasText: 'EVAL Press' })
    await expect(row).toBeVisible(SLOW)
    await row.click()
    await expect(page.getByTestId('site-machine-print-plate')).toHaveAttribute('href', `/admin/site/plate/${pressId}`)

    // A worker cannot open the plate -- requireAdminContext bounces to /sops.
    const workerContext = await browser.newContext()
    const workerPage = await workerContext.newPage()
    await signInAs(workerContext, 'siteWorker')
    await workerPage.goto(`/admin/site/plate/${pressId}`)
    await expect(workerPage).toHaveURL(/\/sops(\?.*)?$/)
    await workerContext.close()
  })

  test("a worker whose org has no site still sees today's phone list", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    // Fallback proof needs a real-org account whose org has NO drawn site --
    // same rule as the Phase 52 plant eval's fallback test.
    const hasDrawnSite = await realOrgHasDrawnSite(db)
    test.skip(hasDrawnSite, 'real SOPstart org now has a drawn site — fallback not reachable with eval-worker')

    await signInAs(context, 'worker')
    await page.goto('/sops')
    await expect(page.getByRole('searchbox', { name: 'Search SOPs', exact: true })).toBeVisible(SLOW)
    await expect(page.getByTestId('phone-home')).toHaveCount(0)
    await shot(page, 'phone-home-fallback')
  })
})
