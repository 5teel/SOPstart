/**
 * Deployed-site eval -- Phase 63 home addresses (63-14). Every way into the app lands on the right
 * section of the new home, old or new, stored or typed: legacy ?place= addresses, the retired
 * pages' redirects, a stored notification place, and the Back from a bridged page.
 *
 * Fixtures: the isolated "SOPstart Eval Site" org (ensurePlantFixture + ensureLibraryAreas). The one
 * row this file seeds (a worker's completion, a notification) is deleted in afterAll. Assertions are
 * by testid and address, never a total count (CLAUDE.md 2026-09-29); every one that follows a fresh
 * navigation carries SLOW. Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 * Screenshots: 63-addr-*.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { EVAL_ENV_READY, EVAL_WALK_SOP_TITLE, signInAs, type EvalRole } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { ensureLibraryAreas, type LibraryFixture } from './lib/library-fixture'

const SLOW = { timeout: 30_000 }
const DESKTOP = { width: 1440, height: 900 }
const NOTE_KEY = 'eval-63-addr-note'
const NOTE_TITLE = '63 eval stored office place'

type Creds = { cookies: Awaited<ReturnType<BrowserContext['cookies']>>; userId: string }
const minted = new Map<EvalRole, Creds>()

/** Install a session for `role`, minting it only the first time (each mint spends the shared OTP budget). */
async function loginAs(ctx: BrowserContext, role: EvalRole): Promise<string> {
  const have = minted.get(role)
  if (have) {
    await ctx.addCookies(have.cookies)
    return have.userId
  }
  const session = await signInAs(ctx, role)
  minted.set(role, { cookies: await ctx.cookies(), userId: session.user.id })
  return session.user.id
}

async function asRole<T>(browser: Browser, role: EvalRole, fn: (page: Page, userId: string) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport: DESKTOP, baseURL: process.env.EVAL_BASE_URL })
  try {
    const userId = await loginAs(ctx, role)
    return await fn(await ctx.newPage(), userId)
  } finally {
    await ctx.close()
  }
}

/** The page settled on this exact path and query. */
const atAddress = (page: Page, search: string) =>
  expect(page, `address ${search}`).toHaveURL((u) => u.pathname === '/' && u.search === search, SLOW)

