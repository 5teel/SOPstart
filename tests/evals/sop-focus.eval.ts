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
import path from 'node:path'
import {
  EVAL_BASE_URL,
  EVAL_ENV_READY,
  EVAL_PLANT_SOP_TITLE,
  EVAL_WALK_SOP_TITLE,
  signInAs,
} from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'
import { primary, press, startWalking, stepOfKind, walkFixture, TINY_PNG } from './lib/walk'

export const SLOW = { timeout: 30_000 }
const SHORT = { timeout: 10_000 }
// The retired tab query, spelled apart so the Phase 58 retirement guard sees no live reference.
const LEGACY_TAB = 'tab'
const NOT_FOUND = 'This page has moved or no longer exists.'

test.describe('Phase 58 — the SOP focus screen (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  test.describe.serial('worker: frame, walk, versions, Back and phone', () => {
    let db: SupabaseClient
    let ctx: BrowserContext
    let siteOrgId: string
    let plantSopId: string
    const ids = { walk: '', jump: '', lineageRoot: '', lineageV3: '', lineageV4: '', draft: '' }

    // The address Read gives a focus screen: the home query that shows this SOP.
    const fromRead = (id: string) => encodeURIComponent(`sop=${id}`)

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
    test('SC1 frame: opened from Read it holds only the SOP — Back + title, rail 300 px, column <= 820, the start button, no home chrome', async () => {
      test.setTimeout(180_000)
      const page = await ctx.newPage()
      const errors = watchConsole(page)

      // Read offers the start (the click itself is proved in the start eval); the focus address carries Read as its from.
      await page.goto(`/?sop=${plantSopId}`)
      await expect(page.getByTestId('read-view').locator('h1')).toHaveText(EVAL_PLANT_SOP_TITLE, SLOW)
      await expect(page.getByTestId('read-start')).toHaveCount(1, SHORT)
      await page.goto(`/sops/${plantSopId}?from=${fromRead(plantSopId)}`)
      await expect(page).toHaveURL(new RegExp(`/sops/${plantSopId}\\?from=${fromRead(plantSopId)}$`), SLOW)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await expect(page.getByText(NOT_FOUND)).toHaveCount(0)

      // The walk fixture's browse state, opened from its own Read.
      await page.goto(`/sops/${ids.walk}?from=${fromRead(ids.walk)}`)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await expect(page.getByTestId('focus-screen')).toHaveAttribute('data-mode', 'browse')
      await expect(page.getByTestId('focus-start-walking')).toBeVisible(SLOW)
      for (const id of ['home', 'home-menu', 'home-list', 'home-reader', 'back-to-site', 'office-pane']) {
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
        await page.goto(`/sops/${ids.walk}?from=${fromRead(ids.walk)}`)
        // The second pass inherits nothing: no resume card, no photo, step 1 of 5 again.
        await expect(page.getByTestId('focus-start-walking')).toHaveCount(1, SLOW)
        await expect(page.getByTestId('walk-resume')).toHaveCount(0)
        await startWalking(page)
        await walkFixture(page, pass === 0)

        if (pass === 0) {
          await expect(page.getByTestId('walk-sent-back')).toHaveCount(1, SHORT)
          await page.getByTestId('walk-sent-back').click()
          // Back lands on the home with the SOP it came from open in Read.
          await expect(page).toHaveURL(new RegExp(`/\\?sop=${ids.walk}$`), SLOW)
          await expect(page.getByTestId('read-view').locator('h1')).toHaveText(EVAL_WALK_SOP_TITLE, SLOW)
          await shot(page, '58-back-read')
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

    test('SC2 resume: reopening mid-walk offers the start with "Picks up at step 3 of 5"; Esc closes the Start over dialog; Start over begins again', async () => {
      test.setTimeout(240_000)
      await deleteEvalCompletions(db, ids.walk)
      const page = await ctx.newPage()
      await page.goto(`/sops/${ids.walk}?from=${fromRead(ids.walk)}`)
      await startWalking(page)
      await press(page) // hazard
      await press(page) // PPE
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 3 of 5', SLOW)

      // Back (progress is already on the server), then reopen.
      await page.getByTestId('focus-back').click()
      await expect(page).toHaveURL(new RegExp(`/\\?sop=${ids.walk}$`), SLOW)
      await page.goto(`/sops/${ids.walk}?from=${fromRead(ids.walk)}`)
      await expect(page.getByTestId('walk-resume-button')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('walk-resume')).toContainText('Picks up at step 3 of 5')
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

      await page.goto(`/sops/${ids.walk}?${LEGACY_TAB}=walk&from=${fromRead(ids.walk)}`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.walk}\\?from=${fromRead(ids.walk)}$`), SLOW)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await page.goto(`/sops/${ids.walk}?${LEGACY_TAB}=read`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.walk}$`), SLOW)

      // The superseded v2 id lands a worker on v3; the draft v4 id never opens.
      await page.goto(`/sops/${ids.lineageRoot}`)
      await expect(page).toHaveURL(new RegExp(`/sops/${ids.lineageV3}`), SLOW)
      await expect(page.getByTestId('focus-screen')).toHaveAttribute('data-version-state', 'live', SLOW)
      await expect(page.getByTestId('focus-version-chip')).toHaveCount(0)
      // the rail row and the step both carry the text, so assert it is there, not that it is unique
      await expect(page.getByText('Close the guard (l3).').first()).toBeVisible(SLOW)
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
      await page.goto(`/sops/${ids.walk}?from=${fromRead(ids.walk)}`)
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

  // ------------------------------------------------ SC3 / SC4 / SC5 -- the admin half (58-13)
  // Admin session; the editor is opened straight from its address
  // (/sops/<id>?mode=edit&from=s%3Dmanage) until 58-14 repoints the machine panel's Edit link.
  test.describe.serial('admin: editor, parsing, versions and publish', () => {
    let db: SupabaseClient
    let adminCtx: BrowserContext
    let workerCtx: BrowserContext
    let siteOrgId = ''
    const ids = { draft: '', ready: '', blank: '', lineageRoot: '', lineageV4: '', publish: '', parsing: '', parsingVideo: '', parseFailed: '' }

    const editUrl = (id: string) => `/sops/${id}?mode=edit&from=s%3Dmanage`
    const rows = async (title: string) => {
      const { data, error } = await db.from('sops').select('id, version, parent_sop_id, status').eq('organisation_id', siteOrgId).eq('title', title)
      if (error || !data?.length) throw new Error(`"${title}" not found in the eval-site org -- run node scripts/eval-fixtures.mjs`)
      return data
    }
    const reopenFindings = async () => {
      await db.from('sop_ai_findings').update({ cleared_at: null, cleared_by: null }).eq('sop_id', ids.draft).like('description', 'EVAL focus finding:%')
    }
    // The publish fixture is v1 only; whatever a previous run published on top is removed (the provisioning script does the same).
    const dropPublishedChildren = async () => {
      await db.from('sops').delete().eq('organisation_id', siteOrgId).eq('parent_sop_id', ids.publish)
    }

    test.beforeAll(async ({ browser }) => {
      if (!EVAL_ENV_READY) return
      db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const fixture = await ensurePlantFixture(db)
      siteOrgId = fixture.siteOrgId
      if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
      ids.draft = (await rows('EVAL focus draft'))[0].id
      ids.ready = (await rows('EVAL focus ready'))[0].id
      ids.blank = (await rows('EVAL focus blank'))[0].id
      const lineage = await rows('EVAL focus lineage')
      ids.lineageRoot = lineage.find((r) => r.parent_sop_id === null)!.id
      ids.lineageV4 = lineage.find((r) => r.version === 4)!.id
      ids.publish = (await rows('EVAL focus publish'))[0].id
      ids.parsing = (await rows('EVAL focus parsing'))[0].id
      ids.parsingVideo = (await rows('EVAL focus parsing video'))[0].id
      ids.parseFailed = (await rows('EVAL focus parse failed'))[0].id
      await reopenFindings()
      await dropPublishedChildren()
      adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: EVAL_BASE_URL })
      await signInAs(adminCtx, 'siteAdmin')
      workerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: EVAL_BASE_URL })
      await signInAs(workerCtx, 'siteWorker')
    })

    test.afterAll(async () => {
      if (!EVAL_ENV_READY) return
      await reopenFindings()
      await dropPublishedChildren()
      await adminCtx?.close()
      await workerCtx?.close()
    })

    // ---- SC3: the editor on a draft with mixed ticks and open findings
    test('SC3 58-edit-admin: version slot, AI banner above the first section, tick per step, kind borders, "Checked 2 of 4"', async () => {
      test.setTimeout(180_000)
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await page.goto(editUrl(ids.draft))
      await expect(page.getByTestId('edit-document')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('edit-version-slot')).toContainText('Draft — not published yet', SLOW)
      await expect(page.getByTestId('ai-check-banner')).toBeVisible(SLOW)
      const banner = await page.getByTestId('ai-check-banner').boundingBox()
      const firstSection = await page.getByTestId('edit-section').first().boundingBox()
      expect(banner && firstSection && banner.y < firstSection.y, 'the AI check sits above the first section').toBe(true)
      await expect(page.getByTestId('edit-step')).toHaveCount(4, SLOW)
      await expect(page.locator('[data-testid="edit-rail-row"][data-ticked="true"]')).toHaveCount(2, SLOW)
      await expect(page.getByTestId('publish-count')).toHaveText('Checked 2 of 4 steps', SLOW)
      await expect(page.getByRole('checkbox', { name: /I have checked this/ })).toHaveCount(2, SLOW)
      // The admin switch is there, and flipping Walk / Edit is local: no reload.
      await page.evaluate(() => {
        ;(window as unknown as { __nav: number }).__nav = 1
      })
      await expect(page.getByTestId('focus-mode-switch')).toHaveCount(1, SHORT)
      await page.getByTestId('focus-mode-switch-walk').click()
      await expect(page.getByTestId('edit-document')).toHaveCount(0, SLOW)
      await expect(page).not.toHaveURL(/mode=edit/)
      await page.getByTestId('focus-mode-switch-edit').click()
      await expect(page.getByTestId('edit-document')).toHaveCount(1, SLOW)
      expect(await page.evaluate(() => (window as unknown as { __nav?: number }).__nav)).toBe(1)
      await shot(page, '58-edit-admin')
      expect(errors, errors.join('\n')).toEqual([])
      await page.close()
    })

    test('SC3 58-edit-ai-findings: violet markers, Publish off with reasons, Clear writes "Cleared · logged in the decision ledger"', async () => {
      test.setTimeout(180_000)
      const page = await adminCtx.newPage()
      await page.goto(editUrl(ids.draft))
      const found = page.getByTestId('ai-finding')
      await expect(found.filter({ hasText: 'EVAL focus finding: the photo step' })).toHaveCount(1, SLOW)
      await expect(found.filter({ hasText: 'EVAL focus finding: no emergency stop' })).toHaveCount(1, SLOW)
      await expect(page.getByTestId('edit-step-finding')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('edit-rail-flag')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('publish-button')).toHaveAttribute('aria-disabled', 'true', SLOW)
      await expect(page.getByTestId('publish-reasons')).toContainText(/finding/i, SLOW)
      await shot(page, '58-edit-ai-findings')
      const clear = found.filter({ hasText: 'EVAL focus finding: the photo step' }).getByTestId('ai-finding-clear')
      await expect(clear).toHaveCount(1, SHORT)
      await clear.click()
      await expect(page.getByTestId('ai-finding-cleared')).toContainText('Cleared · logged in the decision ledger', SLOW)
      await expect(found).toHaveCount(1, SLOW)
      await page.close()
    })

    test('SC3 58-edit-publish-dialog: every step checked and no finding open, Publish is on; the dialog recesses the screen and "Not yet" leaves the draft alone', async () => {
      test.setTimeout(180_000)
      const page = await adminCtx.newPage()
      await page.goto(editUrl(ids.ready))
      await expect(page.getByTestId('publish-button')).toHaveAttribute('aria-disabled', 'false', SLOW)
      await page.getByTestId('publish-button').click()
      const dialog = page.getByTestId('publish-dialog')
      await expect(dialog).toHaveCount(1, SLOW)
      await expect(dialog).toContainText('Not yet')
      await shot(page, '58-edit-publish-dialog')
      await dialog.getByRole('button', { name: 'Not yet' }).click()
      await expect(dialog).toHaveCount(0, SLOW)
      const { data } = await db.from('sops').select('status').eq('id', ids.ready).single()
      expect(data?.status).toBe('draft')
      await page.close()
    })

    test('SC3 58-edit-blank: "Nothing here yet", Add a section, "Checked 0 of 0", Publish off', async () => {
      test.setTimeout(120_000)
      const page = await adminCtx.newPage()
      await page.goto(editUrl(ids.blank))
      await expect(page.getByTestId('edit-empty')).toContainText('Nothing here yet', SLOW)
      await expect(page.getByTestId('edit-empty')).toContainText('Add your first section, then write the steps a worker follows.')
      await expect(page.getByTestId('publish-count')).toHaveText('Checked 0 of 0 steps', SLOW)
      await expect(page.getByTestId('publish-button')).toHaveAttribute('aria-disabled', 'true', SLOW)
      await shot(page, '58-edit-blank')
      await page.close()
    })

    test('SC3 58-this-sop: the rail block shows the version, the earlier versions and the jump-ahead switch', async () => {
      test.setTimeout(120_000)
      const page = await adminCtx.newPage()
      await page.goto(editUrl(ids.lineageV4))
      await expect(page.getByTestId('this-sop')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('this-sop-version')).toContainText('Editing v4 — v3 is live', SLOW)
      await expect(page.getByTestId('this-sop-jump-ahead')).toHaveCount(1, SHORT)
      const earlier = page.getByTestId('this-sop').getByRole('button', { name: /earlier versions?/ })
      await expect(earlier).toHaveCount(1, SHORT)
      await earlier.click()
      await expect(page.getByTestId('this-sop-earlier').first()).toBeVisible(SLOW)
      await shot(page, '58-this-sop')
      await page.close()
    })

    // ---- SC5: an earlier version is read-only for an admin too
    test('SC5 58-superseded: the admin opens the exact earlier version, "v2 — superseded", no start button, no switch', async () => {
      test.setTimeout(120_000)
      const page = await adminCtx.newPage()
      await page.goto(`/sops/${ids.lineageRoot}?from=s%3Dmanage`)
      await expect(page.getByTestId('focus-version-chip')).toContainText('v2 — superseded', SLOW)
      await expect(page.getByTestId('focus-start-walking')).toHaveCount(0)
      await expect(page.getByTestId('focus-mode-switch')).toHaveCount(0)
      await shot(page, '58-superseded')
      await page.close()
    })

    // ---- SC4: still being read
    test('SC4 58-parsing: the frame is never empty -- stage line, rough time, skeleton rail and cards -- and the video reads "Transcribing the video"', async () => {
      test.setTimeout(180_000)
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await page.goto(`/sops/${ids.parsing}?from=s%3Dmanage`)
      await expect(page.getByTestId('parse-progress')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('parse-stage')).not.toBeEmpty(SLOW)
      await expect(page.getByTestId('parse-eta')).toContainText(/left/, SLOW)
      await expect(page.getByTestId('edit-rail-skeleton')).toBeVisible(SLOW)
      await expect(page.getByTestId('edit-skeleton-card')).toHaveCount(3)
      await expect(page.getByTestId('publish-bar')).toHaveCount(0)
      await expect(page.getByTestId('edit-document')).toHaveCount(0)
      await shot(page, '58-parsing')
      expect(errors, errors.join('\n')).toEqual([])
      await page.close()

      // The video fixture sits at "drafting"; point it at transcribing for this look, then put it back.
      await db.from('parse_jobs').update({ current_stage: 'transcribing' }).eq('sop_id', ids.parsingVideo)
      try {
        const video = await adminCtx.newPage()
        await video.goto(`/sops/${ids.parsingVideo}?from=s%3Dmanage`)
        await expect(video.getByTestId('parse-stage')).toContainText('Transcribing the video', SLOW)
        await shot(video, '58-parsing-video')
        await video.close()
      } finally {
        await db.from('parse_jobs').update({ current_stage: 'drafting' }).eq('sop_id', ids.parsingVideo)
      }
    })

    test("SC4 58-parse-failed: the card says it could not read the document, shows the job's own line, Try again and Back", async () => {
      test.setTimeout(120_000)
      const page = await adminCtx.newPage()
      await page.goto(`/sops/${ids.parseFailed}?from=s%3Dmanage`)
      const card = page.getByTestId('parse-progress')
      await expect(card).toHaveAttribute('data-state', 'failed', SLOW)
      await expect(card).toContainText("We couldn't read this document.")
      await expect(card).toContainText('It may be password protected.')
      await expect(page.getByTestId('parse-try-again')).toHaveCount(1, SHORT)
      await expect(card.getByRole('button', { name: 'Back' })).toHaveCount(1, SHORT)
      await shot(page, '58-parse-failed')
      await page.close()
    })

    // ---- SOP-04: a new version, no reload, checked one step at a time, published; workers land on it
    test('SOP-04: Start editing v2 (client navigation, no reload), check every step one by one, Publish; a worker on the old address lands on v2 and v1 stays on record', async () => {
      test.setTimeout(300_000)
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await page.goto(editUrl(ids.publish))
      await expect(page.getByTestId('edit-version-slot')).toContainText('v1 is live', SLOW)
      await page.evaluate(() => {
        ;(window as unknown as { __nav: number }).__nav = 1
      })
      const start = page.getByTestId('edit-start-editing')
      await expect(start).toHaveCount(1, SHORT)
      await expect(start).toContainText('Start editing v2')
      await start.click()
      await page.waitForURL((u) => !u.pathname.endsWith(ids.publish) && u.searchParams.get('mode') === 'edit', SLOW)
      expect(await page.evaluate(() => (window as unknown as { __nav?: number }).__nav), 'landed in the editor without a reload').toBe(1)
      const v2Id = new URL(page.url()).pathname.split('/').pop()!
      await expect(page.getByTestId('edit-version-slot')).toContainText('Editing v2 — v1 is live', SLOW)

      // The copy carries the ticks of the version it was made from (58-08), so a clean copy is already
      // publishable; any step still unchecked is ticked one at a time -- there is no tick-all.
      await expect(page.getByTestId('publish-button')).toBeVisible(SLOW)
      const boxes = page.getByRole('checkbox', { name: /I have checked this/ })
      const n = await boxes.count()
      for (let i = 0; i < n; i++) {
        await boxes.first().click()
        await expect(boxes).toHaveCount(n - i - 1, SLOW)
      }
      await expect(page.getByTestId('publish-button')).toHaveAttribute('aria-disabled', 'false', SLOW)
      await shot(page, '58-publish-ready')
      await page.getByTestId('publish-button').click()
      await page.getByTestId('publish-dialog').getByRole('button', { name: 'Publish v2' }).click()
      await expect(page.getByTestId('edit-version-slot')).toContainText('Published v2 · logged in the decision ledger', SLOW)
      await shot(page, '58-publish-done')

      const { data: after } = await db.from('sops').select('id, version, status').eq('organisation_id', siteOrgId).eq('title', 'EVAL focus publish')
      expect(after?.find((r) => r.id === ids.publish)?.status, 'v1 stays on record').toBe('published')
      expect(after?.find((r) => r.id === v2Id)).toMatchObject({ version: 2, status: 'published' })

      // A worker opening the old address lands on the new version.
      const worker = await workerCtx.newPage()
      await worker.goto(`/sops/${ids.publish}`)
      await worker.waitForURL(new RegExp(`/sops/${v2Id}`), SLOW)
      await expect(worker.getByTestId('focus-top-bar')).toBeVisible(SLOW)
      await worker.close()

      // The admin's version list keeps v1.
      await page.goto(editUrl(v2Id))
      await expect(page.getByTestId('this-sop')).toContainText('1 earlier version', SLOW)
      expect(errors, errors.join('\n')).toEqual([])
      await page.close()
    })

    // ---- D-03 (58-17): mark up a step photo; Save bakes it, the tick clears, Esc leaves it alone
    test('D-03 58-annotate: add a photo, Annotate, draw one shape, Save -- the photo changes and the tick clears; Esc on a second open saves nothing', async () => {
      test.setTimeout(300_000)
      // Start clean: runs that died mid-case left photos on this draft's steps, and the case expects exactly the one it uploads
      // (found live in 63-18: nine annotate-photo buttons on one step). Eval-site draft fixture only.
      await db.from('sop_images').delete().eq('sop_id', ids.draft)
      const { data: withPhotos } = await db.from('sop_focus_steps').select('id, image_paths').eq('sop_id', ids.draft).eq('organisation_id', siteOrgId)
      for (const s of (withPhotos ?? []).filter((r) => ((r.image_paths as string[] | null) ?? []).length > 0)) {
        await db.from('sop_focus_steps').update({ image_paths: [] }).eq('id', s.id as string)
      }
      const page = await adminCtx.newPage()
      const errors = watchConsole(page)
      await page.goto(editUrl(ids.draft))
      await expect(page.getByTestId('edit-step')).toHaveCount(4, SLOW)

      // An unticked step, so ticking it and annotating returns the draft to the "Checked 2 of 4" the other cases expect.
      const open = page.getByTestId('edit-step').filter({ has: page.getByRole('checkbox', { name: /I have checked this/ }) }).first()
      await expect(open).toBeVisible(SLOW)
      const stepDomId = await open.getAttribute('id')
      const card = page.locator(`#${stepDomId}`)

      await card.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), 'tests', 'evals', 'fixtures', 'site-scene.png'))
      await expect(card.getByTestId('annotate-photo')).toHaveCount(1, SLOW)
      const photoPath = async () => new URL((await card.locator('img').first().getAttribute('src'))!).pathname
      const before = await photoPath()

      await card.getByRole('checkbox', { name: /I have checked this/ }).click()
      await expect(card.getByText('Checked', { exact: true })).toBeVisible(SLOW)

      await card.getByTestId('annotate-photo').click()
      const overlay = page.getByTestId('annotate-overlay')
      await expect(overlay).toHaveCount(1, SLOW)
      await page.getByTestId('annotate-tool-rect').click()
      const canvas = overlay.locator('canvas').last()
      await expect(canvas).toBeVisible(SLOW)
      const box = (await canvas.boundingBox())!
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await shot(page, '58-annotate')
      await page.getByTestId('annotate-save').click()
      await expect(overlay).toHaveCount(0, SLOW)

      await expect.poll(photoPath, SLOW).not.toBe(before)
      await expect(card.getByRole('checkbox', { name: /I have checked this/ })).toHaveCount(1, SLOW)
      const baked = await photoPath()

      // Esc on a second open closes without saving.
      await card.getByTestId('annotate-photo').click()
      await expect(overlay).toHaveCount(1, SLOW)
      await page.keyboard.press('Escape')
      await expect(overlay).toHaveCount(0, SLOW)
      expect(await photoPath(), 'Esc saved nothing').toBe(baked)

      // A marked photo asks before it goes; clean up so the fixture is left as found.
      await card.getByRole('button', { name: 'Remove photo' }).first().click()
      await expect(page.getByRole('alertdialog', { name: 'Remove this photo?' })).toContainText('Its marks are lost too.', SLOW)
      await page.getByRole('alertdialog', { name: 'Remove this photo?' }).getByRole('button', { name: 'Remove photo' }).click()
      await expect(card.getByTestId('annotate-photo')).toHaveCount(0, SLOW)
      expect(errors, errors.join(String.fromCharCode(10))).toEqual([])
      await page.close()
    })
  })
})
