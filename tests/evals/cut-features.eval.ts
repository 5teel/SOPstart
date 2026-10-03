/**
 * Deployed-site eval -- Phase 55 "Cut the Dropped Features & One Organisation".
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com) via
 * `npm run eval -- --phase 55`. Provision fixtures first:
 * `node scripts/eval-fixtures.mjs` (adds the "Eval walk fixture SOP" to the
 * isolated eval-site org -- never the real SOPstart org).
 *
 * Skeleton from 55-01: the walk tests are authored in 55-03, the rest in
 * 55-14. Every test self-skips without EVAL_BASE_URL so `npm run test`
 * never touches production. Dead addresses are asserted by RENDERED not-found
 * content, never response.status() (custom not-found serves 200).
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_WALK_SOP_TITLE, signInAs } from './lib/session'
import { ensurePlantFixture, shot, watchConsole } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'

const SLOW = { timeout: 30_000 }

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

  // 55-14
  test.fixme('worker at 1440 sees pins and the next-SOP card — no install prompt, no offline banner, no microphone, no service worker', async () => {})

  // 55-03
  test.describe.serial('walk with a photo, then it waits for sign-off', () => {
    test('worker on a phone walks the walk fixture, takes the photo it asks for and submits — nothing queued', async ({
      page,
      context,
    }) => {
      test.setTimeout(180_000)
      await page.setViewportSize({ width: 390, height: 844 })
      const errors = watchConsole(page)
      await signInAs(context, 'siteWorker')
      await page.goto(`/sops/${walkSopId}?tab=walk`)

      // The card renders twice (list view hidden below 430px) -- scope to the phone one.
      const card = page.locator('.immersive-only-below-430')
      const next = page.getByTestId('ack-next')
      await expect(next).toBeVisible(SLOW)

      // Step 1: no photo needed.
      await next.click()

      // Step 2: photo required, so Next stays disabled until one is uploaded.
      await expect(next).toBeDisabled(SLOW)
      const input = card.getByTestId('step-photo-input')
      await expect(input).toHaveCount(1, { timeout: 10_000 })
      await input.setInputFiles({ name: 'guard.png', mimeType: 'image/png', buffer: TINY_PNG })
      await expect(card.locator('[data-testid="step-photo"][data-status="uploaded"]')).toHaveCount(1, { timeout: 60_000 })
      await expect(card.getByText('Uploaded')).toBeVisible()
      await expect(next).toBeEnabled(SLOW)
      await next.click()

      // Done: sign off and submit.
      await page.getByRole('button', { name: /Sign off & submit/ }).click()
      await expect(page.getByText('Completion submitted')).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText(/queued|saved for later|waiting to upload/i)).toHaveCount(0)
      await shot(page, 'cut-walk-phone')
      expect(errors, errors.join("\n")).toEqual([])
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

  // 55-14
  test.fixme('existing SOPs, completions and photos still open', async () => {})

  // 55-14
  test.fixme('admin sees none of the dropped authoring tools; dead addresses show the not-found page', async () => {})

  // 55-14
  test.fixme('sign-up says ask your admin; login has no register link; profile has no organisation switch', async () => {})
})
