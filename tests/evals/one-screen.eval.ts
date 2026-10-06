/**
 * Deployed-site eval -- Phase 57 "The One Screen & Its Places".
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval -- --phase 57`) as fixture accounts of the isolated "SOPstart Eval
 * Site" org: eval-site-worker (worker), eval-site-admin (admin) and
 * eval-site-supervisor (supervisor, D-06). Provision first with
 * `node scripts/eval-fixtures.mjs`. The real SOPstart org is only ever READ
 * (one overview screenshot).
 *
 * Assert by NAME ("EVAL Press"), never exact counts -- the eval-site org is
 * shared with sibling evals (CLAUDE.md 2026-09-29) -- and every assertion that
 * follows a fresh navigation carries the SLOW timeout. Comments describe
 * retired URLs in words.
 *
 * Self-skips without EVAL_BASE_URL, so `npm run test` never hits production.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  EVAL_ENV_READY,
  EVAL_PLANT_MACHINE,
  EVAL_PLANT_SOP_TITLE,
  EVAL_CONVERT_SOP_TITLE,
  EVAL_SITE_SOP_TITLE,
  signInAs,
} from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'

export const SLOW = { timeout: 30_000 }
const NOT_FOUND = 'This page has moved or no longer exists.'
const ROOM_NAMES = ['Office', 'Smoko room', 'Workshop', 'Noticeboard'] as const

const atRoot = (u: URL) => u.pathname === '/' && u.search === ''
const at = (pathname: string) => (u: URL) => u.pathname === pathname
const press = (page: Page) => page.locator(`[data-testid="plant-machine"][data-machine-name="${EVAL_PLANT_MACHINE}"]`)
const pressRow = (page: Page) => page.getByTestId('shell-machine-row').filter({ hasText: EVAL_PLANT_MACHINE })
const room = (page: Page, id: string) => page.locator(`[data-testid="plant-room"][data-room-id="${id}"]`)
const roomBody = (page: Page, id: string) => page.locator(`[data-testid="room-body"][data-room-id="${id}"]`)
const detail = (page: Page) => page.getByTestId('shell-detail')

/** The open-request count on the Office Requests tab (0 when the tab is absent, i.e. before 60-11). */
async function requestsInTab(page: Page): Promise<number> {
  const l = page.getByTestId('office-tab-requests').locator('.mono')
  return (await l.count()) ? Number(((await l.first().textContent()) ?? '').trim()) || 0 : 0
}

async function readScale(page: Page) {
  return parseFloat((await page.getByTestId('plant-world').getAttribute('data-scale')) ?? '0')
}

/** The scene picture has painted (its natural width is known). */
async function sceneReady(page: Page) {
  const stage = page.getByTestId('plant-stage')
  await expect(stage).toBeVisible(SLOW)
  await expect.poll(async () => stage.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth), SLOW).toBeGreaterThan(0)
}

