/**
 * Deployed-site eval — Phase 51 "Site Model & Machine Editor" (D-15).
 *
 * Runs against EVAL_BASE_URL (normally https://sopstart.com via `npm run
 * eval`) as the eval-site-admin fixture, which is admin of its OWN org
 * "SOPstart Eval Site" (never the shared SOPstart eval org bd2c2b88…) so the
 * beforeAll reset can safely delete the org's site before every run — the
 * empty state is only reachable with no layout, and doing that reset in the
 * real SOPstart org would delete Simon's actual site map.
 *
 * Every test self-skips when EVAL_BASE_URL is unset so the normal suite
 * never touches production. Provision fixtures first: `node scripts/eval-fixtures.mjs`.
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_SITE_ORG_NAME, EVAL_SITE_SOP_TITLE, EVAL_SITE_DEPARTMENT, signInAs } from './lib/session'
import { SCENE_BUCKET, MACHINE_CODE_PATTERN } from '@/lib/site/scene'

// The real, shared SOPstart org — the beforeAll reset must never touch it
// (T-51-07-A). See scripts/eval-fixtures.mjs EVAL_ORG_ID / memory project_prod_org_merge.
const REAL_SOPSTART_ORG_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea'

const SHOTS = path.join(process.cwd(), '.planning', 'evals', 'latest')
fs.mkdirSync(SHOTS, { recursive: true })
async function shot(page: Page, name: string) {
  // Explicit bounded timeout (unlike sop-surface's copy of this helper):
  // waitForLoadState has no default timeout of its own — it would otherwise
  // block for the whole remaining test budget if the page never reaches
  // network-idle (observed live on /admin/site — a long-lived connection
  // keeps at least one request open), starving every later step.
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

const SLOW = { timeout: 25_000 }
// Creating a machine (close-polygon -> upsertSiteMachine) observed taking well
// over 25s on production for the first call in a session — give it the same
// generous budget as the upload-processing wait, rather than the standard SLOW.
const CREATE_SLOW = { timeout: 60_000 }

type Transform = { boxX: number; boxY: number; scale: number; x: number; y: number }

async function readTransform(page: Page): Promise<Transform> {
  const canvas = page.getByTestId('site-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('site-canvas has no bounding box')
  const scale = parseFloat((await canvas.getAttribute('data-scale')) ?? '1')
  const x = parseFloat((await canvas.getAttribute('data-x')) ?? '0')
  const y = parseFloat((await canvas.getAttribute('data-y')) ?? '0')
  return { boxX: box.x, boxY: box.y, scale, x, y }
}

/** Scene-pixel point -> viewport screen point, via the current stage transform (D-02). */
function toScreen(t: Transform, [sx, sy]: [number, number]) {
  return { x: t.boxX + t.x + sx * t.scale, y: t.boxY + t.y + sy * t.scale }
}

function closeTo(actual: number, expected: number, tol = 4) {
  return Math.abs(actual - expected) <= tol
}

/**
 * Click each scene-pixel corner in sequence (closing the polygon by
 * re-clicking the first corner). A move + a short settle delay between
 * clicks is required — firing page.mouse.click() back-to-back with no gap
 * let the browser coalesce/drop clicks against the Konva stage, so only the
 * first vertex was ever recorded (observed live on /admin/site).
 */
async function drawPolygon(page: Page, t: Transform, corners: [number, number][]) {
  for (const corner of [...corners, corners[0]]) {
    const p = toScreen(t, corner)
    await page.mouse.move(p.x, p.y)
    await page.waitForTimeout(150)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(300)
  }
}

