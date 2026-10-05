/**
 * Deployed-site eval -- Phase 55 "Cut the Dropped Features & One Organisation".
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com) via
 * `npm run eval -- --phase 55`. Provision fixtures first:
 * `node scripts/eval-fixtures.mjs` (adds the "Eval walk fixture SOP" to the
 * isolated eval-site org -- never the real SOPstart org).
 *
 * Every test self-skips without EVAL_BASE_URL so `npm run test` never touches
 * production. Dead addresses are asserted by RENDERED not-found content, never
 * the HTTP status code (the custom not-found serves 200). The real SOPstart org
 * is only ever READ.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_WALK_SOP_TITLE, signInAs } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'

const SLOW = { timeout: 30_000 }
const OTG = '/sops/125cf9f1-547e-4cc6-8baf-813d9236a691'
const NOT_FOUND = 'This page has moved or no longer exists.'

// 1x1 PNG: compressPhoto redraws it to a JPEG, so this exercises the real compress -> signed PUT path.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

test.describe('Phase 55 — cut features (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  let db: SupabaseClient
  let walkSopId: string
  let completionId = ''

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const { data: org } = await db.from('organisations').select('id').eq('name', EVAL_SITE_ORG_NAME).maybeSingle()
    if (!org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found — run node scripts/eval-fixtures.mjs`)
    const { data: walk } = await db
      .from('sops')
      .select('id')
      .eq('organisation_id', org.id)
      .eq('title', EVAL_WALK_SOP_TITLE)
      .maybeSingle()
    if (!walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" not found — run node scripts/eval-fixtures.mjs`)
    walkSopId = walk.id
    await ensurePlantFixture(db)
    await deleteEvalCompletions(db, walkSopId)
  })

  test.afterAll(async () => {
    if (!EVAL_ENV_READY || !walkSopId) return
    await deleteEvalCompletions(db, walkSopId)
  })

  test('worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker', async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteWorker')
    await page.goto('/')

    await expect(page.getByTestId('plant-stage')).toBeVisible(SLOW)
    const press = page.locator('[data-testid="plant-machine"][data-machine-name="EVAL Press"]')
    await expect(press).toHaveAttribute('data-pin', /^[1-9]\d*$/, { timeout: 45_000 })
    await expect(page.getByTestId('plant-now-card')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-ask-mic')).toHaveCount(0)
    await expect(page.getByText(/Install SOPstart|Add to Home Screen|No internet/i)).toHaveCount(0)
    await shot(page, 'cut-worker-plant')

    const registrations = await page.evaluate(() =>
      navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((r) => r.length) : 0
    )
    expect(registrations).toBe(0)

    // Signed out: /sw.js must be the self-unregistering kill-switch, not the login page.
    const res = await request.get(`${process.env.EVAL_BASE_URL}/sw.js`)
    const body = await res.text()
    expect(body).toContain('unregister()')
    expect(body).not.toContain('<html')
    expect(errors, errors.join('\n')).toEqual([])
  })

  test.describe.serial('walk with a photo, then it waits for sign-off', () => {
    test('worker on a phone walks the walk fixture, adds the photo it asks for and sends it — nothing queued', async ({
      page,
      context,
    }) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width: 390, height: 844 })
      const errors = watchConsole(page)
      await signInAs(context, 'siteWorker')
      await page.goto(`/sops/${walkSopId}`)

      // The focus screen (Phase 58): browse first, then one step at a time.
      const start = page.getByTestId('focus-start-walking')
      await expect(start).toHaveCount(1, SLOW)
      await start.click()
      const primary = page.getByTestId('walk-primary')
      await expect(primary).toHaveCount(1, SLOW)

      // Hazard, PPE and the plain step: no photo needed.
      for (const kind of ['hazard', 'ppe', 'step']) {
        await expect(page.locator(`[data-testid="walk-step"][data-kind="${kind}"]`)).toHaveCount(1, SLOW)
        await primary.click()
      }

      // The photo step: the primary stays disabled until one is uploaded.
      await expect(primary).toBeDisabled(SLOW)
      const input = page.getByTestId('step-photo-input')
      await expect(input).toHaveCount(1, { timeout: 10_000 })
      await input.setInputFiles({ name: 'guard.png', mimeType: 'image/png', buffer: TINY_PNG })
      await expect(page.getByTestId('step-photo')).toHaveCount(1, { timeout: 60_000 })
      await expect(primary).toBeEnabled(SLOW)
      await primary.click()

      // Last step, then review and send.
      await expect(primary).toHaveText(/Done — review/, SLOW)
      await primary.click()
      await expect(page.getByTestId('walk-review')).toBeVisible(SLOW)
      await page.getByTestId('walk-send').click()
      await expect(page.getByTestId('walk-sent')).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText(/queued|saved for later|waiting to upload/i)).toHaveCount(0)
      await shot(page, 'cut-walk-phone')
      expect(errors, errors.join('\n')).toEqual([])
    })

    test('admin sees that completion waiting for sign-off with its photo', async ({ page, context }) => {
      test.setTimeout(180_000)
      const { data: rows, error } = await db
        .from('sop_completions')
        .select('id, status')
        .eq('sop_id', walkSopId)
        .order('submitted_at', { ascending: false })
        .limit(1)
      expect(error).toBeNull()
      expect(rows?.length).toBe(1)
      completionId = rows![0].id as string
      expect(rows![0].status).toBe('pending_sign_off')
      const { data: photos } = await db.from('completion_photos').select('id').eq('completion_id', completionId)
      expect(photos?.length).toBe(1)

      await page.setViewportSize({ width: 1280, height: 900 })
      const errors = watchConsole(page)
      await signInAs(context, 'siteAdmin')
      await page.goto('/activity')
      const link = page.locator(`a[href="/activity/${completionId}"]`)
      await expect(link.first()).toBeVisible(SLOW)
      await link.first().click()
      await page.waitForURL(`**/activity/${completionId}`, { timeout: 30_000 })
      const img = page.locator('img[alt^="Step"]').first()
      await expect(img).toBeVisible(SLOW)
      await expect
        .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), SLOW)
        .toBeGreaterThan(0)
      await shot(page, 'cut-walk-signoff')
      expect(errors, errors.join("\n")).toEqual([])
    })
  })

  test('existing SOPs, completions and photos still open', async ({ page, context }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = watchConsole(page)
    await signInAs(context, 'admin')
    await page.goto(OTG)
    await expect(page.locator('main').getByRole('heading', { level: 1, name: /OTG Probe Maintenance/ })).toBeVisible(SLOW)
    await shot(page, 'cut-existing-sop')

    // Read-only: newest real-org completion, preferring one that has a photo.
    const { data: photos } = await db
      .from('completion_photos')
      .select('completion_id')
      .eq('organisation_id', REAL_SOPSTART_ORG_ID)
      .limit(500)
    const ids = [...new Set((photos ?? []).map((p) => p.completion_id as string))]
    const q = db.from('sop_completions').select('id').eq('organisation_id', REAL_SOPSTART_ORG_ID)
    const { data: rows } = await (ids.length ? q.in('id', ids) : q).order('submitted_at', { ascending: false }).limit(1)
    test.skip(!rows?.length, 'no real-org completion exists')
    await page.goto(`/activity/${rows![0].id}`)
    await expect(page.locator('main').first()).toBeVisible(SLOW)
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0)
    if (ids.length) {
      const img = page.locator('img[alt^="Step"]').first()
      await expect(img).toBeVisible(SLOW)
      await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), SLOW).toBeGreaterThan(0)
    }
    await shot(page, 'cut-existing-completion')
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('admin sees none of the dropped authoring tools; dead addresses show the not-found page', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteAdmin')

    // The old builder address lands on the focus editor, which carries none of the dropped tools
    // (joined, not templated: the address is a redirect probe, not a link)
    await page.goto(['/admin/sops', 'builder', walkSopId].join('/'))
    await expect(page.getByTestId('edit-document')).toHaveCount(1, { timeout: 30_000 })
    expect(page.url()).toContain(`/sops/${walkSopId}`)
    await expect(page.getByText(/training video|QR code|flow diagram/i)).toHaveCount(0)
    await shot(page, 'cut-builder-tools')

    // New-SOP entry
    await page.goto('/admin/sops/upload')
    await expect(page.getByText('Record video').first()).toBeVisible(SLOW)
    await expect(page.getByText(/YouTube|Take a photo|Scan document|Generate video SOP/)).toHaveCount(0)
    await shot(page, 'cut-upload')

    await page.goto('/admin/sops/new/ai')
    await expect(page.getByRole('heading').first()).toBeVisible(SLOW)
    await expect(page.getByText('Talk it through')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /\bmic(rophone)?\b/i })).toHaveCount(0)
    await shot(page, 'cut-new-ai')

    // The old versions address lands on the focus editor too
    await page.goto(['/admin/sops', walkSopId, 'versions'].join('/'))
    await expect(page).toHaveURL(new RegExp(`/sops/${walkSopId}\\?mode=edit`), SLOW)
    await expect(page.getByRole('button', { name: /Compare|Restore/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Compare|Restore/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Content', exact: true })).toHaveCount(0)
    await shot(page, 'cut-versions')

    // Dead addresses render the not-found page (HTTP 200 behind the custom boundary -- assert content).
    for (const dead of [
      '/admin/blocks',
      '/m/ABC234',
      '/~offline',
      `/admin/sops/${walkSopId}/video`,
      `/admin/sops/${walkSopId}/qr`,
      ['/admin/sops', walkSopId, 'versions', 'diff'].join('/'),
    ]) {
      await page.goto(dead)
      await expect(page.getByText(NOT_FOUND), dead).toBeVisible(SLOW)
    }
    await shot(page, 'cut-not-found')

    // Dead APIs
    const tok = await page.request.post('/api/voice/token')
    expect(await tok.text()).not.toContain('access_token')
    const roster = await page.request.get('/api/roster')
    let parsed: unknown = null
    try {
      parsed = JSON.parse(await roster.text())
    } catch {
      /* not JSON -- fine */
    }
    expect(Array.isArray(parsed)).toBe(false)
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('sign-up says ask your admin; login has no register link; profile has no organisation switch', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1280, height: 900 })
    const errors = watchConsole(page)

    await page.goto('/sign-up')
    await expect(page.getByText('SOPstart is by invitation').first()).toBeVisible(SLOW)
    await expect(page.getByText(/Ask your admin/)).toBeVisible()
    await expect(page.locator('input')).toHaveCount(0)
    await shot(page, 'cut-sign-up')

    await page.goto('/login')
    await expect(page.locator('input').first()).toBeVisible(SLOW)
    await expect(page.getByText(/Register/i)).toHaveCount(0)
    await shot(page, 'cut-login')

    // Signed out (a signed-in visit to /login* is redirected home), the roster login is gone.
    await page.goto('/login/roster')
    await expect(page.getByText(NOT_FOUND)).toBeVisible(SLOW)

    await signInAs(context, 'admin')
    await page.goto('/profile')
    await expect(page.locator('main').first()).toBeVisible(SLOW)
    await expect(page.getByRole('heading', { name: 'Organisations' })).toHaveCount(0)
    await shot(page, 'cut-profile')
    expect(errors, errors.join('\n')).toEqual([])
  })
})
