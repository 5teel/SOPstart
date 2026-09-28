/**
 * Deployed-site eval -- Phase 52 "Worker Home: The Plant" (D-16).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) as the eval-site-worker fixture, a worker member of the isolated
 * "SOPstart Eval Site" org (never the shared SOPstart eval org
 * bd2c2b88…), with a PUBLISHED "Eval plant fixture SOP" assigned to it and
 * linked to "EVAL Press".
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production. Provision fixtures first: `node scripts/eval-fixtures.mjs`.
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  EVAL_ENV_READY,
  EVAL_SITE_ORG_NAME,
  EVAL_SITE_DEPARTMENT,
  EVAL_PLANT_SOP_TITLE,
  EVAL_PLANT_MACHINE,
  signInAs,
} from './lib/session'
import { SCENE_BUCKET, scenePath, newMachineCode } from '@/lib/site/scene'

// The real, shared SOPstart org -- this eval must never write here. See
// scripts/eval-fixtures.mjs EVAL_ORG_ID / memory project_prod_org_merge.
const REAL_SOPSTART_ORG_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea'
const PRESS_POLYGON = [
  [480, 180],
  [760, 180],
  [760, 420],
  [480, 420],
]

const SHOTS = path.join(process.cwd(), '.planning', 'evals', 'latest')
fs.mkdirSync(SHOTS, { recursive: true })
async function shot(page: Page, name: string) {
  // Bounded -- waitForLoadState has no default timeout of its own and would
  // otherwise starve the rest of the test if the page never idles.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

/** Fail the test on any uncaught page error or React hydration/minified error in the console. */
function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/Minified React error|Hydration|hydrat|Warning:|Unhandled/i.test(t)) errors.push(`console: ${t.slice(0, 200)}`)
  })
  return errors
}

const SLOW = { timeout: 30_000 }

async function readWorldTransform(page: Page) {
  const world = page.getByTestId('plant-world')
  const scale = parseFloat((await world.getAttribute('data-scale')) ?? '0')
  const x = parseFloat((await world.getAttribute('data-x')) ?? '0')
  const y = parseFloat((await world.getAttribute('data-y')) ?? '0')
  return { scale, x, y }
}

function closeTo(actual: number, expected: number, tol = 0.01) {
  return Math.abs(actual - expected) <= tol
}