test.describe.serial('Phase 63 -- home addresses (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let lib: LibraryFixture
  let siteOrgId: string
  let formingId: string
  let walkSopId: string
  let walkSopVersion = 1
  const seededCompletions: string[] = []

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    await ensurePlantFixture(db)
    lib = await ensureLibraryAreas(db)
    siteOrgId = lib.siteOrgId
    if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

    const { data: forming } = await db.from('departments').select('id').eq('organisation_id', siteOrgId).eq('name', 'Forming').maybeSingle()
    if (!forming) throw new Error('Forming department not found in the eval-site org')
    formingId = forming.id as string

    const { data: walk } = await db.from('sops').select('id, version').eq('organisation_id', siteOrgId).eq('title', EVAL_WALK_SOP_TITLE).maybeSingle()
    if (!walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" not found -- run node scripts/eval-fixtures.mjs`)
    walkSopId = walk.id as string
    walkSopVersion = (walk.version as number) ?? 1
  })

  test.afterAll(async () => {
    if (!EVAL_ENV_READY || !db) return
    // Only rows this file seeded, eval-site org only.
    if (seededCompletions.length) await db.from('sop_completions').delete().in('id', seededCompletions).eq('organisation_id', siteOrgId)
    await db.from('notifications').delete().eq('dedupe_key', NOTE_KEY).eq('organisation_id', siteOrgId)
  })

  test('HOME-05 legacy ?place= addresses land on their section', async ({ browser }) => {
    test.setTimeout(300_000)
    await asRole(browser, 'siteAdmin', async (page) => {
      const errors = watchConsole(page)
      const cases: Array<{ name: string; from: string; search: string; check: () => Promise<void> }> = [
        {
          name: 'office',
          from: '/?place=office',
          search: '?s=signoffs',
          check: async () => {
            await expect(page.getByTestId('section-signoffs')).toBeVisible(SLOW)
            await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'inbox', SLOW)
          },
        },
        {
          name: 'office-requests',
          from: '/?place=office&tab=requests',
          search: '?s=signoffs&tab=requests',
          check: async () => {
            await expect(page.getByTestId('section-signoffs')).toBeVisible(SLOW)
            await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'requests', SLOW)
          },
        },
        {
          name: 'office-people',
          from: '/?place=office&tab=people',
          search: '?s=people',
          check: async () => {
            await expect(page.getByTestId('section-people')).toBeVisible(SLOW)
            await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'people', SLOW)
          },
        },
        {
          name: 'smoko',
          from: '/?place=smoko',
          search: '?s=record',
          check: async () => {
            await expect(page.getByTestId('section-record').getByRole('heading', { name: 'My record' })).toBeVisible(SLOW)
          },
        },
        {
          name: 'workshop',
          from: '/?place=workshop',
          search: '?s=manage',
          check: async () => {
            await expect(page.getByTestId('section-manage').getByRole('heading', { name: 'Manage SOPs' })).toBeVisible(SLOW)
            await expect(page.getByTestId('manage-new')).toBeVisible(SLOW)
          },
        },
        {
          name: 'noticeboard',
          from: '/?place=noticeboard',
          search: '',
          check: async () => {
            await expect(page.getByTestId('home-section-sops')).toHaveAttribute('aria-current', 'page', SLOW)
            await expect(page.getByTestId('sop-list')).toBeVisible(SLOW)
          },
        },
        {
          name: 'edit',
          from: '/?place=edit',
          search: '?s=manage&view=site',
          check: async () => {
            await expect(page.getByTestId('section-manage')).toBeVisible(SLOW)
            await expect(page.getByTestId('site-edit-done')).toBeVisible(SLOW)
            await expect(page.getByTestId('manage-site')).toHaveCount(0)
          },
        },
        {
          name: 'dept',
          from: `/?place=dept:${formingId}`,
          search: `?area=${formingId}`,
          check: async () => {
            await expect(page.getByTestId('area-filter')).toContainText('In Forming', SLOW)
          },
        },
      ]
      for (const c of cases) {
        await page.goto(c.from)
        await atAddress(page, c.search)
        await expect(page.getByTestId('home')).toBeVisible(SLOW)
        await c.check()
        await shot(page, `63-addr-place-${c.name}`)
      }
      expect(errors, errors.join('\n')).toEqual([])
    })
  })

  test('HOME-05 /activity, /admin/training, /admin/team, /governance and /admin/site redirect to their sections', async ({ browser }) => {
    test.setTimeout(300_000)
    await asRole(browser, 'siteAdmin', async (page) => {
      const errors = watchConsole(page)
      const cases: Array<{ name: string; from: string; search: string; testid: string }> = [
        { name: 'activity', from: '/activity', search: '?s=record', testid: 'section-record' },
        { name: 'training', from: '/admin/training', search: '?s=training', testid: 'section-training' },
        { name: 'team', from: '/admin/team', search: '?s=people', testid: 'section-people' },
        { name: 'governance', from: '/governance', search: '?s=signoffs', testid: 'section-signoffs' },
        { name: 'site', from: '/admin/site', search: '?s=manage&view=site', testid: 'section-manage' },
      ]
      for (const c of cases) {
        await page.goto(c.from)
        await atAddress(page, c.search)
        await expect(page.getByTestId(c.testid), c.from).toBeVisible(SLOW)
        await shot(page, `63-addr-redirect-${c.name}`)
      }
      // Training holds the matrix and the assessment screens the retired page carried.
      await page.goto('/admin/training')
      await expect(page.getByTestId('section-training').getByRole('heading', { name: 'Training' })).toBeVisible(SLOW)
      expect(errors, errors.join('\n')).toEqual([])
    })

    // A worker who types an address they cannot open gets the home, not an error and not that section.
    await asRole(browser, 'siteWorker', async (page) => {
      await page.goto('/admin/training')
      await expect(page.getByTestId('home-section-sops')).toHaveAttribute('aria-current', 'page', SLOW)
      await expect(page.getByTestId('section-training')).toHaveCount(0)
      await page.goto('/activity')
      await atAddress(page, '?s=record')
      await expect(page.getByTestId('section-record')).toBeVisible(SLOW)
      await shot(page, '63-addr-redirect-worker-activity')
    })
  })

  test('HOME-05 a stored notification place opens the right section', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteAdmin', async (page, userId) => {
      await db.from('notifications').delete().eq('dedupe_key', NOTE_KEY).eq('user_id', userId)
      // A place written before Phase 63: the old office address.
      const { error } = await db.from('notifications').insert({
        organisation_id: siteOrgId,
        user_id: userId,
        kind: 'review_due',
        title: NOTE_TITLE,
        place: '/?place=office',
        subject_type: 'sop',
        subject_id: lib.sopIds.packing,
        dedupe_key: NOTE_KEY,
      })
      if (error) throw new Error(`notification seed failed: ${error.message}`)

      await page.goto('/?s=record')
      const row = page.getByTestId('notification-row').filter({ hasText: NOTE_TITLE })
      await expect(row).toBeVisible(SLOW)
      await shot(page, '63-addr-note-before')
      await row.first().click()
      await expect(page.getByTestId('section-signoffs')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'inbox', SLOW)
      await expect(page).toHaveURL((u) => u.pathname === '/' && u.search.includes('s=signoffs'), SLOW)
      await shot(page, '63-addr-note-after')
    })
  })

  test('HOME-05 Back from a bridged page returns to its section', async ({ browser }) => {
    test.setTimeout(300_000)
    let completionId = ''
    await asRole(browser, 'siteWorker', async (page, userId) => {
      completionId = randomUUID()
      const { error } = await db.from('sop_completions').insert({
        id: completionId,
        organisation_id: siteOrgId,
        sop_id: walkSopId,
        worker_id: userId,
        sop_version: walkSopVersion,
        content_hash: 'eval-63-addr',
        status: 'signed_off',
        step_data: {},
      })
      if (error) throw new Error(`completion seed failed: ${error.message}`)
      seededCompletions.push(completionId)

      await page.goto(`/activity/${completionId}`)
      const back = page.getByTestId('back-to-site').locator('a')
      await expect(back).toHaveAttribute('href', '/?s=record', SLOW)
      await expect(page.getByRole('link', { name: 'My record' })).toHaveAttribute('href', '/?s=record', SLOW)
      await shot(page, '63-addr-completion-worker')
      await back.click()
      await atAddress(page, '?s=record')
      await expect(page.getByTestId('section-record')).toBeVisible(SLOW)
    })

    // Someone else's completion is not theirs to read: the server sends them to Sign-offs.
    await asRole(browser, 'siteAdmin', async (page) => {
      await page.goto(`/activity/${completionId}`)
      await atAddress(page, '?s=signoffs')
      await expect(page.getByTestId('section-signoffs')).toBeVisible(SLOW)
      await shot(page, '63-addr-completion-admin-away')

      // Settings is a page the home opens: its Back is Manage.
      await page.goto('/admin/settings')
      const back = page.getByTestId('back-to-site').locator('a')
      await expect(back).toHaveAttribute('href', '/?s=manage', SLOW)
      await back.click()
      await atAddress(page, '?s=manage')
      await expect(page.getByTestId('section-manage')).toBeVisible(SLOW)
    })
  })

  test('HOME-05 signed-out / still shows the promo reel', async ({ browser }) => {
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ viewport: DESKTOP, baseURL: process.env.EVAL_BASE_URL })
    try {
      const page = await ctx.newPage()
      await page.goto('/')
      await expect(page).toHaveURL(/\/welcome$/, SLOW)
      await expect(page.getByTestId('promo-reel')).toHaveAttribute('data-scene', /.+/, { timeout: 25_000 })
      await expect(page.getByTestId('home')).toHaveCount(0)
      await shot(page, '63-addr-signed-out')
    } finally {
      await ctx.close()
    }
  })
})
