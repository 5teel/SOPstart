/**
 * Deployed-site eval -- Phase 63 "the SOPstart start" (the fuse), re-cut by ADR-0012: the merge plays
 * centred in the SOP's pane and settles into the run bar; the same list becomes the checklist. Runs via
 * `npm run eval -- --phase 63` or one file at a time with EVAL_BASE_URL set.
 *
 * The merge is motion: assertions cannot see it. Case 1 plays it x4 slower (?fuse=slow, a
 * development aid) and screenshots seven moments (63-fuse-1 .. 63-fuse-7) that are READ against the
 * five stages of the ADR-0012 contract. The rest prove the contract around it: skip, short and
 * reduced-motion variants, a second start in one session, resume wording.
 *
 * Fixture: the eval-site walk SOP (five steps: hazard, PPE, step, photo step, check). Its walks and
 * completions are cleared before and after. Eval-site org only. Self-skips without EVAL_BASE_URL.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import path from 'node:path'
import { EVAL_ENV_READY, EVAL_WALK_SOP_TITLE, signInAs } from './lib/session'
import { ensurePlantFixture, shot } from './lib/plant-fixture'
import { ensureLibraryAreas } from './lib/library-fixture'
import { deleteEvalCompletions } from './lib/completion-cleanup'
import { press, rowOfKind } from './lib/walk'

const SLOW = { timeout: 30_000 }
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const FRAMES = path.join(process.cwd(), '.planning', 'evals', 'latest')
/** Moments (ms after the tap, x4 slow) the merge is photographed: lift, gather x3, arm, say, settle. */
const MARKS = [400, 2000, 4000, 6300, 9000, 11500, 15500]

let cookies: Awaited<ReturnType<BrowserContext['cookies']>> | null = null

/** A fresh context for the eval-site worker; the session is minted once and replayed (OTP budget). */
async function workerContext(browser: import('@playwright/test').Browser, viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport, baseURL: process.env.EVAL_BASE_URL })
  if (cookies) await ctx.addCookies(cookies)
  else {
    await signInAs(ctx, 'siteWorker')
    cookies = await ctx.cookies()
  }
  return ctx
}

const layerKids = (page: Page) => page.locator('#fuse-layer > *').count()

/** Read: wait for the start button. */
async function openRead(page: Page, sopId: string, extra = '') {
  await page.goto(`/?sop=${sopId}${extra}`)
  await expect(page.getByTestId('read-start')).toBeVisible(SLOW)
}

/** Stop: the run keeps its ticks and the same view is reading again. */
async function stopToRead(page: Page) {
  await page.getByTestId('run-stop').click()
  await expect(page.getByTestId('read-view')).toHaveAttribute('data-state', 'reading', SLOW)
  await expect(page.getByTestId('read-start')).toBeVisible(SLOW)
}

/** Install a recorder that notes whether #fuse-layer ever held a node. */
async function watchLayer(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __fuseSeen: number }
    w.__fuseSeen = 0
    const layer = document.getElementById('fuse-layer')!
    new MutationObserver(() => {
      if (layer.children.length > 0) w.__fuseSeen++
    }).observe(layer, { childList: true })
  })
}
const layerSeen = (page: Page) => page.evaluate(() => (window as unknown as { __fuseSeen: number }).__fuseSeen)