test.describe('Phase 52 — worker plant home (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured — self-skipping')

  let db: SupabaseClient
  let siteOrgId: string
  let plantSopId: string

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })

    const { data: org, error: orgErr } = await db
      .from('organisations')
      .select('id')
      .eq('name', EVAL_SITE_ORG_NAME)
      .maybeSingle()
    if (orgErr) throw new Error(`org lookup failed: ${orgErr.message}`)
    if (!org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found — run node scripts/eval-fixtures.mjs`)
    siteOrgId = org.id

    // T-52-05-A: hard-assert before any write, never the real tenant.
    if (siteOrgId === REAL_SOPSTART_ORG_ID) {
      throw new Error('refusing to run — resolved org id equals the real SOPstart org')
    }

    const { data: plantSop, error: plantSopErr } = await db
      .from('sops')
      .select('id, status')
      .eq('organisation_id', siteOrgId)
      .eq('title', EVAL_PLANT_SOP_TITLE)
      .maybeSingle()
    if (plantSopErr || !plantSop) throw new Error(`"${EVAL_PLANT_SOP_TITLE}" fixture SOP not found — run node scripts/eval-fixtures.mjs`)
    if (plantSop.status !== 'published') throw new Error(`"${EVAL_PLANT_SOP_TITLE}" is not published — run node scripts/eval-fixtures.mjs`)
    plantSopId = plantSop.id

    const { data: dept, error: deptErr } = await db
      .from('departments')
      .select('id')
      .eq('organisation_id', siteOrgId)
      .eq('name', EVAL_SITE_DEPARTMENT)
      .maybeSingle()
    if (deptErr || !dept) throw new Error(`"${EVAL_SITE_DEPARTMENT}" department not found — run node scripts/eval-fixtures.mjs`)

    // Ensure a scene exists (site-editor's beforeAll deletes it every run).
    let layoutId: string
    {
      const { data: existing, error: existingErr } = await db
        .from('site_layouts')
        .select('id, scene_path')
        .eq('organisation_id', siteOrgId)
        .not('scene_path', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (existingErr) throw new Error(`site_layouts lookup failed: ${existingErr.message}`)
      if (existing) {
        layoutId = existing.id
      } else {
        const { data: created, error: createErr } = await db
          .from('site_layouts')
          .insert({ organisation_id: siteOrgId, name: 'Eval site' })
          .select('id')
          .single()
        if (createErr || !created) throw new Error(`site_layouts insert failed: ${createErr?.message}`)
        layoutId = created.id
        const scenePathValue = scenePath(siteOrgId, layoutId, 'png')
        const fixturePng = fs.readFileSync(path.join(process.cwd(), 'tests', 'evals', 'fixtures', 'site-scene.png'))
        const { error: uploadErr } = await db.storage
          .from(SCENE_BUCKET)
          .upload(scenePathValue, fixturePng, { contentType: 'image/png', upsert: true })
        if (uploadErr) throw new Error(`scene upload failed: ${uploadErr.message}`)
        const { error: updateErr } = await db
          .from('site_layouts')
          .update({ scene_path: scenePathValue, scene_width: 1600, scene_height: 900 })
          .eq('id', layoutId)
        if (updateErr) throw new Error(`site_layouts update failed: ${updateErr.message}`)
      }
    }

    // Ensure the EVAL Press machine exists on that layout.
    let pressId: string
    {
      const { data: existing, error: existingErr } = await db
        .from('site_machines')
        .select('id')
        .eq('site_layout_id', layoutId)
        .eq('organisation_id', siteOrgId)
        .eq('name', EVAL_PLANT_MACHINE)
        .maybeSingle()
      if (existingErr) throw new Error(`site_machines lookup failed: ${existingErr.message}`)
      if (existing) {
        pressId = existing.id
      } else {
        const { data: created, error: createErr } = await db
          .from('site_machines')
          .insert({
            site_layout_id: layoutId,
            organisation_id: siteOrgId,
            name: EVAL_PLANT_MACHINE,
            department_id: dept.id,
            polygon: PRESS_POLYGON,
            code: newMachineCode(),
            sort: 0,
          })
          .select('id')
          .single()
        if (createErr || !created) throw new Error(`site_machines insert failed: ${createErr?.message}`)
        pressId = created.id
      }
    }

    // Re-ensure the SOP<->machine link every run -- site-editor's reset
    // cascades sop_machines away (T-52-05-B).
    const { error: linkErr } = await db
      .from('sop_machines')
      .upsert(
        { organisation_id: siteOrgId, sop_id: plantSopId, machine_id: pressId },
        { onConflict: 'sop_id,machine_id' }
      )
    if (linkErr) throw new Error(`sop_machines upsert failed: ${linkErr.message}`)
  })

  test('eval-site worker at 1440 sees the scene, a pin on EVAL Press, the Now card, the panel, a chip fit, the ask highlight and the voice dialog — no scope column, no console errors', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteWorker')
    await page.goto('/sops')

    // 1. The scene renders.
    const stage = page.getByTestId('plant-stage')
    await expect(stage).toBeVisible(SLOW)
    await expect
      .poll(async () => stage.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth), SLOW)
      .toBeGreaterThan(0)
    await expect(page.getByTestId('plant-machine')).toHaveCount(1, { timeout: SLOW.timeout })

    // 2. No scope column, no worker list search box -- the plant replaces
    // both. { exact: true } is required: Playwright's default name match is
    // a case-insensitive substring, and "Ask or search SOPs" (PlantAskBar)
    // contains "search SOPs" -- a loose match here would count the ask bar.
    await expect(page.getByTestId('worker-miller-scope')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Search SOPs', exact: true })).toHaveCount(0)

    // 3. A pin on EVAL Press.
    const press = page.locator('[data-testid="plant-machine"][data-machine-name="EVAL Press"]')
    await expect(press).toHaveAttribute('data-pin', /^[1-9]\d*$/, { timeout: 45_000 })
    await expect(page.getByTestId('plant-pin').first()).toBeVisible()
    await shot(page, 'plant-home')

    // 4. The Now card.
    const nowCard = page.getByTestId('plant-now-card')
    await expect(nowCard).toBeVisible(SLOW)
    await expect(nowCard).toContainText(EVAL_PLANT_SOP_TITLE)
    await expect(page.getByTestId('plant-now-walk')).toHaveAttribute('href', `/sops/${plantSopId}?tab=walk`)

    // 5. Click the machine -- panel opens, camera flies in.
    const fit = await readWorldTransform(page)
    await press.click()
    const panel = page.getByTestId('plant-panel')
    await expect(panel).toHaveAttribute('data-open', 'true', SLOW)
    const panelRow = panel.getByTestId('plant-panel-row').filter({ hasText: EVAL_PLANT_SOP_TITLE })
    await expect(panelRow).toBeVisible(SLOW)
    await expect(panelRow.getByTestId('plant-rel-badge')).toHaveAttribute('data-rel', 'never')
    await expect(panelRow.getByTestId('plant-panel-walk')).toHaveAttribute('href', `/sops/${plantSopId}?tab=walk`)
    await expect
      .poll(async () => {
        const s = (await readWorldTransform(page)).scale
        return closeTo(s, 1.5) && !closeTo(s, fit.scale)
      }, SLOW)
      .toBe(true)
    await shot(page, 'plant-home-panel')

    // 6. Close -- camera returns to fit.
    await page.getByTestId('plant-panel-close').click()
    await expect(panel).toHaveAttribute('data-open', 'false', SLOW)
    await expect
      .poll(async () => closeTo((await readWorldTransform(page)).scale, fit.scale), SLOW)
      .toBe(true)

    // 7. Department chip fits the camera to the zone.
    await page.getByTestId('plant-zone-chip').filter({ hasText: 'Forming' }).click()
    await expect
      .poll(async () => {
        const t = await readWorldTransform(page)
        return !closeTo(t.scale, fit.scale) || !closeTo(t.x, fit.x) || !closeTo(t.y, fit.y)
      }, SLOW)
      .toBe(true)
    await shot(page, 'plant-home-zone')
    await page.getByTestId('plant-zone-chip').filter({ hasText: 'Whole site' }).click()

    // 8. Ask bar highlights matching machines.
    const ask = page.getByTestId('plant-ask')
    await ask.fill('press')
    await expect(press).toHaveAttribute('data-highlighted', 'true', SLOW)
    await ask.fill('zzzz-no-match')
    await expect(page.locator('[data-testid="plant-machine"][data-highlighted="true"]')).toHaveCount(0)
    await ask.fill('plant fixture')
    await expect(press).toHaveAttribute('data-highlighted', 'true', SLOW)
    await shot(page, 'plant-home-ask')
    await ask.fill('')

    // 9. Voice dialog opens and closes (the token is only fetched on mic press
    // inside the modal, so opening here never starts the microphone).
    await page.getByTestId('plant-ask-mic').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await shot(page, 'plant-home-voice')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // 10. Show me reopens the panel on the Now card's machine.
    await page.getByTestId('plant-now-show').click()
    await expect(panel).toHaveAttribute('data-open', 'true', SLOW)
    await expect(panel).toContainText('EVAL Press')

    // 11. No console errors across the whole flow.
    expect(errors).toEqual([])
  })

  test('a worker whose org has no site still sees the list', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Fallback proof needs a real-org account whose org has NO drawn site.
    // If Simon has drawn one at /admin/site since this eval last ran, the
    // list branch is unreachable with this account -- skip rather than fail.
    const { data: layouts, error: layoutErr } = await db
      .from('site_layouts')
      .select('id')
      .eq('organisation_id', REAL_SOPSTART_ORG_ID)
      .not('scene_path', 'is', null)
    if (layoutErr) throw new Error(`real-org layout lookup failed: ${layoutErr.message}`)
    let hasDrawnSite = false
    if (layouts && layouts.length > 0) {
      const { count, error: machErr } = await db
        .from('site_machines')
        .select('id', { count: 'exact', head: true })
        .in(
          'site_layout_id',
          layouts.map((l) => l.id)
        )
      if (machErr) throw new Error(`real-org machine lookup failed: ${machErr.message}`)
      hasDrawnSite = (count ?? 0) > 0
    }
    test.skip(hasDrawnSite, 'real SOPstart org now has a drawn site — fallback not reachable with eval-worker')

    await signInAs(context, 'worker')
    await page.goto('/sops')
    await expect(page.getByTestId('worker-miller-scope')).toBeVisible(SLOW)
    await expect(page.getByTestId('plant-stage')).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Search SOPs', exact: true })).toBeVisible()
    await shot(page, 'plant-home-fallback')
  })
})