test.describe('Phase 57 — the one screen (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')
  test.use({ viewport: { width: 1440, height: 900 } })

  let db: SupabaseClient
  let plantSopId: string
  let convertSopId: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const fixture = await ensurePlantFixture(db)
    plantSopId = fixture.plantSopId
    if (fixture.siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')
    const { data: convert } = await db
      .from('sops')
      .select('id')
      .eq('organisation_id', fixture.siteOrgId)
      .eq('title', EVAL_CONVERT_SOP_TITLE)
      .maybeSingle()
    if (!convert) throw new Error(`"${EVAL_CONVERT_SOP_TITLE}" not found — run node scripts/eval-fixtures.mjs`)
    convertSopId = convert.id
  })

  // ------------------------------------------------------------------ worker

  test('SHL-01 PLC-01: worker lands on three panes with four signposts and no header', async ({ page, context }) => {
    test.setTimeout(180_000)
    const errors = watchConsole(page)
    await signInAs(context, 'siteWorker')
    await page.goto('/')

    await expect(page.getByTestId('shell')).toBeVisible(SLOW)
    await expect(page.getByTestId('shell-stage')).toBeVisible(SLOW)
    await expect(detail(page)).toBeVisible(SLOW)
    await expect(page.getByTestId('shell-summary')).toBeVisible(SLOW)
    await expect(page.getByRole('banner')).toHaveCount(0)
    await sceneReady(page)
    for (const name of ROOM_NAMES) {
      await expect(page.getByTestId('plant-room-sign').filter({ hasText: name }), name).toBeVisible(SLOW)
    }
    await expect(pressRow(page)).toBeVisible(SLOW)
    await shot(page, '57-worker-overview')
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('SHL-02: map click equals list click, and Esc returns to the overview', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')
    await page.goto('/')
    await sceneReady(page)
    await expect(pressRow(page)).toBeVisible(SLOW)
    const fitScale = await readScale(page)

    // List click.
    await pressRow(page).click()
    await expect(press(page)).toHaveAttribute('data-selected', 'true', SLOW)
    await expect.poll(async () => Math.abs((await readScale(page)) - fitScale) > 0.01, SLOW).toBe(true)
    const listPlace = await detail(page).getAttribute('data-place')
    expect(listPlace).toMatch(/^\/\?place=[0-9a-f-]{36}$/)
    const panelRow = detail(page).getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(panelRow).toBeVisible(SLOW)
    const listMachineId = listPlace!.split('=')[1]
    await expect(panelRow.getByTestId('plant-panel-walk')).toHaveAttribute('href', `/sops/${plantSopId}?from=${listMachineId}`)

    // Esc returns.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('shell-summary')).toBeVisible(SLOW)
    await expect(page).toHaveURL(atRoot, SLOW)
    await expect(press(page)).toHaveAttribute('data-selected', 'false', SLOW)

    // Map click gives the same place and the same detail.
    await press(page).click()
    await expect(press(page)).toHaveAttribute('data-selected', 'true', SLOW)
    await expect(detail(page)).toHaveAttribute('data-place', listPlace!, SLOW)
    await expect(panelRow).toBeVisible(SLOW)

    // The close button also returns.
    await page.getByTestId('shell-detail-close').click()
    await expect(page.getByTestId('shell-summary')).toBeVisible(SLOW)
    await expect(page).toHaveURL(atRoot, SLOW)

    // A room is a place too: Noticeboard from the map.
    await room(page, 'noticeboard').click()
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=noticeboard', SLOW)
    await expect(roomBody(page, 'noticeboard')).toBeVisible(SLOW)
    await expect(room(page, 'noticeboard')).toHaveAttribute('data-selected', 'true')
    await expect(page.getByTestId('shell-room-row').filter({ hasText: 'Noticeboard' })).toHaveAttribute('aria-current', 'true')
    for (const name of ROOM_NAMES) {
      await expect(page.getByTestId('plant-room-sign').filter({ hasText: name }), name).toBeVisible(SLOW)
    }
    await shot(page, '57-worker-zoomed')
  })

  test('SHL-02: second-iteration leak -- machine, then Office, then another machine shows no stale detail', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')
    await page.goto('/')
    await expect(pressRow(page)).toBeVisible(SLOW)

    await pressRow(page).click()
    const machinePlace = await detail(page).getAttribute('data-place')
    expect(machinePlace).toMatch(/^\/\?place=[0-9a-f-]{36}$/)
    await expect(detail(page).getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })).toBeVisible(SLOW)
    await expect(roomBody(page, 'office')).toHaveCount(0)

    await page.getByTestId('shell-room-row').filter({ hasText: 'Office' }).click()
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=office', SLOW)
    await expect(roomBody(page, 'office')).toBeVisible(SLOW)
    await expect(detail(page).getByTestId('plant-panel-row')).toHaveCount(0)

    await pressRow(page).click()
    await expect(detail(page)).toHaveAttribute('data-place', machinePlace!, SLOW)
    await expect(roomBody(page, 'office')).toHaveCount(0)
    await expect(detail(page).getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })).toBeVisible(SLOW)
  })

  test('SHL-04: search lights matching machine and room shapes', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')
    await page.goto('/')
    await sceneReady(page)
    const search = page.getByTestId('shell-search')

    await search.fill('plant fixture')
    await expect(press(page)).toHaveAttribute('data-highlighted', 'true', SLOW)
    await expect(pressRow(page)).toBeVisible(SLOW)
    await shot(page, '57-worker-search')

    await search.fill('zzzz-no-match')
    await expect(page.locator('[data-testid="plant-machine"][data-highlighted="true"]')).toHaveCount(0)
    await expect(page.getByText('Nothing matches')).toBeVisible(SLOW)

    await search.fill('convert fixture')
    await expect(room(page, 'noticeboard')).toHaveAttribute('data-highlighted', 'true', SLOW)
    await expect(page.getByTestId('shell-room-row').filter({ hasText: 'Noticeboard' })).toBeVisible(SLOW)

    await search.fill('')
    await expect(page.locator('[data-testid="plant-room"][data-highlighted="true"]')).toHaveCount(0)
  })

  test('SHL-05: the Now card names the due SOP and opens it', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')
    await page.goto('/')
    const now = page.getByTestId('plant-now-card')
    await expect(now).toBeVisible(SLOW)
    await expect(now).toContainText(EVAL_PLANT_SOP_TITLE, SLOW)
    const nowHref = new RegExp(`^/sops/${plantSopId}\\?from=[0-9a-f-]{36}$`)
    await expect(page.getByTestId('plant-now-walk')).toHaveAttribute('href', nowHref)

    // D-21: Show me opens the same browse address (it no longer locates the machine on the map).
    await expect(page.getByTestId('plant-now-show')).toHaveAttribute('href', nowHref)
    await page.getByTestId('plant-now-show').click()
    await expect(page).toHaveURL(new RegExp(`/sops/${plantSopId}\\?from=`), SLOW)
    await expect(page.locator('main').first()).toBeVisible(SLOW)
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0)
  })

  test('PLC-02 PLC-03: a worker walks a SOP from a machine and from the Noticeboard', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')

    // From the machine.
    await page.goto('/')
    await expect(pressRow(page)).toBeVisible(SLOW)
    await pressRow(page).click()
    const machineRow = detail(page).getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(machineRow).toBeVisible(SLOW)
    await machineRow.getByTestId('plant-panel-walk').click()
    await expect(page).toHaveURL(new RegExp(`/sops/${plantSopId}\\?from=[0-9a-f-]{36}`), SLOW)
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0)
    // Phase 58: the SOP owns the screen -- the focus frame's own Back replaces the site's Back bar.
    await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
    await expect(page.getByTestId('back-to-site')).toHaveCount(0)

    // From the Noticeboard (a published SOP on no machine).
    await page.goto('/?place=noticeboard')
    const boardRow = roomBody(page, 'noticeboard').getByTestId('plant-panel-row').filter({ hasText: EVAL_CONVERT_SOP_TITLE })
    await expect(boardRow).toBeVisible(SLOW)
    await shot(page, '57-worker-noticeboard')
    await boardRow.getByTestId('plant-panel-walk').click()
    await expect(page).toHaveURL(new RegExp(`/sops/${convertSopId}\\?from=noticeboard`), SLOW)
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0)
    // Phase 58: the SOP owns the screen -- the focus frame's own Back replaces the site's Back bar.
    await expect(page.getByTestId('focus-screen')).toBeVisible(SLOW)
    await expect(page.getByTestId('back-to-site')).toHaveCount(0)
  })

  test('D-11: a place deep link selects on load; a worker edit-mode link falls back to the overview', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')

    await page.goto('/?place=noticeboard')
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=noticeboard', SLOW)
    await expect(roomBody(page, 'noticeboard')).toBeVisible(SLOW)

    await page.goto('/?place=edit')
    await expect(page.getByTestId('shell-summary')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-stage')).toBeVisible(SLOW)
    await expect(page.getByTestId('site-draw-machine')).toHaveCount(0)
    await expect(page.getByTestId('dept-strip')).toHaveCount(0)
    await expect(page.getByTestId('shell-edit-site')).toHaveCount(0)

    // An address that names no place is the overview, never an error.
    await page.goto('/?place=not-a-place')
    await expect(page.getByTestId('shell-summary')).toBeVisible(SLOW)
  })

  test('D-12 D-15: a bridge page shows Back to the site and returns to its room', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')
    await page.goto('/?place=smoko')
    await expect(roomBody(page, 'smoko')).toBeVisible(SLOW)
    await roomBody(page, 'smoko').locator('a[href="/activity"]').click()
    await expect(page).toHaveURL(at('/activity'), SLOW)
    await expect(page.getByRole('banner')).toHaveCount(0)
    const back = page.getByTestId('back-to-site')
    await expect(back).toBeVisible(SLOW)
    await expect(back.locator('a')).toHaveAttribute('href', '/?place=smoko')
    await shot(page, '57-bridge-activity')

    await back.locator('a').click()
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=smoko', SLOW)
    await expect(roomBody(page, 'smoko')).toBeVisible(SLOW)
  })

  test('PLC-04: worker due pin on EVAL Press', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteWorker')
    await page.goto('/')
    await sceneReady(page)
    await expect(press(page)).toHaveAttribute('data-pin', /^[1-9]\d*$/, { timeout: 45_000 })
    await expect(page.getByTestId('plant-pin').first()).toBeVisible(SLOW)
    // Workers see due counts, never an admin health pin.
    await expect(page.getByTestId('plant-health-pin')).toHaveCount(0)
  })

  test('PLC-01: a worker on a phone gets the list, with glove-sized rows', async ({ page, context }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await signInAs(context, 'siteWorker')
    await page.goto('/')
    await expect(page.getByTestId('shell')).toBeVisible(SLOW)
    await expect(page.getByTestId('shell-search')).toBeVisible(SLOW)
    await expect(page.getByTestId('shell-stage')).toBeHidden()
    const row = page.getByTestId('shell-room-row').first()
    await expect(row).toBeVisible(SLOW)
    const box = await row.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await shot(page, '57-worker-mobile')
  })

  // -------------------------------------------------------------- supervisor

  test('D-06: the supervisor sees the Office card, and its pin equals the pane Inbox list plus open requests (59-12, 60-05)', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteSupervisor')
    await page.goto('/')
    const card = page.getByTestId('shell-office-card')
    await expect(card).toBeVisible(SLOW)
    const count = page.getByTestId('shell-office-count')
    await expect(count).toHaveText(/^\d+$/, SLOW)
    // The card and the Office pin read the same number.
    await expect(room(page, 'office')).toHaveAttribute('data-pin', (await count.innerText()).trim(), SLOW)
    await shot(page, '57-supervisor-overview')

    const pinned = Number((await count.innerText()).trim())
    await page.getByTestId('shell-office-open').click()
    await expect(roomBody(page, 'office')).toBeVisible(SLOW)
    // The Office is the tabbed pane; a supervisor has the Inbox only, one row per pinned item.
    await expect(page.getByTestId('office-pane')).toBeVisible(SLOW)
    await expect(page.getByTestId('office-tab-decisions')).toHaveCount(0)
    // The pin is Inbox rows plus open requests (60-05, D-03); the Requests tab count is absent until 60-11.
    await expect(page.getByTestId('office-row')).toHaveCount(pinned - (await requestsInTab(page)), SLOW)
  })

  // ------------------------------------------------------------------ admin

  test('PLC-04: admin health pin on EVAL Press', async ({ page, context }) => {
    test.setTimeout(180_000)
    // The governance eval assigns an owner earlier in the serial run -- clear it, eval-site SOP only.
    const { error } = await db.from('sops').update({ owner_user_id: null }).eq('id', plantSopId)
    expect(error).toBeNull()

    await signInAs(context, 'siteAdmin')
    await page.goto('/')
    await sceneReady(page)
    await expect(press(page)).toHaveAttribute('data-health', 'bad', { timeout: 45_000 })
    await expect(page.locator('[data-testid="plant-health-pin"][data-health="bad"]').first()).toBeVisible(SLOW)
    await shot(page, '57-admin-overview')
  })

  test('D-16 PLC-04: admin Office pin equals the pane Inbox tab count plus the Requests count (59-12, 60-05)', async ({ page, context }) => {
    test.setTimeout(180_000)
    await db.from('sops').update({ owner_user_id: null }).eq('id', plantSopId)
    await signInAs(context, 'siteAdmin')
    await page.goto('/')
    // Wait for the one admin read to land (the unowned fixture SOP flags EVAL Press).
    await expect(press(page)).toHaveAttribute('data-health', 'bad', { timeout: 45_000 })

    const count = Number((await page.getByTestId('shell-office-count').innerText()).trim())
    expect(count).toBeGreaterThanOrEqual(1)
    await expect(room(page, 'office')).toHaveAttribute('data-pin', String(count))

    await page.getByTestId('shell-office-open').click()
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=office', SLOW)
    await expect(page.getByTestId('office-pane')).toBeVisible(SLOW)
    // pin = Inbox count + Requests count (60-05, D-03)
    // the Requests count lands with the pane's own read, so re-read it on every try
    await expect(async () => {
      const inInbox = count - (await requestsInTab(page))
      await expect(page.getByTestId('office-tab-inbox')).toHaveText(new RegExp(`Inbox\\s*${inInbox}`), { timeout: 2_000 })
    }).toPass(SLOW)
    await shot(page, '57-admin-office')
  })

  test('PLC-02 D-19: admin machine panel offers Walk, Edit and new SOP for the machine', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteAdmin')
    await page.goto('/')
    await expect(pressRow(page)).toBeVisible(SLOW)
    await pressRow(page).click()

    const panel = page.getByTestId('admin-panel')
    await expect(panel).toBeVisible(SLOW)
    const row = panel.getByTestId('admin-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(row).toBeVisible(SLOW)
    await expect(row.getByTestId('admin-panel-badge')).toBeVisible()
    await expect(row.getByTestId('admin-panel-walk')).toHaveAttribute('href', new RegExp(`^/sops/${plantSopId}\\?from=[0-9a-f-]{36}$`))
    await expect(row.getByTestId('admin-panel-edit')).toHaveAttribute('href', new RegExp(`^/sops/${plantSopId}\\?mode=edit&from=[0-9a-f-]{36}$`))
    const newSop = panel.getByTestId('admin-panel-new-sop')
    await expect(newSop).toHaveAttribute('href', /\/admin\/sops\/new\/blank\?machine=[0-9a-f-]{36}$/)
    await shot(page, '57-admin-machine')

    await newSop.click()
    await expect(page).toHaveURL(/\/admin\/sops\/new\/blank\?machine=/, SLOW)
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0)
    await expect(page.getByTestId('back-to-site').locator('a')).toHaveAttribute('href', '/?place=workshop')
  })

  test('D-12 D-13: the Workshop lists the org drafts and links to the new-SOP flow', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'siteAdmin')
    await page.goto('/?place=workshop')
    await expect(roomBody(page, 'workshop')).toBeVisible(SLOW)
    await expect(roomBody(page, 'workshop').getByTestId('room-workshop-draft').filter({ hasText: EVAL_SITE_SOP_TITLE })).toBeVisible(SLOW)
    await expect(roomBody(page, 'workshop').getByTestId('room-workshop-new')).toHaveAttribute('href', '/admin/sops/new')
    await expect(room(page, 'workshop')).toHaveAttribute('data-pin', /^[1-9]\d*$/)
    await shot(page, '57-admin-workshop')
  })

  test('PLC-05 D-08 D-22: edit mode shows the site workspace and the departments strip', async ({ page, context }) => {
    test.setTimeout(300_000)
    await signInAs(context, 'siteAdmin')
    await page.goto('/')
    await sceneReady(page)
    await page.getByTestId('shell-edit-site').click()
    await expect(page).toHaveURL((u) => u.pathname === '/' && u.search === '?place=edit', SLOW)
    await expect(page.getByTestId('dept-strip')).toBeVisible(SLOW)
    await expect(page.getByTestId('site-draw-machine')).toBeVisible(SLOW)
    await shot(page, '57-admin-edit')

    // Add a department, then remove it.
    const name = `EVAL Zone ${Date.now()}`
    const rowFor = (n: string) =>
      page.locator('[data-testid="dept-strip-row"]').filter({ has: page.getByLabel(`Rename ${n}`, { exact: true }) })
    await page.getByTestId('dept-strip-add-name').fill(name)
    await page.getByTestId('dept-strip-add').click()
    await expect(rowFor(name)).toHaveCount(1, SLOW)
    await rowFor(name).getByTestId('dept-strip-remove').click()
    await expect(rowFor(name)).toHaveCount(0, SLOW)

    // Removing a department in use is refused, with counts (nothing changes).
    await rowFor('Forming').getByTestId('dept-strip-remove').click()
    const refused = rowFor('Forming').getByTestId('dept-strip-refused')
    await expect(refused).toBeVisible(SLOW)
    await expect(refused).toContainText(/\d+ machines?/)
    await expect(refused).toContainText(/\d+ SOP rules?/)
    await expect(rowFor('Forming')).toHaveCount(1)
    await shot(page, '57-admin-edit-refused')

    await page.getByTestId('site-edit-done').click()
    await expect(page.getByTestId('shell-summary')).toBeVisible(SLOW)
    await expect(page).toHaveURL(atRoot, SLOW)
  })

  test('D-10 D-17: retired URLs (dashboard, list, departments, site, governance views) redirect to the one screen', async ({ page, context }) => {
    test.setTimeout(240_000)
    await signInAs(context, 'siteAdmin')
    const legacyList = '/sops'

    for (const from of ['/dashboard', legacyList, `${legacyList}?status=draft`, '/admin/sops']) {
      await page.goto(from)
      await expect(page, from).toHaveURL(atRoot, SLOW)
      await expect(page.getByTestId('shell'), from).toBeVisible(SLOW)
    }

    // 59-13 adds these server-side redirects; they land on the Office places and the tabbed pane.
    await page.goto(`${legacyList}?view=attention`)
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=office', SLOW)
    await expect(page.getByTestId('office-pane')).toBeVisible(SLOW)

    await page.goto(`${legacyList}?view=access`)
    await expect(detail(page)).toHaveAttribute('data-place', '/?place=office&tab=access', SLOW)
    await expect(page.getByTestId('office-tab-access')).toHaveAttribute('aria-selected', 'true', SLOW)

    for (const from of ['/admin/departments', '/admin/site']) {
      await page.goto(from)
      await expect(page, from).toHaveURL((u) => u.pathname === '/' && u.search === '?place=edit', SLOW)
      await expect(page.getByTestId('dept-strip'), from).toBeVisible(SLOW)
    }
  })

  test('Pitfall 7: real-org overview screenshot, read-only', async ({ page, context }) => {
    test.setTimeout(180_000)
    await signInAs(context, 'admin')
    await page.goto('/')
    await expect(page.getByTestId('shell')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-stage').or(page.getByTestId('shell-no-site'))).toBeVisible(SLOW)
    if (await page.getByTestId('plant-stage').isVisible()) await sceneReady(page)
    await expect(page.getByTestId('shell-office-card')).toBeVisible(SLOW)
    await page.waitForTimeout(2_000)
    await shot(page, '57-real-org-overview')

    // Zoom into each room on the real scene so the hit-areas can be read by eye.
    if (await page.getByTestId('plant-stage').isVisible()) {
      for (const id of ['office', 'smoko', 'workshop', 'noticeboard']) {
        await page.getByTestId('shell-room-row').and(page.locator(`[data-room-id="${id}"]`)).click()
        await expect(detail(page)).toHaveAttribute('data-place', `/?place=${id}`, SLOW)
        await page.waitForTimeout(1_200)
        await shot(page, `57-real-org-${id}`)
      }
    }
  })

  test('CLAUDE.md pathways: the pathways map reports zero unmapped screens', async ({ page, context }) => {
    await signInAs(context, 'admin')
    await page.goto('/pathways')
    await page.getByRole('button', { name: /All screens/ }).click()
    await expect(page.getByText(/^0 not mapped yet$/)).toBeVisible(SLOW)
  })

  // -------------------------------------------------------------- signed out

  test('D-10: signed-out root shows the promo reel', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByTestId('promo-reel')).toBeVisible(SLOW)
    await expect(page.getByTestId('shell')).toHaveCount(0)
  })
})
