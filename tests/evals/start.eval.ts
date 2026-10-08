/**
 * Deployed-site eval -- Phase 63 "the SOPstart start" (the fuse), 63-15. Runs via
 * `npm run eval -- --phase 63` or one file at a time with EVAL_BASE_URL set.
 *
 * The merge is motion: assertions cannot see it. Case 1 plays it x4 slower (?fuse=slow, a
 * development aid) and screenshots six moments (63-fuse-1 .. 63-fuse-6) that are READ against the
 * five stages of sketch 010. The rest prove the contract around it: short and reduced-motion
 * variants, start landing in the running SOP, a second start in one session, resume wording.
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
import { press, stepOfKind } from './lib/walk'

const SLOW = { timeout: 30_000 }
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const FRAMES = path.join(process.cwd(), '.planning', 'evals', 'latest')
/** Moments (ms after the tap) at which the slow-motion merge is photographed: fade, fade nearly done, drop, drop, slide, tape, rise. */
const MARKS = [150, 650, 900, 1800, 2800, 4200, 6500]

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

/** From the running SOP back to Read of the same SOP. */
async function stopToRead(page: Page, sopId: string) {
  await page.getByTestId('focus-back').click()
  await expect(page).toHaveURL(new RegExp(`/\\?(?:[^#]*&)?sop=${sopId}`), SLOW)
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

  test('FUSE-01 start plays the merge into the running SOP (slow-motion frames)', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId, '&fuse=slow')
      // The first start of the day plays in full: forget that today has been used.
      await page.evaluate(() => localStorage.removeItem('sopstart-fuse-day'))
      await watchLayer(page)
      await shot(page, '63-fuse-0-read')

      const t0 = Date.now()
      await page.getByTestId('read-start').click()
      const kids: number[] = []
      let blocked = ''
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
        console.log(`63-fuse-${i + 1} taken at ${at} ms, layer nodes ${kids[i]}`)
      }
      expect(blocked, 'overlay nodes taking pointer events').toBe('')
      expect(Math.max(...kids), 'the layer held the merge nodes').toBeGreaterThanOrEqual(3)
      expect(await layerSeen(page)).toBeGreaterThan(0)

      // The merge ends: layer empty, landed in the running SOP with its first step, the wordmark in the bar.
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      const url = new URL(page.url())
      expect(url.pathname).toBe(`/sops/${walkId}`)
      expect(url.searchParams.has('go'), 'the go flag is stripped').toBe(false)
      await expect(page.getByTestId('focus-top-bar').locator('[data-wm-target]')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.dataset.fuse)).toBeUndefined()
      expect(await page.getByTestId('focus-top-bar').locator('[data-wm-target]').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible')
      await shot(page, '63-fuse-8-running')
    } finally {
      await ctx.close()
    }
  })

  test('FUSE-01 the second start of the day is short; reduced motion cuts', async ({ browser }) => {
    test.setTimeout(240_000)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      // The first case left a walk at step 1 and marked today as used: this start is the short one.
      await openRead(page, walkId)
      await page.evaluate(() => localStorage.setItem('sopstart-fuse-day', new Date().toDateString()))
      await watchLayer(page)
      let t0 = Date.now()
      await page.getByTestId('read-start').click()
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      const shortMs = Date.now() - t0
      console.log(`short start: running step after ${shortMs} ms`)
      expect(shortMs, 'the running step appears quickly').toBeLessThan(2500)
      expect(await layerSeen(page), 'the short merge still draws').toBeGreaterThan(0)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)

      // Reduced motion: no animation at all, only the cut.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await stopToRead(page, walkId)
      await watchLayer(page)
      t0 = Date.now()
      await page.getByTestId('read-start').click()
      let seen = 0
      for (let i = 0; i < 30 && (await stepOfKind(page, 'hazard').count()) === 0; i++) {
        seen = Math.max(seen, await layerKids(page))
        await page.waitForTimeout(50)
      }
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      console.log(`reduced start: running step after ${Date.now() - t0} ms`)
      expect(seen, 'reduced motion draws nothing').toBe(0)
      expect(await layerSeen(page), 'reduced motion never touched the layer').toBe(0)
      await shot(page, '63-fuse-reduced')
    } finally {
      await ctx.close()
    }
  })

  test('FUSE-02 start lands on the first step and Stop returns to Read; a second start works', async ({ browser }) => {
    test.setTimeout(240_000)
    await deleteEvalCompletions(db, walkId)
    const ctx = await workerContext(browser)
    const page = await ctx.newPage()
    try {
      await openRead(page, walkId)
      await page.getByTestId('read-start').click()
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 1 of 5')
      await expect(page.getByTestId('focus-autostart')).toHaveCount(0)
      await expect(page.getByTestId('focus-start-walking')).toHaveCount(0)
      await shot(page, '63-fuse-landed')

      await stopToRead(page, walkId)
      await expect(page.getByTestId('read-view')).toBeVisible()
      await shot(page, '63-fuse-stopped-read')

      // The second start in the same session (in-memory flow: CLAUDE.md 2026-10-03).
      await page.getByTestId('read-start').click()
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 1 of 5')
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
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
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      await press(page) // hazard
      await press(page) // PPE
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 3 of 5', SLOW)
      await stopToRead(page, walkId)

      await expect(page.getByTestId('read-status')).toContainText('You stopped at step 3', SLOW)
      await expect(page.getByTestId('read-view')).toContainText('Picks up at step 3 of 5')
      // Recent and the area group both list the row: the first is the Recent one.
      await expect(page.locator(`[data-testid="sop-row"][data-sop-id="${walkId}"]`).first()).toContainText('You stopped at step 3', SLOW)
      await shot(page, '63-fuse-resume-read')

      // start lands on the running step, not step 1.
      await page.getByTestId('read-start').click()
      await expect(page.getByTestId('walk-progress')).toHaveText('Step 3 of 5', SLOW)
      await stopToRead(page, walkId)

      // "or begin from step 1" opens the focus page with the discard confirmation already asking.
      await page.getByTestId('read-begin-again').click()
      await expect(page.getByTestId('walk-start-over-dialog')).toBeVisible(SLOW)
      expect(new URL(page.url()).searchParams.has('fresh'), 'the fresh flag is stripped').toBe(false)
      await shot(page, '63-fuse-begin-again')

      // Keep going closes it and nothing is discarded.
      await page.getByRole('button', { name: 'Keep going' }).click()
      await expect(page.getByTestId('walk-start-over-dialog')).toHaveCount(0)
      await expect(page.getByTestId('walk-resume')).toContainText('Picks up at step 3 of 5')
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
      for (const [i, mark] of [150, 1500, 2800, 4200, 6500].entries()) {
        const wait = mark - (Date.now() - t0)
        if (wait > 0) await page.waitForTimeout(wait)
        await page.screenshot({ path: path.join(FRAMES, `63-fuse-phone-${i + 1}.png`) })
      }
      await expect(stepOfKind(page, 'hazard')).toHaveCount(1, SLOW)
      await expect.poll(() => layerKids(page), SLOW).toBe(0)
      const w = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(w).toBeLessThanOrEqual(PHONE.width)
      await shot(page, '63-fuse-phone-running')
    } finally {
      await ctx.close()
    }
  })
})
