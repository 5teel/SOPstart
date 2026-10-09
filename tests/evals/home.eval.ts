/**
 * Deployed-site eval -- Phase 63 "SOP-first home" (63-12). Runs via `npm run eval -- --phase 63`
 * or one file at a time with EVAL_BASE_URL set.
 *
 * Fixtures: `ensurePlantFixture` (machine-linked Forming SOP) plus `ensureLibraryAreas` (two
 * departments and a site-wide SOP) in the isolated "SOPstart Eval Site" org. Assert by NAME,
 * never a total count (CLAUDE.md 2026-09-29). The real SOPstart org is only ever READ (case 9).
 * Every assertion that follows a fresh navigation carries SLOW. Self-skips without EVAL_BASE_URL,
 * so `npm run test` never hits production.
 *
 * Sessions are minted once per role and replayed as cookies (each mint spends the shared OTP budget).
 *
 * Successor of the retired one-screen eval (Phase 57, deleted in 63-18). Every case it held maps here
 * or is retired by ADR-0004 (no pins, no due-now card, no counts) or ADR-0005 (no rooms):
 *   one screen with three panes and four signposts ......... HOME-01 (sections per role, no room words)
 *   map click equals list click, Esc returns ............... MAP-03 (area zoom, Esc, dimmed area, object opens Read)
 *   second-iteration leak (machine, room, machine) ......... HOME-03 "two SOPs in a row" (added in 63-18)
 *   search lights matching shapes .......................... HOME-02 search (title, step word, miss)
 *   the due-now card names the due SOP ..................... retired (ADR-0004 rule 2: nothing shows what is due)
 *   walk from a machine and from the notice room ........... start.eval FUSE-02 (Read start lands in the running SOP)
 *   a place deep link; a worker's edit-mode link ........... HOME-05 "?sop= opens Read, a worker section falls back" (added in 63-18)
 *   bridge page Back returns to its room ................... home-addresses "Back from a bridged page"
 *   due pins and health pins on machines ................... retired (ADR-0004 rule 2)
 *   phone list with glove-sized rows ....................... MAP-04 (tab bar, List | Site map, Read full width)
 *   supervisor and admin room pins equal the inbox counts .. retired (ADR-0004 rule 2: counts); the tabs are HOME-01 / HOME-04
 *   admin machine panel: open, edit, new SOP for a machine . HOME-03 "admin Read offers Edit" (added in 63-18); new SOP per machine retired (ADR-0004 rule 4)
 *   drafts room lists drafts and links the new-SOP flow .... HOME-04 Manage SOPs
 *   edit mode shows the site workspace and departments ..... HOME-04 Site & departments, site-editor.eval
 *   retired URLs redirect to the one screen ................ home-addresses (old addresses and retired pages)
 *   real org overview and per-room zoom shots, read only ... EVAL-01 (real org map and list)
 *   pathways map reports zero unmapped screens ............. DOCS-01
 *   signed-out root shows the promo reel ................... home-addresses "signed-out root still shows the promo reel"
 */
import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import {
  EVAL_ENV_READY,
  EVAL_WALK_SOP_TITLE,
  EVAL_PLANT_SOP_TITLE,
  signInAs,
  type EvalRole,
} from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { ensureLibraryAreas, EVAL_AREA_NAMES, EVAL_AREA_SOPS, type LibraryFixture } from './lib/library-fixture'

const SLOW = { timeout: 30_000 }
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
/** A word that occurs in exactly one fixture step (the lab SOP's). */
const LAB_STEP_WORD = 'centrifuge'
const BELL_KEY = 'eval-63-home-bell'

type Creds = { cookies: Awaited<ReturnType<BrowserContext['cookies']>>; userId: string }
const minted = new Map<EvalRole, Creds>()

/** Install a session for `role`, minting it only the first time. Returns the user id. */
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

async function asRole<T>(browser: Browser, role: EvalRole, viewport: { width: number; height: number }, fn: (page: Page, userId: string) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport, baseURL: process.env.EVAL_BASE_URL })
  try {
    const userId = await loginAs(ctx, role)
    return await fn(await ctx.newPage(), userId)
  } finally {
    await ctx.close()
  }
}