test.describe('Phase 51 — site editor (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) — run via `npm run eval`')

  let db: SupabaseClient
  let siteOrgId: string
  let departmentId: string
  let fixtureSopId: string

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

    // T-51-07-A: hard-assert before any delete, never the real tenant.
    if (siteOrgId === REAL_SOPSTART_ORG_ID) {
      throw new Error('refusing to run — resolved org id equals the real SOPstart org')
    }

    // Reset the eval-site org's site so the editor opens on the empty state.
    const { data: layoutFolders } = await db.storage.from(SCENE_BUCKET).list(siteOrgId)
    for (const folder of layoutFolders ?? []) {
      const { data: files } = await db.storage.from(SCENE_BUCKET).list(`${siteOrgId}/${folder.name}`)
      const paths = (files ?? []).map((f) => `${siteOrgId}/${folder.name}/${f.name}`)
      if (paths.length > 0) await db.storage.from(SCENE_BUCKET).remove(paths)
    }
    const { error: delErr } = await db.from('site_layouts').delete().eq('organisation_id', siteOrgId)
    if (delErr) throw new Error(`site_layouts reset failed: ${delErr.message}`)

    const { data: dept, error: deptErr } = await db
      .from('departments')
      .select('id')
      .eq('organisation_id', siteOrgId)
      .eq('name', EVAL_SITE_DEPARTMENT)
      .maybeSingle()
    if (deptErr || !dept) throw new Error(`"${EVAL_SITE_DEPARTMENT}" department not found — run node scripts/eval-fixtures.mjs`)
    departmentId = dept.id

    const { data: sop, error: sopErr } = await db
      .from('sops')
      .select('id')
      .eq('organisation_id', siteOrgId)
      .eq('title', EVAL_SITE_SOP_TITLE)
      .maybeSingle()
    if (sopErr || !sop) throw new Error(`"${EVAL_SITE_SOP_TITLE}" fixture SOP not found — run node scripts/eval-fixtures.mjs`)
    fixtureSopId = sop.id
  })

  test('admin uploads a scene, draws two machines (one after zoom+pan), names them, tags a department, moves a corner, links a SOP from the editor, and reloads', async ({
    page,
    context,
  }) => {
    // Generous: several save-triggering actions (machine create x2,
    // rename/department, vertex drag, editor link, unlink/relink) each
    // occasionally take tens of seconds server-side on production.
    test.setTimeout(600_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors = watchConsole(page)
    await signInAs(context, 'siteAdmin')

    // 1. Empty state in Site & departments (Manage SOPs).
    await page.goto('/?s=manage&view=site')
    await expect(page).toHaveURL((u) => u.pathname === '/' && u.search === '?s=manage&view=site')
    await expect(page.getByTestId('site-empty-state')).toBeVisible(SLOW)
    await expect(page.getByText('Upload an image')).toBeVisible()
    const canGenerate = (await page.getByTestId('site-generate-button').count()) > 0
    test.info().annotations.push({
      type: 'site-generate-button',
      description: canGenerate ? 'present — GEMINI_API_KEY is set on Railway' : 'absent — GEMINI_API_KEY is not set on Railway',
    })
    await shot(page, 'site-empty')

    // 2. Upload the fixture PNG (D-07 records natural size before any polygon is drawn).
    const fixturePath = path.join(process.cwd(), 'tests', 'evals', 'fixtures', 'site-scene.png')
    await page.getByTestId('site-upload-input').setInputFiles(fixturePath)
    await expect(page.getByTestId('site-canvas')).toBeVisible({ timeout: 45_000 })

    {
      const { data: layout, error } = await db
        .from('site_layouts')
        .select('scene_width, scene_height')
        .eq('organisation_id', siteOrgId)
        .single()
      expect(error).toBeNull()
      expect(layout?.scene_width).toBe(1600)
      expect(layout?.scene_height).toBe(900)
    }

    // 3. Draw the first machine — corners in SCENE-pixel space (D-02).
    const firstCorners: [number, number][] = [
      [200, 200],
      [520, 200],
      [520, 460],
      [200, 460],
    ]
    await page.getByTestId('site-draw-machine').click()
    let t = await readTransform(page)
    await drawPolygon(page, t, firstCorners)
    await expect(page.getByTestId('site-machine-row')).toHaveCount(1, CREATE_SLOW)
    await page.getByTestId('site-machine-name').fill('EVAL Press')
    await page.getByTestId('site-machine-department').selectOption({ label: 'Forming' })
    await expect(page.getByTestId('site-save-status')).toHaveText('Saved ✓', CREATE_SLOW)

    // 4. Zoom toward the canvas centre, then pan an empty area (away from the
    // machine just drawn), then draw the second machine using the NEW transform.
    const canvasBox = (await page.getByTestId('site-canvas').boundingBox())!
    const centre = { x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + canvasBox.height / 2 }
    const scaleBefore = t.scale
    await page.mouse.move(centre.x, centre.y)
    await page.mouse.wheel(0, -300)
    await expect
      .poll(async () => parseFloat((await page.getByTestId('site-canvas').getAttribute('data-scale')) ?? '0'), SLOW)
      .toBeGreaterThan(scaleBefore)

    const panFrom = { x: canvasBox.x + canvasBox.width * 0.85, y: canvasBox.y + canvasBox.height * 0.85 }
    const xBefore = (await readTransform(page)).x
    await page.mouse.move(panFrom.x, panFrom.y)
    await page.mouse.down()
    await page.mouse.move(panFrom.x - 80, panFrom.y - 40, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(async () => parseFloat((await page.getByTestId('site-canvas').getAttribute('data-x')) ?? '0'), SLOW)
      .not.toBe(xBefore)

    const secondCorners: [number, number][] = [
      [900, 300],
      [1200, 300],
      [1200, 600],
      [900, 600],
    ]
    await page.getByTestId('site-draw-machine').click()
    t = await readTransform(page)
    await drawPolygon(page, t, secondCorners)
    await expect(page.getByTestId('site-machine-row')).toHaveCount(2, CREATE_SLOW)
    await page.getByTestId('site-machine-name').fill('EVAL Oven')
    await expect(page.getByTestId('site-save-status')).toHaveText('Saved ✓', CREATE_SLOW)

    // 5. Move a corner of EVAL Press: drag (520,200) -> (560,180).
    await page.getByTestId('site-machine-row').filter({ hasText: 'EVAL Press' }).click()
    t = await readTransform(page)
    const from = toScreen(t, [520, 200])
    const to = toScreen(t, [560, 180])
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId('site-save-status')).toHaveText('Saved ✓', CREATE_SLOW)

    // 6. Link the fixture SOP from This SOP -> Machine in the focus editor (D-12 — the
    // same setSopMachines() action the site edit panel uses).
    await page.goto(`/sops/${fixtureSopId}?mode=edit`)
    const thisSop = page.getByTestId('this-sop')
    await expect(thisSop).toBeVisible(SLOW)
    await thisSop.getByText('Machine', { exact: true }).locator('xpath=..').getByRole('button').click()
    const picker = page.getByTestId('machines-picker')
    await expect(picker).toBeVisible(SLOW)
    await picker.getByRole('checkbox', { name: 'EVAL Press' }).check()
    await expect(picker.getByText('Saved ✓')).toBeVisible(CREATE_SLOW)
    await shot(page, 'editor-machines')
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()

    // 7. Site & departments + reload — both machines and the link persist.
    await page.goto('/?s=manage&view=site')
    await page.reload()
    const rows = page.getByTestId('site-machine-row')
    await expect(rows).toHaveCount(2, SLOW)
    const pressRow = rows.filter({ hasText: 'EVAL Press' })
    const ovenRow = rows.filter({ hasText: 'EVAL Oven' })
    await expect(pressRow).toBeVisible()
    await expect(ovenRow).toBeVisible()
    await expect(pressRow).toContainText('Forming')
    await expect(pressRow).toContainText('1 SOP')
    // site-machine-sops-toggle is a SIBLING of the row button in the same
    // card div, not a descendant of it — go up to the card before searching,
    // or the locator never resolves and .click() waits out the whole test
    // budget (found live: both attempts hung here for the full timeout).
    await pressRow.locator('..').getByTestId('site-machine-sops-toggle').click()
    await expect(page.getByText(EVAL_SITE_SOP_TITLE)).toBeVisible(SLOW)
    await shot(page, 'site-editor')

    // 8. DB proofs (D-02: scene-pixel storage independent of zoom/pan).
    {
      const { data: machines, error } = await db
        .from('site_machines')
        .select('id, name, department_id, polygon, code')
        .eq('organisation_id', siteOrgId)
      expect(error).toBeNull()
      expect(machines).toHaveLength(2)

      const press = machines!.find((m) => m.name === 'EVAL Press')
      const oven = machines!.find((m) => m.name === 'EVAL Oven')
      expect(press).toBeTruthy()
      expect(oven).toBeTruthy()

      for (const m of [press!, oven!]) {
        expect(MACHINE_CODE_PATTERN.test(m.code)).toBe(true)
        for (const [x, y] of m.polygon as [number, number][]) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(1600)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(900)
        }
      }

      const expectedPress: [number, number][] = [[200, 200], [560, 180], [520, 460], [200, 460]]
      const pressPolygon = press!.polygon as [number, number][]
      expect(pressPolygon).toHaveLength(4)
      expectedPress.forEach(([ex, ey], i) => {
        expect(closeTo(pressPolygon[i][0], ex)).toBe(true)
        expect(closeTo(pressPolygon[i][1], ey)).toBe(true)
      })

      const ovenPolygon = oven!.polygon as [number, number][]
      expect(ovenPolygon).toHaveLength(4)
      secondCorners.forEach(([ex, ey], i) => {
        expect(closeTo(ovenPolygon[i][0], ex)).toBe(true)
        expect(closeTo(ovenPolygon[i][1], ey)).toBe(true)
      })

      expect(press!.department_id).toBe(departmentId)

      const { data: links, error: linkErr } = await db
        .from('sop_machines')
        .select('sop_id, machine_id')
        .eq('organisation_id', siteOrgId)
      expect(linkErr).toBeNull()
      expect(links).toHaveLength(1)
      expect(links![0].sop_id).toBe(fixtureSopId)
      expect(links![0].machine_id).toBe(press!.id)
    }

    // 9. Editor write paths: unlink, re-link, delete (with Delete key).
    await page.getByRole('button', { name: 'Unlink' }).click()
    await expect(page.getByTestId('site-save-status')).toHaveText('Saved ✓', CREATE_SLOW)
    {
      const { data: links } = await db.from('sop_machines').select('sop_id').eq('organisation_id', siteOrgId)
      expect(links).toHaveLength(0)
    }

    await page.getByTestId('site-link-sop-input').fill(EVAL_SITE_SOP_TITLE)
    await page.getByRole('button', { name: EVAL_SITE_SOP_TITLE, exact: true }).click()
    await expect(page.getByTestId('site-save-status')).toHaveText('Saved ✓', CREATE_SLOW)
    {
      const { data: links } = await db.from('sop_machines').select('sop_id').eq('organisation_id', siteOrgId)
      expect(links).toHaveLength(1)
    }

    await page.getByTestId('site-machine-row').filter({ hasText: 'EVAL Oven' }).click()
    await page.keyboard.press('Delete')
    await expect(page.getByTestId('site-machine-row')).toHaveCount(1, CREATE_SLOW)
    {
      const { data: machines } = await db.from('site_machines').select('id').eq('organisation_id', siteOrgId)
      expect(machines).toHaveLength(1)
    }

    // 10. No console errors across the whole flow.
    expect(errors).toEqual([])
  })

  test('a worker gets the SOP list, not the editor, at the site editor address', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signInAs(context, 'siteWorker')
    await page.goto('/?s=manage&view=site')
    await expect(page.getByTestId('sop-list')).toBeVisible(SLOW)
    await expect(page.getByTestId('home-section-sops')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('site-draw-machine')).toHaveCount(0)
    await expect(page.getByTestId('dept-strip')).toHaveCount(0)
  })
})
