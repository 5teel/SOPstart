/**
 * Deployed-site eval -- Phase 54 "Admin: Inbox, Floor Health, Library Table"
 * (D-12, T-54-10/T-54-01/T-54-11).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) as the eval-site-admin fixture, admin of the isolated "SOPstart
 * Eval Site" org (never the shared SOPstart eval org bd2c2b88...). Reuses
 * the shared plant fixture (EVAL Press linked to the published "Eval plant
 * fixture SOP") and additionally: resets that SOP's owner_user_id to null
 * (D-13b, so the red pin/row is never assumed), and ensures a second
 * machine, "EVAL Oven", with zero linked SOPs (so it surfaces as a Machines
 * row in the inbox).
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production. Provision fixtures first: `node scripts/eval-fixtures.mjs`.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_SITE_DEPARTMENT, EVAL_PLANT_SOP_TITLE, EVAL_PLANT_MACHINE, signInAs } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { newMachineCode } from '@/lib/site/scene'

const SLOW = { timeout: 25_000 }
const EVAL_OVEN_MACHINE = 'EVAL Oven'
// Non-overlapping with plant-fixture's PRESS_POLYGON ([480,180]-[760,420]).
const OVEN_POLYGON = [
  [80, 180],
  [280, 180],
  [280, 420],
  [80, 420],
]

test.describe('Phase 54 -- admin governance inbox + floor health (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) -- run via `npm run eval`')

  let db: SupabaseClient
  let siteOrgId: string
  let plantSopId: string
  let ovenId: string
  let realOrgTitle: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })

    const fixture = await ensurePlantFixture(db)
    siteOrgId = fixture.siteOrgId
    plantSopId = fixture.plantSopId

    // T-54-10: never write anywhere but the resolved eval-site org.
    if (siteOrgId === REAL_SOPSTART_ORG_ID) throw new Error('refusing to run -- resolved org id equals the real SOPstart org')

    const { data: dept, error: deptErr } = await db
      .from('departments')
      .select('id')
      .eq('organisation_id', siteOrgId)
      .eq('name', EVAL_SITE_DEPARTMENT)
      .maybeSingle()
    if (deptErr || !dept) throw new Error(`"${EVAL_SITE_DEPARTMENT}" department not found -- run node scripts/eval-fixtures.mjs`)

    const { data: layout, error: layoutErr } = await db
      .from('site_layouts')
      .select('id')
      .eq('organisation_id', siteOrgId)
      .not('scene_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (layoutErr || !layout) throw new Error('eval-site layout not found after ensurePlantFixture')

    // Ensure EVAL Oven exists on the same layout, unlinked to any SOP.
    const { data: existingOven, error: ovenErr } = await db
      .from('site_machines')
      .select('id')
      .eq('site_layout_id', layout.id)
      .eq('organisation_id', siteOrgId)
      .eq('name', EVAL_OVEN_MACHINE)
      .maybeSingle()
    if (ovenErr) throw new Error(`site_machines lookup (oven) failed: ${ovenErr.message}`)
    if (existingOven) {
      ovenId = existingOven.id
    } else {
      const { data: created, error: createErr } = await db
        .from('site_machines')
        .insert({
          site_layout_id: layout.id,
          organisation_id: siteOrgId,
          name: EVAL_OVEN_MACHINE,
          department_id: dept.id,
          polygon: OVEN_POLYGON,
          code: newMachineCode(),
          sort: 1,
        })
        .select('id')
        .single()
      if (createErr || !created) throw new Error(`site_machines insert (oven) failed: ${createErr?.message}`)
      ovenId = created.id
    }
    // D-06/D-02 (machines-without-SOPs row): the oven must stay unlinked --
    // site-editor's reset never links it, but clear defensively.
    const { error: unlinkErr } = await db.from('sop_machines').delete().eq('machine_id', ovenId)
    if (unlinkErr) throw new Error(`sop_machines cleanup (oven) failed: ${unlinkErr.message}`)

    // D-13b: reset the fixture SOP's owner to null and read it back --
    // never assume prior test/eval-run state left it unowned.
    const { error: resetErr } = await db.from('sops').update({ owner_user_id: null }).eq('id', plantSopId)
    if (resetErr) throw new Error(`owner reset failed: ${resetErr.message}`)
    const { data: readBack, error: readErr } = await db.from('sops').select('owner_user_id').eq('id', plantSopId).single()
    if (readErr || !readBack) throw new Error(`owner read-back failed: ${readErr?.message}`)
    if (readBack.owner_user_id !== null) throw new Error(`owner reset did not take -- owner_user_id is ${readBack.owner_user_id}`)

    // T-54-01: a real-org SOP title for the cross-tenant disclosure probe.
    const { data: realSop, error: realErr } = await db
      .from('sops')
      .select('title')
      .eq('organisation_id', REAL_SOPSTART_ORG_ID)
      .not('title', 'is', null)
      .limit(1)
      .maybeSingle()
    if (realErr || !realSop?.title) throw new Error(`real-org title probe failed: ${realErr?.message}`)
    realOrgTitle = realSop.title
  })

  test.afterAll(async () => {
    if (!EVAL_ENV_READY || !plantSopId) return
    await db.from('sops').update({ owner_user_id: null }).eq('id', plantSopId)
  })

  test.use({ viewport: { width: 1440, height: 900 } })

  const press = (page: Page) => page.locator('[data-testid="plant-machine"][data-machine-name="EVAL Press"]')
  const fixtureGovRow = (page: Page) => page.getByTestId('gov-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })

  test('A -- inbox + floor: unowned fixture is a red row, EVAL Oven is a Machines row, EVAL Press pins bad, no real-org leak', async ({ page, context }) => {
    const errors = watchConsole(page)
    await signInAs(context, 'siteAdmin')
    await page.goto('/governance')

    await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)
    const fixtureRow = fixtureGovRow(page)
    await expect(fixtureRow).toBeVisible(SLOW)
    await expect(fixtureRow).toHaveAttribute('data-severity', 'bad')
    await expect(fixtureRow.getByRole('button', { name: /Assign owner/ })).toBeVisible()

    await expect(async () => {
      const text = await page.locator('[data-testid="gov-chip"][data-chip="owner"]').innerText()
      const count = Number(text.match(/\d+/)?.[0] ?? '0')
      expect(count).toBeGreaterThanOrEqual(1)
    }).toPass(SLOW)

    const machineRows = page.locator('[data-testid="gov-row"][data-kind="machines"]')
    const ovenRow = machineRows.filter({ hasText: EVAL_OVEN_MACHINE })
    await expect(ovenRow).toBeVisible(SLOW)
    const ovenAction = ovenRow.getByTestId('gov-action')
    await expect(ovenAction).toHaveAttribute('href', '/admin/sops/new')

    await expect(page.getByTestId('floor-health')).toBeVisible(SLOW)
    await expect(press(page)).toHaveAttribute('data-health', 'bad', SLOW)
    await expect(page.locator('[data-testid="plant-health-pin"][data-health="bad"]')).toBeVisible()

    await expect(page.getByText(realOrgTitle)).toHaveCount(0)
    await shot(page, 'governance-inbox')
    expect(errors).toEqual([])
  })

  test('B -- machine panel: NO OWNER badge, Open/Edit links, owner none', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')
    await page.goto('/governance')
    await expect(press(page)).toBeVisible(SLOW)
    await press(page).click()

    const panel = page.getByTestId('admin-panel')
    await expect(panel).toBeVisible(SLOW)
    const row = panel.getByTestId('admin-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(row).toBeVisible(SLOW)
    await expect(row.getByTestId('admin-panel-badge')).toHaveAttribute('data-badge', 'NO OWNER')
    await expect(row.getByTestId('admin-panel-open')).toHaveAttribute('href', `/sops/${plantSopId}`)
    await expect(row.getByTestId('admin-panel-edit')).toHaveAttribute('href', `/admin/sops/builder/${plantSopId}`)
    await expect(row).toContainText('owner none')
    await shot(page, 'governance-panel')
  })

  test('C -- Machines chip filters the inbox to machines rows only', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')
    await page.goto('/governance')
    await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)

    await page.locator('[data-testid="gov-chip"][data-chip="machines"]').click()
    await expect(async () => {
      const kinds = await page.getByTestId('gov-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
      expect(kinds.length).toBeGreaterThan(0)
      expect(kinds.every((k) => k === 'machines')).toBe(true)
    }).toPass(SLOW)

    await page.locator('[data-testid="gov-chip"][data-chip="all"]').click()
  })

  test('D -- Assign owner clears the row and the red pin', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')
    await page.goto('/governance')
    const fixtureRow = fixtureGovRow(page)
    await expect(fixtureRow).toBeVisible(SLOW)
    await fixtureRow.getByRole('button', { name: /Assign owner/ }).click()
    // OwnerPicker's memberLabel() falls back to `${role} (${userId.slice(0,8)})`
    // when the member has no email/full_name on the returned row (observed on
    // the deployed eval-site org) -- pick by role label, not by email text.
    await fixtureRow.getByRole('button', { name: /^admin \(/ }).click()

    await expect(async () => {
      await expect(fixtureGovRow(page).getByRole('button', { name: /Assign owner/ })).toHaveCount(0)
      await expect(press(page)).not.toHaveAttribute('data-health', 'bad')
    }).toPass({ timeout: 25_000 })
    await shot(page, 'governance-after-assign')
  })

  test('E -- header Governance link opens the inbox', async ({ page, context }) => {
    await signInAs(context, 'siteAdmin')
    await page.goto('/sops')
    await page.locator('header').getByRole('link', { name: 'Governance', exact: true }).click()
    await expect(page).toHaveURL(/\/governance$/)
    await expect(page.getByTestId('gov-inbox')).toBeVisible(SLOW)
  })
})
