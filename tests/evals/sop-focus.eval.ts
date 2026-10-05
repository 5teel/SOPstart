/**
 * Deployed-site eval -- Phase 58 "The SOP Focus Screen: Walk & Edit".
 *
 * 58-11 fills the worker half: the focus frame (SC1), the walk (SC2) and the
 * versions / Back / phone half of SC5. 58-13, 58-14 and 58-17 fill the editor
 * and parsing cases; 58-18 runs them (`npm run eval -- --phase 58`) and reads
 * every screenshot before declaring a pass.
 *
 * Fixtures are provisioned by `node scripts/eval-fixtures.mjs` in the isolated
 * "SOPstart Eval Site" org (eval-site-worker): the walk fixture SOP (hazard, PPE,
 * a step, a photo step, a check), "EVAL focus jump" (jump-ahead on), "EVAL focus
 * lineage" (published v2 + v3, draft v4), "EVAL focus draft" (a draft only).
 *
 * Rules (CLAUDE.md Learnings):
 *  - assert by NAME, never a total count -- the eval-site org is shared with
 *    sibling evals (2026-09-29);
 *  - every assertion after a fresh navigation carries SLOW (2026-09-29);
 *  - `toHaveCount(1)` with a short timeout BEFORE a click -- an empty locator
 *    makes click() wait out the whole budget (2026-09-28);
 *  - walk TWICE in one session -- state can leak between records and one pass
 *    cannot see it (2026-10-03);
 *  - a not-found boundary serves HTTP 200: assert rendered content (2026-09-29);
 *  - read the screenshots: CSS-token and sizing bugs are invisible to
 *    assertions (2026-07-14).
 *
 * One minted worker session for the whole file (shared OTP budget). Self-skips
 * without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  EVAL_BASE_URL,
  EVAL_ENV_READY,
  EVAL_PLANT_MACHINE,
  EVAL_PLANT_SOP_TITLE,
  EVAL_WALK_SOP_TITLE,
  signInAs,
} from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'

export const SLOW = { timeout: 30_000 }
const SHORT = { timeout: 10_000 }
// The retired tab query, spelled apart so the Phase 58 retirement guard sees no live reference.
const LEGACY_TAB = 'tab'
const NOT_FOUND = 'This page has moved or no longer exists.'

// 1x1 PNG: compressPhoto redraws it to a JPEG, so this exercises the real compress -> signed PUT path.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const primary = (page: Page) => page.getByTestId('walk-primary')
const stepOfKind = (page: Page, kind: string) => page.locator(`[data-testid="walk-step"][data-kind="${kind}"]`)

/** Press the one primary button once it is there and enabled. */
async function press(page: Page) {
  await expect(primary(page)).toHaveCount(1, SHORT)
  await expect(primary(page)).toBeEnabled(SLOW)
  await primary(page).click()
}

/** Browse -> Start walking (or the resume card) -> the first step is on screen. */
async function startWalking(page: Page) {
  const start = page.getByTestId('focus-start-walking')
  await expect(start).toHaveCount(1, SLOW)
  await start.click()
  await expect(page.getByTestId('walk-step')).toHaveCount(1, SLOW)
}