test.describe.serial('Phase 63 -- the SOPstart start (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let walkId: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await ensurePlantFixture(db)
    const lib = await ensureLibraryAreas(db)
    const { data: walk } = await db.from('sops').select('id').eq('organisation_id', lib.siteOrgId).eq('title', EVAL_WALK_SOP_TITLE).maybeSingle()
    if (!walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" not found -- run node scripts/eval-fixtures.mjs`)
    walkId = walk.id as string
    await deleteEvalCompletions(db, walkId)
  })

  test.afterAll(async () => {
    if (EVAL_ENV_READY && db && walkId) await deleteEvalCompletions(db, walkId)
  })

  test('FUSE-01 start plays the merge centred in the SOP pane and settles into the run bar (slow-motion frames)', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId, '&fuse=slow')
      // The first start of the day plays in full: forget that today has been used.
      await page.evaluate(() => localStorage.removeItem('sopstart-fuse-day'))
      await watchLayer(page)
      await shot(page, '63-fuse-0-read')
      const pane = (await page.getByTestId('home-reader').boundingBox())!

      const t0 = Date.now()
      await page.getByTestId('read-start').click()
      const kids: number[] = []
      let blocked = ''
      let hero: { x: number; y: number; width: number; height: number } | null = null
      for (let i = 0; i < MARKS.length; i++) {
        const wait = MARKS[i] - (Date.now() - t0)
        if (wait > 0) await page.waitForTimeout(wait)
        const at = Date.now() - t0
        await page.screenshot({ path: path.join(FRAMES, `63-fuse-${i + 1}.png`) })
        kids.push(await layerKids(page))
        if (i === 1) {
          // Input is never blocked: every overlay node ignores the pointer.
          blocked = await page.evaluate(() =>
            Array.from(document.querySelectorAll('#fuse-layer > *'))
              .map((n) => getComputedStyle(n).pointerEvents)
              .filter((v) => v !== 'none')
              .join(','),
          )
        }
        if (i === 5) hero = await page.locator('#fuse-layer .wm').boundingBox()
        console.log(`63-fuse-${i + 1} taken at ${at} ms, layer nodes ${kids[i]}`)
      }
      expect(blocked, 'overlay nodes taking pointer events').toBe('')
      expect(Math.max(...kids), 'the layer held the merge nodes').toBeGreaterThanOrEqual(4)
      expect(await layerSeen(page)).toBeGreaterThan(0)
      // ADR-0012: at hero size the joined wordmark is large and centred in the pane.
      expect(hero, 'the wordmark was on screen at the hold').not.toBeNull()
      expect(hero!.width, 'hero width').toBeGreaterThanOrEqual(Math.min(pane.width * 0.5, 400))
      expect(Math.abs(hero!.x + hero!.width / 2 - (pane.x + pane.width / 2)), 'centred across the pane').toBeLessThan(24)

      // The merge ends: layer empty, the same page now running, the wordmark in the run bar.
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      expect(new URL(page.url()).pathname).toBe('/')
      await expect(page.getByTestId('read-view')).toHaveAttribute('data-state', 'running')
      await expect(rowOfKind(page, 'hazard')).toHaveAttribute('data-state', 'next')
      expect(await page.evaluate(() => document.documentElement.dataset.fuse)).toBeUndefined()
      expect(await page.getByTestId('run-bar').locator('[data-wm-target]').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible')
      await shot(page, '63-fuse-8-running')
      await page.getByTestId('run-stop').click()
    } finally {
      await ctx.close()
    }
  })

  test('FUSE-01 a press during the merge skips it; the second start of the day is short; reduced motion cuts', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      // Skip: a full merge, cut short by a click anywhere.
      await openRead(page, walkId, '&fuse=slow')
      await page.evaluate(() => localStorage.removeItem('sopstart-fuse-day'))
      await page.getByTestId('read-start').click()
      await page.waitForTimeout(1200)
      expect(await layerKids(page)).toBeGreaterThan(0)
      const tSkip = Date.now()
      await page.mouse.click(5, 5)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      console.log(`skip: layer empty ${Date.now() - tSkip} ms after the press`)
      expect(Date.now() - tSkip, 'a skip ends the merge at once').toBeLessThan(4000)
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await page.getByTestId('run-stop').click()

      // Today is used now: this start is the short one, timed at real speed (drop the x4 judging flag).
      await page.evaluate(() => sessionStorage.removeItem('sopstart-fuse-slow'))
      await openRead(page, walkId)
      await watchLayer(page)
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
      await page.waitForTimeout(500)
      let t0 = Date.now()
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      const shortMs = Date.now() - t0
      console.log(`short start: settled after ${shortMs} ms`)
      expect(await layerSeen(page), 'the short merge still draws').toBeGreaterThan(0)
      expect(await page.locator('.fuse-caption').count(), 'no caption on the short merge').toBe(0)

      // Reduced motion: no animation at all, only the cut.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await stopToRead(page)
      await watchLayer(page)
      t0 = Date.now()
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      const reducedMs = Date.now() - t0
      console.log(`reduced start: running after ${reducedMs} ms`)
      expect(shortMs - reducedMs, `short ${shortMs} ms vs cut ${reducedMs} ms`).toBeLessThan(2800)
      expect(await layerSeen(page), 'reduced motion never touched the layer').toBe(0)
      await shot(page, '63-fuse-reduced')
      await page.getByTestId('run-stop').click()
    } finally {
      await ctx.close()
    }
  })

  test('FUSE-02 start turns the same list into the checklist; Stop returns to reading; a second start works', async ({ browser }) => {
    test.setTimeout(240_000)
    await deleteEvalCompletions(db, walkId)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId)
      await expect(page.locator('[data-testid="step-row"][data-state="read"]')).toHaveCount(5, SLOW)
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await expect(page.getByTestId('run-progress')).toHaveText('0 of 5 ticked')
      await expect(page.getByTestId('step-tick')).toHaveCount(5)
      await expect(rowOfKind(page, 'hazard')).toHaveAttribute('data-state', 'next')
      await shot(page, '63-fuse-landed')

      await stopToRead(page)
      await shot(page, '63-fuse-stopped-read')

      // The second start in the same session (in-memory flow: CLAUDE.md 2026-10-03).
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await expect(rowOfKind(page, 'hazard')).toHaveAttribute('data-state', 'next')
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      await stopToRead(page)
    } finally {
      await ctx.close()
    }
  })

  test('PERF-01 a tick shows at once; three quick ticks are all saved (still there after a reload)', async ({ browser }) => {
    test.setTimeout(240_000)
    await deleteEvalCompletions(db, walkId)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId)
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      // Click to ticked, measured in the page: the box must not wait on the server.
      const shown: number[] = []
      for (const kind of ['hazard', 'ppe', 'step'] as const) {
        const row = rowOfKind(page, kind).first()
        await expect(row.getByTestId('step-tick')).toBeEnabled(SLOW)
        const ms = await row.evaluate(
          (el) =>
            new Promise<number>((resolve) => {
              const t0 = performance.now()
              const obs = new MutationObserver(() => {
                if (el.getAttribute('data-state') === 'done') {
                  obs.disconnect()
                  resolve(performance.now() - t0)
                }
              })
              obs.observe(el, { attributes: true, attributeFilter: ['data-state'] })
              ;(el.querySelector('[data-testid="step-tick"]') as HTMLButtonElement).click()
            }),
        )
        shown.push(Math.round(ms))
      }
      console.log(`tick shown after ${shown.join(' / ')} ms`)
      for (const ms of shown) expect(ms).toBeLessThan(150)
      await expect(page.getByTestId('run-progress')).toHaveText('3 of 5 ticked')
      // The writes land in order on the server, then a reload picks up at step 4.
      await expect
        .poll(async () => {
          const { data } = await db.from('sop_walks').select('done').eq('sop_id', walkId).eq('status', 'in_progress').maybeSingle()
          return Object.keys((data?.done as Record<string, string> | null) ?? {}).length
        }, SLOW)
        .toBe(3)
      await openRead(page, walkId)
      await expect(page.getByTestId('read-view')).toContainText('Picks up at step 4 of 5', SLOW)
    } finally {
      await ctx.close()
    }
  })

  test('FUSE-02 a stopped SOP picks up at step N; begin from step 1 asks first', async ({ browser }) => {
    test.setTimeout(300_000)
    await deleteEvalCompletions(db, walkId)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId)
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await press(page) // hazard
      await press(page) // PPE
      await expect(page.getByTestId('run-progress')).toHaveText('2 of 5 ticked', SLOW)
      await stopToRead(page)

      await expect(page.getByTestId('read-status')).toContainText('You stopped at step 3', SLOW)
      await expect(page.getByTestId('read-view')).toContainText('Picks up at step 3 of 5')
      // Recent and the area group both list the row: the first is the Recent one (on a computer the list folds; open it).
      await page.getByTestId('panel-list').click()
      await expect(page.locator(`[data-testid="sop-row"][data-sop-id="${walkId}"]`).first()).toContainText('You stopped at step 3', SLOW)
      await page.getByTestId('panel-list').click()
      await shot(page, '63-fuse-resume-read')

      // start picks up: steps 1 and 2 ticked, step 3 next.
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('run-progress')).toHaveText('2 of 5 ticked', SLOW)
      await expect(rowOfKind(page, 'step').first()).toHaveAttribute('data-state', 'next')
      await stopToRead(page)

      // "or begin from step 1" asks first, in place.
      await page.getByTestId('read-begin-again').click()
      await expect(page.getByTestId('walk-start-over-dialog')).toBeVisible(SLOW)
      await shot(page, '63-fuse-begin-again')

      // Keep going closes it and nothing is discarded.
      await page.getByRole('button', { name: 'Keep going' }).click()
      await expect(page.getByTestId('walk-start-over-dialog')).toHaveCount(0)
      await expect(page.getByTestId('read-view')).toContainText('Picks up at step 3 of 5')
      const { data: walks } = await db.from('sop_walks').select('done, status').eq('sop_id', walkId).eq('status', 'in_progress')
      expect(walks?.length).toBe(1)
      expect(Object.keys((walks![0].done as Record<string, unknown>) ?? {}).length).toBe(2)
      await shot(page, '63-fuse-kept-going')
    } finally {
      await ctx.close()
    }
  })

  test('FUSE-01 the merge on a phone (390 px, slow motion)', async ({ browser }) => {
    test.setTimeout(240_000)
    await deleteEvalCompletions(db, walkId)
    const ctx = await workerContext(browser, PHONE)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId, '&fuse=slow')
      await page.evaluate(() => localStorage.removeItem('sopstart-fuse-day'))
      const t0 = Date.now()
      await page.getByTestId('read-start').click()
      for (const [i, mark] of [400, 2400, 4300, 6500, 9000].entries()) {
        const wait = mark - (Date.now() - t0)
        if (wait > 0) await page.waitForTimeout(wait)
        await page.screenshot({ path: path.join(FRAMES, `63-fuse-phone-${i + 1}.png`) })
      }
      await expect(page.getByTestId('run-bar')).toBeVisible(SLOW)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      const w = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(w).toBeLessThanOrEqual(PHONE.width)
      await shot(page, '63-fuse-phone-running')
      await page.getByTestId('run-stop').click()
    } finally {
      await ctx.close()
    }
  })
})