const row = (page: Page, sopId: string) => page.locator(`[data-testid="sop-row"][data-sop-id="${sopId}"]`)
const plate = (page: Page, areaId: string) => page.locator(`[data-testid="map-area"][data-area-id="${areaId}"]`)
const sectionIds = (page: Page) => page.locator('[data-testid^="home-section-"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid))
const viewBox = async (page: Page) => ((await page.getByTestId('site-map').getAttribute('viewBox')) ?? '').split(/\s+/).map(Number)
const sameBox = (a: number[], b: number[]) => a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 0.5)

/**
 * Press a map object: a real click on the group's centre; a glyph with a gap at its centre lets the
 * click land on the plate behind it, so fall back to dispatching the click on the group (same handler).
 */
async function pressObject(obj: Locator) {
  try {
    await obj.click({ timeout: 5_000 })
  } catch {
    console.log('map object centre not hittable -- dispatched the click instead')
    await obj.dispatchEvent('click')
  }
}

/** Wait for the list to hold rows (the library query landed). */
async function listReady(page: Page) {
  await expect(page.getByTestId('sop-list')).toBeVisible(SLOW)
  await expect(page.getByTestId('sop-row').first()).toBeVisible(SLOW)
}

/** The page never scrolls sideways (phone). */
async function noSideways(page: Page, label: string) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(w, `${label}: scrollWidth ${w}`).toBeLessThanOrEqual(PHONE.width)
}