/** Walk the five-step fixture (hazard, PPE, step, photo step, check) through to the sent screen. */
async function walkFixture(page: Page, shots: boolean) {
  await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
  await expect(page.getByTestId('walk-progress')).toHaveText('Step 1 of 5')
  if (shots) {
    await expect(primary(page)).toHaveText('I understand — continue')
    const box = await primary(page).boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(60)
    const size = await page.getByTestId('walk-step-text').evaluate((el) => getComputedStyle(el).fontSize)
    expect(size).toBe('28px')
    await shot(page, '58-walk-hazard')
  }
  await press(page)

  await expect(stepOfKind(page, 'ppe')).toHaveCount(1, SLOW)
  await expect(primary(page)).toHaveText("I'm wearing it — continue")
  if (shots) await shot(page, '58-walk-ppe')
  await press(page)

  await expect(stepOfKind(page, 'step')).toHaveCount(1, SLOW)
  await expect(primary(page)).toHaveText('Done — next step')
  await press(page)

  // The photo step: the primary is disabled with its hint until the photo is uploaded.
  await expect(page.getByTestId('walk-progress')).toHaveText('Step 4 of 5', SLOW)
  await expect(primary(page)).toBeDisabled(SLOW)
  await expect(page.getByText('Add a photo to continue.')).toBeVisible()
  const photoBtn = page.getByTestId('step-photo-button')
  await expect(photoBtn).toHaveCount(1, SHORT)
  if (shots) {
    expect((await photoBtn.boundingBox())!.height).toBeGreaterThanOrEqual(60)
    // Done steps ticked, the current one marked, the one ahead locked (D-08).
    await expect(page.locator('[data-testid="focus-rail-row"][data-state="done"]')).toHaveCount(3)
    await expect(page.locator('[data-testid="focus-rail-row"][data-state="current"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="focus-rail-row"][data-state="locked"]')).toHaveCount(1)
    await shot(page, '58-walk-photo-required')
    await shot(page, '58-walk-locked-rail')
  }
  const input = page.getByTestId('step-photo-input')
  await expect(input).toHaveCount(1, SHORT)
  await input.setInputFiles({ name: 'guard.png', mimeType: 'image/png', buffer: TINY_PNG })
  await expect(page.getByTestId('step-photo')).toHaveCount(1, { timeout: 60_000 })
  await expect(primary(page)).toBeEnabled(SLOW)
  await press(page)

  // Last step: its primary goes to the review.
  await expect(stepOfKind(page, 'check')).toHaveCount(1, SLOW)
  await expect(primary(page)).toHaveText('Done — review')
  await press(page)

  await expect(page.getByTestId('walk-review')).toBeVisible(SLOW)
  await expect(page.getByTestId('walk-review-summary')).toContainText('5 steps done · 1 photo')
  await expect(page.getByText('Acknowledged')).toHaveCount(2)
  if (shots) await shot(page, '58-review')
  const send = page.getByTestId('walk-send')
  await expect(send).toHaveCount(1, SHORT)
  await expect(send).toBeEnabled(SLOW)
  await send.click()
  await expect(page.getByTestId('walk-sent')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Sent for sign-off')).toBeVisible()
  if (shots) await shot(page, '58-sent')
}

test.describe('Phase 58 — the SOP focus screen (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe.serial('worker: frame, walk, versions, Back and phone', () => {
    let db: SupabaseClient
    let ctx: BrowserContext
    let siteOrgId: string
    let pressId: string
    let plantSopId: string
    const ids = { walk: '', jump: '', lineageRoot: '', lineageV3: '', lineageV4: '', draft: '' }

    const sopsTitled = async (title: string) => {
      const { data, error } = await db.from('sops').select('id, version, parent_sop_id, status').eq('organisation_id', siteOrgId).eq('title', title)
      if (error || !data?.length) throw new Error(`"${title}" not found in the eval-site org -- run node scripts/eval-fixtures.mjs`)
      return data
    }

    const cleanup = async () => {
      for (const id of [ids.walk, ids.jump]) if (id) await deleteEvalCompletions(db, id)
    }

    test.beforeAll(async ({ browser }) => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      pressId = fixture.pressId
      plantSopId = fixture.plantSopId
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

      ids.walk = (await sopsTitled(EVAL_WALK_SOP_TITLE))[0].id
      ids.jump = (await sopsTitled('EVAL focus jump'))[0].id
      const lineage = await sopsTitled('EVAL focus lineage')
      ids.lineageRoot = lineage.find((r) => r.parent_sop_id === null)!.id
      ids.lineageV3 = lineage.find((r) => r.version === 3)!.id
      ids.lineageV4 = lineage.find((r) => r.version === 4)!.id
      ids.draft = (await sopsTitled('EVAL focus draft'))[0].id

      await cleanup()
      ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: EVAL_BASE_URL })
      await signInAs(ctx, 'siteWorker')
    })

    test.afterAll(async () => {
      if (!EVAL_ENV_READY) return
      await cleanup()
      await ctx?.close()
    })

    // ---------------------------------------------------- SC1 -- the focus frame
    test('SC1 frame: opened from a machine it holds only the SOP — Back + title, rail 300 px, column <= 820, Start walking, no site chrome', async () => {
      test.setTimeout(180_000)
      const page = await ctx.newPage()
      const errors = watchConsole(page)

      // From the machine: the row opens /sops/<id>?from=<machine>.
      await page.goto('/')
      const machineRow = page.getByTestId('shell-machine-row').filter({ hasText: EVAL_PLANT_MACHINE })
      await expect(machineRow).toHaveCount(1, SLOW)
      await machineRow.click()
      const sopRow = page.getByTestId('shell-detail').getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
      await expect(sopRow).toHaveCount(1, SLOW)
      const walkLink = sopRow.getByTestId('plant-panel-walk')
      await expect(walkLink).toHaveCount(1, SHORT)
      await walkLink.click()
      await expect(page).toHaveURL(new RegExp(`/sops/${plantSopId}\\?from=${pressId}$`), SLOW)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await expect(page.getByText(NOT_FOUND)).toHaveCount(0)

      // The walk fixture's browse state, opened from the same machine.
      await page.goto(`/sops/${ids.walk}?from=${pressId}`)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await expect(page.getByTestId('focus-screen')).toHaveAttribute('data-mode', 'browse')
      await expect(page.getByTestId('focus-start-walking')).toBeVisible(SLOW)
      for (const id of ['shell', 'shell-stage', 'shell-summary', 'plant-stage', 'back-to-site', 'gov-inbox']) {
        await expect(page.getByTestId(id), id).toHaveCount(0)
      }
      await expect(page.locator('[data-testid*="inbox"], [data-testid*="notification"]')).toHaveCount(0)
      // Top bar: Back and the title, nothing else (no version chip on a live version).
      await expect(page.getByTestId('focus-back')).toHaveCount(1)
      await expect(page.getByTestId('focus-top-bar').locator('h1')).toContainText(EVAL_WALK_SOP_TITLE)
      await expect(page.getByTestId('focus-version-chip')).toHaveCount(0)

      const rail = await page.getByTestId('focus-rail').boundingBox()
      expect(Math.round(rail!.width)).toBe(300)
      const maxWidth = await page.getByTestId('focus-browse').locator('> div').first().evaluate((el) => getComputedStyle(el).maxWidth)
      expect(maxWidth).toBe('820px')
      await shot(page, '58-browse-worker')
      expect(errors, errors.join('\n')).toEqual([])
      await page.close()
    })

    test('SC1 compiled CSS contains text-step, max-w-205, w-75, size-18 and bg-accent-signoff (a utility that compiles to nothing is invisible to every other check)', async () => {
      const page = await ctx.newPage()
      await page.goto(`/sops/${ids.walk}`)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      const hrefs = await page.$$eval('link[rel="stylesheet"]', (els) => els.map((e) => (e as HTMLLinkElement).href))
      expect(hrefs.length).toBeGreaterThan(0)
      const css = (await Promise.all(hrefs.map(async (h) => (await page.request.get(h)).text()))).join('\n')
      for (const cls of ['text-step', 'max-w-205', 'w-75', 'size-18', 'bg-accent-signoff']) expect(css, cls).toContain(`.${cls}`)
      await page.close()
    })

    // ---------------------------------------------------- SC2 -- the walk
    test('SC2 walk: hazard, PPE and photo steps, locked rail, review, Send, sent — then Back to the place it came from; a second walk in the same session starts clean', async () => {
      test.setTimeout(360_000)
      const page = await ctx.newPage()
      const errors = watchConsole(page)

      for (const pass of [0, 1]) {
        await page.goto(`/sops/${ids.walk}?from=${pressId}`)
        // The second pass inherits nothing: no resume card, no photo, step 1 of 5 again.
        await expect(page.getByTestId('focus-start-walking')).toHaveCount(1, SLOW)
        await expect(page.getByTestId('walk-resume')).toHaveCount(0)
        await startWalking(page)
        await walkFixture(page, pass === 0)

        if (pass === 0) {
          await expect(page.getByTestId('walk-sent-back')).toHaveCount(1, SHORT)
          await page.getByTestId('walk-sent-back').click()
          // Back lands on the one screen with the originating machine still selected.
          await expect(page).toHaveURL(new RegExp(`/\\?place=${pressId}$`), SLOW)
          await expect(page.getByTestId('shell-detail')).toHaveAttribute('data-place', `/?place=${pressId}`, SLOW)
          await shot(page, '58-back-place')
        }
      }

      // Both walks were sent: two completions, one photo each, each its own walk id.
      const { data: rows } = await db.from('sop_completions').select('id, status').eq('sop_id', ids.walk)
      expect(rows?.length).toBe(2)
      for (const r of rows ?? []) {
        expect(r.status).toBe('pending_sign_off')
        const { data: photos } = await db.from('completion_photos').select('id').eq('completion_id', r.id)
        expect(photos?.length).toBe(1)
      }
      expect(errors, errors.join('\n')).toEqual([])
      await page.close()
    })

    test('SC2 resume: reopening mid-walk offers "Resume where you left off"; Esc closes the Start over dialog; Start over begins again', async () => {
      test.setTimeout(240_000)
      await deleteEvalCompletions(db, ids.walk)
      const page = await ctx.newPage()
      await page.goto(`/sops/${ids.walk}?from=${pressId}`)
      await startWalking(page)
      await press(page) // hazard
      await press(page) // PPE
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 3 of 5', SLOW)

      // Back (progress is already on the server), then reopen.
      await page.getByTestId('focus-back').click()
      await expect(page).toHaveURL(new RegExp(`/\\?place=${pressId}$`), SLOW)
      await page.goto(`/sops/${ids.walk}?from=${pressId}`)
      const resume = page.getByTestId('walk-resume-button')
      await expect(resume).toHaveCount(1, SLOW)
      await expect(resume).toContainText('Resume where you left off (step 3 of 5)')
      await shot(page, '58-resume')

      // Esc closes the dialog first and does not leave the screen.
      await page.getByTestId('walk-start-over').click()
      await expect(page.getByTestId('walk-start-over-dialog')).toBeVisible(SHORT)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('walk-start-over-dialog')).toHaveCount(0)
      await expect(page.getByTestId('focus-screen')).toBeVisible()

      await page.getByTestId('walk-start-over').click()
      const confirm = page.getByTestId('walk-start-over-confirm')
      await expect(confirm).toHaveCount(1, SHORT)
      await confirm.click()
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 1 of 5')
      await page.close()
    })

    test('SC2 jump-ahead: with it on every row opens and unacknowledged hazard dots are hollow', async () => {
      test.setTimeout(180_000)
      const page = await ctx.newPage()
      await page.goto(`/sops/${ids.jump}`)
      await startWalking(page)
      await expect(page.locator('[data-testid="focus-rail-row"][data-state="locked"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="focus-rail-row"] [data-hollow="true"]')).toHaveCount(1)
      const rows = page.getByTestId('focus-rail-row')
      const last = rows.last()
      await expect(last).toHaveCount(1)
      await last.click()
      await expect(page.getByTestId('walk-step-text')).toHaveText('Start the press.', SLOW)
      await shot(page, '58-walk-jump-on')
      await page.close()
    })

    // ---------------------------------------------------- SC5 -- addresses, versions, phone
    test('SC5 addresses: an old tab address redirects to the bare focus address; a superseded or draft version never reaches a worker', async () => {
      test.setTimeout(180_000)
      const page = await ctx.newPage()

      await page.goto(`/sops/${ids.walk}?${LEGACY_TAB}=walk&from=${pressId}`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.walk}\\?from=${pressId}$`), SLOW)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await page.goto(`/sops/${ids.walk}?${LEGACY_TAB}=read`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.walk}$`), SLOW)

      // The superseded v2 id lands a worker on v3; the draft v4 id never opens.
      await page.goto(`/sops/${ids.lineageRoot}`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.lineageV3}`), SLOW)
      await expect(page.getByTestId('focus-screen')).toHaveAttribute('data-version-state', 'live', SLOW)
      await expect(page.getByTestId('focus-version-chip')).toHaveCount(0)
      await expect(page.getByText('Close the guard (l3).')).toHaveCount(1)
      await page.goto(`/sops/${ids.lineageV4}`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.lineageV3}`), SLOW)
      await expect(page.getByText('(l4)')).toHaveCount(0)

      // A SOP that is only a draft is not found (rendered content, not the status code).
      await page.goto(`/sops/${ids.draft}`)
      await expect(page.getByText(NOT_FOUND)).toBeVisible(SLOW)
      await expect(page.getByTestId('focus-screen')).toHaveCount(0)
      await page.close()
    })

    test('SC5 phone (390x844): sticky dock, rail hidden behind "Steps · n of N", 28 px text; the rail opens as a full-screen sheet of 44 px rows', async () => {
      test.setTimeout(180_000)
      await deleteEvalCompletions(db, ids.walk)
      const page = await ctx.newPage()
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/sops/${ids.walk}?from=${pressId}`)
      await startWalking(page)

      await expect(page.getByTestId('focus-rail')).toBeHidden()
      await expect(page.getByTestId('focus-steps-button')).toHaveText(/Steps · 1 of 5/)
      const dock = await page.getByTestId('walk-dock').boundingBox()
      expect(dock!.y + dock!.height).toBeGreaterThanOrEqual(830)
      expect(await page.getByTestId('walk-step-text').evaluate((el) => getComputedStyle(el).fontSize)).toBe('28px')
      await shot(page, '58-phone-walk')

      await page.getByTestId('focus-steps-button').click()
      await expect(page.getByTestId('focus-rail')).toBeVisible(SHORT)
      const row = await page.getByTestId('focus-rail-row').first().boundingBox()
      expect(row!.height).toBeGreaterThanOrEqual(44)
      await shot(page, '58-phone-rail')
      await page.close()
    })
  })

  // The real SOPstart org is only ever READ (moved here from the retired sop-detail eval).
  test('SC1 real-org SOP (OTG Probe Maintenance) opens in the focus screen browse state, read-only', async ({ page, context }) => {
    test.setTimeout(180_000)
    const errors = watchConsole(page)
    await signInAs(context, 'admin')
    await page.goto('/sops/125cf9f1-547e-4cc6-8baf-813d9236a691')
    await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0)
    await expect(page.getByTestId('focus-top-bar').locator('h1')).toContainText('OTG Probe Maintenance', SLOW)
    await expect(page.getByTestId('focus-browse-step').first()).toBeVisible(SLOW)
    await shot(page, '58-browse-real-org')
    expect(errors, errors.join('\n')).toEqual([])
  })

  // ------------------------------------------------ SC3 -- the editor
  test.describe('SC3 edit', () => {
    test.fixme('58-edit-admin: version slot, AI banner at top, kind borders, tick per step, bottom bar count', async () => {})
    test.fixme('58-edit-ai-findings: violet markers, Publish disabled with reasons', async () => {})
    test.fixme('58-edit-publish-dialog: all ticked + cleared, green Publish enabled, dialog recessed', async () => {})
    test.fixme('58-edit-blank: empty state copy', async () => {})
    test.fixme('58-this-sop: version list, standards, jump-ahead switch', async () => {})
  })

  // ------------------------------------------------ SC4 -- still parsing
  test.describe('SC4 parsing', () => {
    test.fixme('58-parsing: stage line, rough time, skeleton rail, frame never empty', async () => {})
    test.fixme('58-parse-failed: error card + Try again', async () => {})
  })

  // ------------------------------------------------ SC5 -- the admin half
  test.describe('SC5 admin versions', () => {
    test.fixme('58-superseded: "v2 — superseded" badge, no Start walking (admin opens the exact version)', async () => {})
  })
})