test.describe.serial('Phase 63 -- SOP-first home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  let db: SupabaseClient
  let lib: LibraryFixture
  let plantSopId: string
  let walkSopId: string
  let walkSopVersion = 1
  let formingId: string
  let siteOrgId: string
  const seededCompletions: string[] = []

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const plant = await ensurePlantFixture(db)
    lib = await ensureLibraryAreas(db)
    siteOrgId = lib.siteOrgId
    if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
    plantSopId = plant.plantSopId

    // The word search finds in a step: only the lab SOP's step carries it (eval-site org, fixture-owned row).
    const upd = await db
      .from('sop_focus_steps')
      .update({ text: `Calibrate the ${LAB_STEP_WORD} rotor before use.` })
      .eq('sop_id', lib.sopIds.lab)
      .eq('source_key', 'new:eval-area-lab-step')
      .select('id')
    if (upd.error || !upd.data?.length) throw new Error(`lab step update failed: ${upd.error?.message ?? 'no row'}`)

    const { data: walk } = await db.from('sops').select('id, version').eq('organisation_id', siteOrgId).eq('title', EVAL_WALK_SOP_TITLE).maybeSingle()
    if (!walk) throw new Error(`"${EVAL_WALK_SOP_TITLE}" not found -- run node scripts/eval-fixtures.mjs`)
    walkSopId = walk.id as string
    walkSopVersion = (walk.version as number) ?? 1

    const { data: forming } = await db.from('departments').select('id').eq('organisation_id', siteOrgId).eq('name', 'Forming').maybeSingle()
    if (!forming) throw new Error('Forming department not found in the eval-site org')
    formingId = forming.id as string
  })

  test.afterAll(async () => {
    if (!EVAL_ENV_READY || !db) return
    // Only rows this file seeded, eval-site org only.
    if (seededCompletions.length) await db.from('sop_completions').delete().in('id', seededCompletions)
    await db.from('notifications').delete().eq('dedupe_key', BELL_KEY).eq('organisation_id', siteOrgId)
  })

  // ------------------------------------------------------------------ HOME-01

  test('HOME-01 worker sees My SOPs and My record only, no room words', async ({ browser }) => {
    test.setTimeout(180_000)
    await asRole(browser, 'siteWorker', DESKTOP, async (page) => {
      const errors = watchConsole(page)
      await page.goto('/')
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      await listReady(page)
      await expect(page.getByTestId('home-section-sops')).toBeVisible(SLOW)
      await expect(page.getByTestId('home-section-record')).toBeVisible(SLOW)
      expect(await sectionIds(page)).toEqual(['home-section-sops', 'home-section-record'])
      await expect(page.getByTestId('home-section-manage')).toHaveCount(0)

      // The chrome and the list say no room word. Row titles are fixture names (one holds "walk"), so strip them first.
      const text = await page.evaluate(() => {
        let t = document.body.innerText
        for (const el of Array.from(document.querySelectorAll('[data-testid="sop-row"]'))) {
          const title = el.querySelector('span.block')?.textContent
          if (title) t = t.split(title).join('')
        }
        return t
      })
      expect(text, 'room words on the home').not.toMatch(/smoko|workshop|noticeboard|\boffice\b|next for you|\bwalk\b/i)
      await shot(page, '63-home-worker-desktop')
      expect(errors, errors.join('\n')).toEqual([])
    })
  })

  test('HOME-01 sections per role (supervisor, safety manager, admin) and a forged section falls back', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteSupervisor', DESKTOP, async (page) => {
      await page.goto('/')
      await listReady(page)
      expect(await sectionIds(page)).toEqual(['home-section-sops', 'home-section-record', 'home-section-signoffs'])
      await page.getByTestId('home-section-signoffs').click()
      await expect(page.getByTestId('office-pane')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-tab-inbox')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-tab-requests')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-tab-decisions')).toHaveCount(0)
    })

    for (const role of ['siteSafety', 'siteAdmin'] as const) {
      await asRole(browser, role, DESKTOP, async (page) => {
        await page.goto('/')
        await listReady(page)
        expect(await sectionIds(page), role).toEqual([
          'home-section-sops',
          'home-section-record',
          'home-section-training',
          'home-section-signoffs',
          'home-section-people',
          'home-section-manage',
        ])
        await page.getByTestId('home-section-signoffs').click()
        await expect(page.getByTestId('office-pane')).toBeVisible(SLOW)
        for (const t of ['inbox', 'requests', 'decisions']) await expect(page.getByTestId(`office-tab-${t}`), `${role} ${t}`).toBeVisible(SLOW)
        if (role === 'siteAdmin') await shot(page, '63-home-sections-admin')
      })
    }

    // A worker who types a section they lack gets the home, not an error and not that section.
    await asRole(browser, 'siteWorker', DESKTOP, async (page) => {
      await page.goto('/?s=people')
      await listReady(page)
      await expect(page.getByTestId('home-section-sops')).toHaveAttribute('aria-current', 'page')
      await expect(page.getByTestId('section-people')).toHaveCount(0)
    })
  })

  // ------------------------------------------------------------------ HOME-02

  test('HOME-02 Recent, All SOPs by area and by type', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      await page.goto('/')
      await listReady(page)

      // By area: the four fixture areas are group headers by name.
      for (const name of EVAL_AREA_NAMES) await expect(page.getByTestId('area-group').filter({ hasText: name }), name).toHaveCount(1, SLOW)
      // Each fixture SOP names its area and type on its row.
      const meta: Array<[string, string]> = [
        [EVAL_AREA_SOPS.packing, 'EVAL Area Packing · Process'],
        [EVAL_AREA_SOPS.lab, 'EVAL Area Lab · Inspection'],
        [EVAL_AREA_SOPS.site, 'Site-wide · Emergency'],
        [EVAL_PLANT_SOP_TITLE, 'Forming · Machine'],
      ]
      for (const [title, m] of meta) await expect(page.getByTestId('sop-row').filter({ hasText: title }).first(), title).toContainText(m, SLOW)
      await shot(page, '63-home-list-area')

      // By type: Machine, Process, Inspection, Emergency each hold their fixture SOP.
      await page.getByRole('button', { name: 'Type', exact: true }).click()
      const group = (t: string) => page.locator('h3').filter({ hasText: new RegExp(`^${t}\\s*\\d+$`) }).locator('..')
      await expect(group('Machine')).toContainText(EVAL_PLANT_SOP_TITLE, SLOW)
      await expect(group('Process')).toContainText(EVAL_AREA_SOPS.packing, SLOW)
      await expect(group('Inspection')).toContainText(EVAL_AREA_SOPS.lab, SLOW)
      await expect(group('Emergency')).toContainText(EVAL_AREA_SOPS.site, SLOW)
      await shot(page, '63-home-list-type')

      // Recent: open two SOPs, newest first.
      const open = async (id: string) => {
        await row(page, id).last().click()
        await expect(page.getByTestId('read-view')).toBeVisible(SLOW)
        await expect(page).toHaveURL(new RegExp(`sop=${id}`), SLOW)
      }
      await open(lib.sopIds.packing)
      await open(lib.sopIds.lab)
      await expect(page.getByTestId('sop-row').nth(0)).toHaveAttribute('data-sop-id', lib.sopIds.lab, SLOW)
      await expect(page.getByTestId('sop-row').nth(1)).toHaveAttribute('data-sop-id', lib.sopIds.packing, SLOW)
      await expect(page.getByTestId('sop-list').getByText('Recent', { exact: true })).toBeVisible()
    })
  })

  test('HOME-02 a worker with a completion sees the SOP under Most used with "done N×"', async ({ browser }) => {
    test.setTimeout(180_000)
    await asRole(browser, 'siteWorker', DESKTOP, async (page, userId) => {
      const id = randomUUID()
      const { error } = await db.from('sop_completions').insert({
        id,
        organisation_id: siteOrgId,
        sop_id: walkSopId,
        worker_id: userId,
        sop_version: walkSopVersion,
        content_hash: 'eval-63-home',
        status: 'signed_off',
        step_data: {},
      })
      if (error) throw new Error(`completion seed failed: ${error.message}`)
      seededCompletions.push(id)

      await page.goto('/')
      await listReady(page)
      const most = page.getByTestId('sop-row').filter({ hasText: EVAL_WALK_SOP_TITLE }).filter({ hasText: /done \d+×/ })
      await expect(most.first()).toBeVisible(SLOW)
      await expect(page.getByTestId('sop-list').getByText('Most used', { exact: true })).toBeVisible()
      await shot(page, '63-home-most-used')
    })
  })

  test('HOME-02 search by title, by step text, and a miss offers Ask for one (admin also Write it)', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      await page.goto('/')
      await listReady(page)
      const search = page.getByTestId('sop-search')

      await search.fill('pallet wrap')
      await expect(row(page, lib.sopIds.packing)).toBeVisible(SLOW)
      await expect(row(page, lib.sopIds.lab)).toHaveCount(0)

      await search.fill(LAB_STEP_WORD)
      await expect(row(page, lib.sopIds.lab)).toBeVisible(SLOW)
      await expect(row(page, lib.sopIds.packing)).toHaveCount(0)

      await search.fill('zzqxwv')
      const empty = page.getByTestId('search-empty')
      await expect(empty).toContainText('No SOP for', SLOW)
      await expect(empty.getByText('Ask for one')).toBeVisible(SLOW)
      await expect(page.getByTestId('write-it')).toHaveAttribute('href', '/admin/sops/new/blank?title=zzqxwv')
      await shot(page, '63-home-search-miss')
    })

    await asRole(browser, 'siteWorker', DESKTOP, async (page) => {
      await page.goto('/')
      await listReady(page)
      await page.getByTestId('sop-search').fill('zzqxwv')
      const empty = page.getByTestId('search-empty')
      await expect(empty).toContainText('No SOP for', SLOW)
      await expect(empty.getByText('Ask for one')).toBeVisible(SLOW)
      await expect(page.getByTestId('write-it')).toHaveCount(0)
    })
  })

  // ------------------------------------------------------------------ HOME-03

  test('HOME-03 Read shows chip, meta, steps with kinds and the start button; owner hidden for a worker, shown for a supervisor', async ({ browser }) => {
    test.setTimeout(240_000)
    const meta = (page: Page) => page.locator('[data-testid="read-view"] p.font-label').first()

    await asRole(browser, 'siteWorker', DESKTOP, async (page) => {
      await page.goto(`/?sop=${lib.sopIds.packing}`)
      await expect(page.getByTestId('read-view')).toBeVisible(SLOW)
      await expect(page.getByTestId('read-view').locator('h1')).toHaveText(EVAL_AREA_SOPS.packing, SLOW)
      await expect(meta(page)).toContainText('EVAL Area Packing · Process · v1', SLOW)
      await expect(page.getByTestId('read-start')).toBeVisible()
      await expect(page.getByTestId('read-start')).toHaveAttribute('aria-label', 'start')
      const steps = page.locator('[data-testid="read-steps"] > li')
      await expect(steps).toHaveCount(4, SLOW)
      await expect(steps.first()).toContainText('Moving equipment nearby.')
      await expect(page.getByTestId('read-edit')).toHaveCount(0)
      // Give the owner query time to land: a worker never fires it, so the text must stay absent.
      await page.waitForTimeout(2_000)
      await expect(meta(page)).not.toContainText('owner')
      await shot(page, '63-home-read-worker')
    })

    await asRole(browser, 'siteSupervisor', DESKTOP, async (page) => {
      await page.goto(`/?sop=${lib.sopIds.packing}`)
      await expect(page.getByTestId('read-view')).toBeVisible(SLOW)
      await expect(meta(page)).toContainText(/ · owner \S/, SLOW)
      await expect(page.getByTestId('read-start')).toBeVisible()
      await shot(page, '63-home-read-supervisor')
    })
  })

  // ------------------------------------------------------------------ HOME-03 (63-18)

  test('HOME-03 opening two SOPs in a row shows no stale Read (second iteration, same session)', async ({ browser }) => {
    test.setTimeout(240_000)
    const meta = (page: Page) => page.locator('[data-testid="read-view"] p.font-label').first()
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      await page.goto('/')
      await listReady(page)
      const h1 = page.getByTestId('read-view').locator('h1')

      await row(page, lib.sopIds.packing).last().click()
      await expect(h1).toHaveText(EVAL_AREA_SOPS.packing, SLOW)
      await expect(page.getByTestId('read-steps').locator('> li').first()).toContainText('Moving equipment nearby.', SLOW)

      // The list stays on screen at desktop width: open the second SOP without going back.
      await row(page, lib.sopIds.lab).last().click()
      await expect(h1).toHaveText(EVAL_AREA_SOPS.lab, SLOW)
      await expect(meta(page)).toContainText('EVAL Area Lab', SLOW)
      await expect(meta(page)).not.toContainText('EVAL Area Packing')
      await expect(page.getByTestId('read-view')).not.toContainText('Moving equipment nearby.')
      await expect(page).toHaveURL(new RegExp(`sop=${lib.sopIds.lab}`), SLOW)

      // And back to the first: nothing carried over from the second.
      await row(page, lib.sopIds.packing).last().click()
      await expect(h1).toHaveText(EVAL_AREA_SOPS.packing, SLOW)
      await expect(meta(page)).not.toContainText('EVAL Area Lab')
      await shot(page, '63-home-two-reads')
    })
  })

  test('HOME-03 admin Read offers Edit, which opens the editor on the focus screen', async ({ browser }) => {
    test.setTimeout(180_000)
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      await page.goto(`/?sop=${plantSopId}`)
      await expect(page.getByTestId('read-view').locator('h1')).toHaveText(EVAL_PLANT_SOP_TITLE, SLOW)
      const edit = page.getByTestId('read-edit')
      await expect(edit).toHaveCount(1, SLOW)
      await shot(page, '63-home-read-admin')
      await edit.click()
      await expect(page).toHaveURL(/\/sops\/[0-9a-f-]{36}\?(?:[^#]*&)?mode=edit/, SLOW)
      await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
      await expect(page.getByTestId('edit-start-editing').or(page.getByTestId('edit-document')).first()).toBeVisible(SLOW)
      await expect(page.getByTestId('home')).toHaveCount(0)
    })
  })

  // ------------------------------------------------------------------ HOME-04

  test('HOME-04 Sign-offs, People, Training, Manage SOPs and My record open their bodies', async ({ browser }) => {
    test.setTimeout(300_000)
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      await page.goto('/')
      await listReady(page)

      await page.getByTestId('home-section-signoffs').click()
      await expect(page.getByTestId('section-signoffs')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'inbox', SLOW)
      await shot(page, '63-home-section-signoffs')

      await page.getByTestId('home-section-people').click()
      await expect(page.getByTestId('section-people')).toBeVisible(SLOW)
      await expect(page.getByTestId('office-pane')).toHaveAttribute('data-tab', 'people', SLOW)
      await expect(page.getByTestId('office-tab-access')).toBeVisible(SLOW)
      await expect(page.getByTestId('people-loading')).toHaveCount(0, SLOW)
      await expect(page.getByTestId('people-row').first()).toBeVisible(SLOW)
      await shot(page, '63-home-section-people')

      await page.getByTestId('home-section-training').click()
      const training = page.getByTestId('section-training')
      await expect(training).toBeVisible(SLOW)
      await expect(training.getByText('Loading…')).toHaveCount(0, SLOW)
      await expect(training.getByText('Loading matrix…')).toHaveCount(0, SLOW)
      await expect(training.getByText(/Could not load the training matrix/)).toHaveCount(0)
      await expect(training.locator('table').or(training.getByText('No people with required SOPs in this cut.'))).toBeVisible(SLOW)
      await shot(page, '63-home-section-training')

      await page.getByTestId('home-section-manage').click()
      await expect(page.getByTestId('manage-new')).toHaveAttribute('href', '/admin/sops/new', SLOW)
      await expect(page.getByRole('heading', { name: 'Your drafts' })).toBeVisible()
      await expect(page.getByTestId('section-manage').getByText('Loading…')).toHaveCount(0, SLOW)
      await shot(page, '63-home-section-manage')
      await page.getByTestId('manage-site').click()
      await expect(page.getByTestId('dept-strip')).toBeVisible(SLOW)
      await expect(page).toHaveURL(/s=manage&view=site/)
      await shot(page, '63-home-section-site')

      await page.getByTestId('home-section-record').click()
      await expect(page.getByTestId('section-record')).toBeVisible(SLOW)
      await expect(page.getByTestId('section-record').getByText(/\d+ completed procedures?/)).toBeVisible(SLOW)
      // The Notifications panel renders only when the person has some (the bell case below seeds one).
      await shot(page, '63-home-section-record')
    })
  })

  test('HOME-04 Manage: Carry on is a tap target at 390 px; Site & departments keeps its canvas on screen at 900 px and its dots wear the map colours', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteAdmin', PHONE, async (page) => {
      await page.goto('/?s=manage')
      const carry = page.getByTestId('manage-draft-carry-on').first()
      await expect(carry).toBeVisible(SLOW)
      const box = await carry.boundingBox()
      expect(box?.height ?? 0, 'Carry on height').toBeGreaterThanOrEqual(44)
      await noSideways(page, 'manage drafts')
      // Six tabs at 390 px: every label stays on one line (the 13 px floor wrapped "My record").
      const tabs = await page.locator('[data-testid^="home-tab-"]').evaluateAll((els) =>
        els.map((el) => {
          const r = document.createRange()
          r.selectNodeContents(el)
          return { t: el.textContent, lines: new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size }
        }),
      )
      expect(tabs.length, 'admin has six tabs').toBe(6)
      for (const tab of tabs) expect(tab.lines, `tab "${tab.t}" wraps`).toBe(1)
      await shot(page, '63-home-phone-manage')
      for (const s of ['signoffs', 'record']) {
        await page.getByTestId(`home-tab-${s}`).click()
        await expect(page.getByTestId(`home-tab-${s}`)).toHaveAttribute('aria-current', 'page')
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
        await noSideways(page, s)
        await shot(page, `63-home-phone-${s}`)
      }
    })
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      await page.goto('/?s=manage&view=site')
      await expect(page.getByTestId('dept-strip')).toBeVisible(SLOW)
      const dots = page.getByTestId('dept-strip-dot')
      const n = await dots.count()
      expect(n).toBeGreaterThanOrEqual(2)
      // Each dot is --area-N for its place in name order, the colour the map gives that area.
      const colours = await page.evaluate(() => {
        const probe = (v: string) => {
          const el = document.createElement('i')
          el.style.background = v
          document.body.append(el)
          const c = getComputedStyle(el).backgroundColor
          el.remove()
          return c
        }
        const dotColours = [...document.querySelectorAll('[data-testid="dept-strip-dot"]')].map((d) => getComputedStyle(d).backgroundColor)
        return { dotColours, expected: dotColours.map((_, i) => probe(`var(--area-${(i % 8) + 1})`)) }
      })
      expect(colours.dotColours).toEqual(colours.expected)
      expect(new Set(colours.dotColours).size, 'departments are not all one default colour').toBe(Math.min(n, 8))
      // The canvas starts on screen, not under a stack of cards.
      const canvas = await page.getByTestId('site-save-status').boundingBox()
      expect(canvas?.y ?? 9999, 'the editor toolbar starts above the fold').toBeLessThan(DESKTOP.height * 0.6)
      await shot(page, '63-home-site-fold')
    })
  })

  test('HOME-04 the bell dot opens My record with the Notifications heading focused', async ({ browser }) => {
    test.setTimeout(180_000)
    await asRole(browser, 'siteWorker', DESKTOP, async (page, userId) => {
      await db.from('notifications').delete().eq('dedupe_key', BELL_KEY).eq('user_id', userId)
      const { error } = await db.from('notifications').insert({
        organisation_id: siteOrgId,
        user_id: userId,
        kind: 'review_due',
        title: '63 eval bell dot',
        place: '/',
        subject_type: 'sop',
        subject_id: lib.sopIds.packing,
        dedupe_key: BELL_KEY,
      })
      if (error) throw new Error(`notification seed failed: ${error.message}`)

      await page.goto('/')
      await listReady(page)
      await expect(page.getByTestId('shell-bell-dot')).toBeVisible(SLOW)
      await expect(page.getByTestId('shell-bell')).toHaveAttribute('aria-label', 'Notifications, unread')
      await page.getByTestId('shell-bell').click()
      await expect(page.getByTestId('section-record')).toBeVisible(SLOW)
      await expect(page.locator('[data-testid="overview-notifications"] h2')).toBeFocused(SLOW)
      await expect(page.getByTestId('notification-row').filter({ hasText: '63 eval bell dot' })).toBeVisible(SLOW)
      await expect(page).toHaveURL(/[?&]s=record/)
      await shot(page, '63-home-bell-record')
    })
  })

  // ------------------------------------------------------------------ HOME-05 (63-18)

  test('HOME-05 a SOP address opens Read on load; an address naming no SOP or a section a worker lacks is the list', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteWorker', DESKTOP, async (page) => {
      await page.goto(`/?sop=${lib.sopIds.packing}`)
      await expect(page.getByTestId('read-view').locator('h1')).toHaveText(EVAL_AREA_SOPS.packing, SLOW)
      await expect(page.getByTestId('home-section-sops')).toHaveAttribute('aria-current', 'page')

      await page.goto('/?s=manage')
      await listReady(page)
      await expect(page.getByTestId('home-section-sops')).toHaveAttribute('aria-current', 'page', SLOW)
      await expect(page.getByTestId('section-manage')).toHaveCount(0)

      await page.goto('/?sop=not-an-id')
      await listReady(page)
      await expect(page.getByTestId('read-view')).toHaveCount(0)
    })
  })

  // ------------------------------------------------------------------ MAP-03

  test('MAP-03 area click zooms and filters, Esc returns, dimmed area switches, object opens Read', async ({ browser }) => {
    test.setTimeout(300_000)
    await asRole(browser, 'siteAdmin', DESKTOP, async (page) => {
      const errors = watchConsole(page)
      await page.goto('/')
      await listReady(page)
      const svg = page.getByTestId('site-map')
      await expect(svg).toBeVisible(SLOW)
      await expect(plate(page, formingId)).toHaveCount(1, SLOW)
      const whole = await viewBox(page)
      await page.waitForTimeout(800)
      await shot(page, '63-home-map-site')

      // Click the Forming plate: the viewBox changes, the filter shows Forming, the list holds Forming only.
      await plate(page, formingId).click({ timeout: 10_000 })
      await expect(page.getByTestId('area-filter')).toContainText('Forming', SLOW)
      await expect.poll(async () => sameBox(await viewBox(page), whole), SLOW).toBe(false)
      const rows = page.getByTestId('sop-row')
      await expect(rows.first()).toBeVisible(SLOW)
      const wrong = await rows.evaluateAll((els) => els.filter((e) => !(e.textContent ?? '').includes('Forming ·')).length)
      expect(wrong, 'rows outside Forming while Forming is open').toBe(0)
      await expect(page.getByTestId('map-crumb')).toBeVisible()

      // Esc restores the whole-site view and clears the filter.
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('area-filter')).toHaveCount(0, SLOW)
      await expect.poll(async () => sameBox(await viewBox(page), whole), SLOW).toBe(true)

      // Open Forming, then a dimmed area switches the zoom.
      await plate(page, formingId).click({ timeout: 10_000 })
      await expect(page.getByTestId('area-filter')).toContainText('Forming', SLOW)
      await expect(plate(page, lib.departmentIds.packing)).toHaveAttribute('data-state', 'dim')
      await plate(page, lib.departmentIds.packing).click({ timeout: 10_000 })
      await expect(page.getByTestId('area-filter')).toContainText('EVAL Area Packing', SLOW)
      await expect(plate(page, lib.departmentIds.packing)).toHaveAttribute('data-state', 'cur')
      await page.waitForTimeout(800)
      await shot(page, '63-home-map-area')

      // An object on the open plate opens Read for that SOP.
      const obj = page.locator(`[data-testid="map-object"][data-sop-id="${lib.sopIds.packing}"]`)
      await expect(obj).toHaveCount(1, SLOW)
      await pressObject(obj)
      await expect(page.getByTestId('read-view').locator('h1')).toHaveText(EVAL_AREA_SOPS.packing, SLOW)

      // Back to the map, Esc to the whole site; then the keyboard path: focus a plate, Enter opens it.
      await page.getByTestId('read-back').click()
      await expect(page.getByTestId('site-map')).toBeVisible(SLOW)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('area-filter')).toHaveCount(0, SLOW)
      await plate(page, lib.departmentIds.lab).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('area-filter')).toContainText('EVAL Area Lab', SLOW)
      expect(errors, errors.join('\n')).toEqual([])
    })
  })

  // ------------------------------------------------------------------ MAP-04

  test('MAP-04 phone: tab bar, List | Site map, numbered markers and key, Read with back link, no sideways scroll', async ({ browser }) => {
    test.setTimeout(240_000)
    await asRole(browser, 'siteWorker', PHONE, async (page) => {
      const errors = watchConsole(page)
      await page.goto('/')
      await listReady(page)
      await expect(page.getByTestId('home-menu')).toBeHidden()
      await expect(page.getByTestId('home-tabbar')).toBeVisible(SLOW)
      await expect(page.getByTestId('home-tab-sops')).toBeVisible()
      await expect(page.getByTestId('home-tab-record')).toBeVisible()
      await expect(page.getByTestId('phone-view-list')).toHaveAttribute('aria-pressed', 'true')
      await noSideways(page, 'list')
      await shot(page, '63-home-phone-list')

      // From the list, Read's back link names the list.
      await row(page, lib.sopIds.packing).last().click()
      await expect(page.getByTestId('read-view')).toBeVisible(SLOW)
      await expect(page.getByTestId('read-back')).toContainText('My SOPs')
      await noSideways(page, 'read from list')
      await page.getByTestId('read-back').click()
      await expect(page.getByTestId('sop-list')).toBeVisible(SLOW)

      // Site map: numbered markers and the key.
      await page.getByTestId('phone-view-map').click()
      await expect(page.getByTestId('site-map')).toBeVisible(SLOW)
      await expect(page.getByTestId('map-key')).toBeVisible(SLOW)
      for (const name of ['Forming', 'Site-wide']) await expect(page.getByTestId('map-key-item').filter({ hasText: name }), name).toHaveCount(1)
      await expect(page.locator('[data-testid="site-map"] g.lg\\:hidden text').first()).toBeVisible()
      await noSideways(page, 'map')
      await page.waitForTimeout(800)
      await shot(page, '63-home-phone-map')

      // Tapping a key item zooms into the area; an object opens Read full width with a Site map back link.
      await page.getByTestId('map-key-item').filter({ hasText: 'Forming' }).click()
      await expect(page.getByTestId('map-crumb')).toBeVisible(SLOW)
      await expect(page.getByTestId('map-key')).toHaveCount(0)
      const obj = page.locator(`[data-testid="map-object"][data-sop-id="${plantSopId}"]`)
      await expect(obj).toHaveCount(1, SLOW)
      await pressObject(obj)
      await expect(page.getByTestId('read-view')).toBeVisible(SLOW)
      await expect(page.getByTestId('read-back')).toContainText('Site map')
      const box = await page.getByTestId('read-view').boundingBox()
      expect(box!.width, 'Read is full width').toBeGreaterThanOrEqual(PHONE.width - 4)
      await noSideways(page, 'read from map')
      await shot(page, '63-home-phone-read')
      expect(errors, errors.join('\n')).toEqual([])
    })
  })

  // ------------------------------------------------------------------ EVAL-01

  test('EVAL-01 real org map and list, read-only', async ({ browser }) => {
    test.setTimeout(240_000)
    // The real SOPstart org: reads and view-state clicks only; nothing here starts a walk or writes.
    await asRole(browser, 'admin', DESKTOP, async (page) => {
      await page.goto('/')
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      await listReady(page)
      await expect(page.getByTestId('site-map')).toBeVisible(SLOW)
      const plates = await page.getByTestId('map-area').count()
      console.log(`real org plates: ${plates}`)
      expect.soft(plates, 'the real org map shows three plates').toBe(3)
      await page.waitForTimeout(1_500)
      await shot(page, '63-real-org-list')
      await page.getByTestId('home-reader').screenshot({ path: path.join(process.cwd(), '.planning', 'evals', 'latest', '63-real-org-map.png') })

      await page.setViewportSize(PHONE)
      await page.getByTestId('phone-view-map').click()
      await expect(page.getByTestId('map-key')).toBeVisible(SLOW)
      await noSideways(page, 'real org map')
      await page.waitForTimeout(1_000)
      await shot(page, '63-real-org-map-phone')
    })
  })

  // ------------------------------------------------------------------ DOCS-01

  test('DOCS-01 pathways map reports zero unmapped screens', async ({ browser }) => {
    test.setTimeout(120_000)
    await asRole(browser, 'admin', DESKTOP, async (page) => {
      await page.goto('/pathways')
      await page.getByRole('button', { name: /All screens/ }).click()
      await expect(page.getByText(/^0 not mapped yet$/)).toBeVisible(SLOW)
    })
  })

})
