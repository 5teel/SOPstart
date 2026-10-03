/**
 * Shared eval-site fixture helper (Phase 52/53) -- one copy of the
 * upsert-only "ensure the eval-site org has its scene, EVAL Press, and the
 * published fixture SOP link" logic, used by the plant evals. Never deletes; hard-asserts the resolved
 * org id is never the real SOPstart org before any write (T-52-05-A / T-53-18).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EVAL_SITE_ORG_NAME, EVAL_SITE_DEPARTMENT, EVAL_PLANT_SOP_TITLE, EVAL_PLANT_MACHINE } from './session'
import { SCENE_BUCKET, scenePath, newMachineCode } from '@/lib/site/scene'

// The real, shared SOPstart org -- these helpers must never write here. See
// scripts/eval-fixtures.mjs EVAL_ORG_ID / memory project_prod_org_merge.
export const REAL_SOPSTART_ORG_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea'

export const PRESS_POLYGON = [
  [480, 180],
  [760, 180],
  [760, 420],
  [480, 420],
]

export interface PlantFixture {
  siteOrgId: string
  plantSopId: string
  pressId: string
  pressCode: string
}

/**
 * Re-ensures (upsert only, never delete) the eval-site org's scene, the EVAL
 * Press machine, and its link to the published fixture SOP. Site-editor's
 * eval resets the org's whole layout before every run, so this must run
 * fresh every time (T-52-05-B / T-53-18).
 */
export async function ensurePlantFixture(db: SupabaseClient): Promise<PlantFixture> {
  const { data: org, error: orgErr } = await db
    .from('organisations')
    .select('id')
    .eq('name', EVAL_SITE_ORG_NAME)
    .maybeSingle()
  if (orgErr) throw new Error(`org lookup failed: ${orgErr.message}`)
  if (!org) throw new Error(`"${EVAL_SITE_ORG_NAME}" org not found — run node scripts/eval-fixtures.mjs`)
  const siteOrgId = org.id

  // T-52-05-A / T-53-18: hard-assert before any write, never the real tenant.
  if (siteOrgId === REAL_SOPSTART_ORG_ID) {
    throw new Error('refusing to run — resolved org id equals the real SOPstart org')
  }

  const { data: plantSop, error: plantSopErr } = await db
    .from('sops')
    .select('id, status')
    .eq('organisation_id', siteOrgId)
    .eq('title', EVAL_PLANT_SOP_TITLE)
    .maybeSingle()
  if (plantSopErr || !plantSop)
    throw new Error(`"${EVAL_PLANT_SOP_TITLE}" fixture SOP not found — run node scripts/eval-fixtures.mjs`)
  if (plantSop.status !== 'published')
    throw new Error(`"${EVAL_PLANT_SOP_TITLE}" is not published — run node scripts/eval-fixtures.mjs`)
  const plantSopId = plantSop.id

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

  // Ensure the EVAL Press machine exists on that layout, and return its code.
  let pressId: string
  let pressCode: string
  {
    const { data: existing, error: existingErr } = await db
      .from('site_machines')
      .select('id, code')
      .eq('site_layout_id', layoutId)
      .eq('organisation_id', siteOrgId)
      .eq('name', EVAL_PLANT_MACHINE)
      .maybeSingle()
    if (existingErr) throw new Error(`site_machines lookup failed: ${existingErr.message}`)
    if (existing) {
      pressId = existing.id
      pressCode = existing.code as string
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
        .select('id, code')
        .single()
      if (createErr || !created) throw new Error(`site_machines insert failed: ${createErr?.message}`)
      pressId = created.id
      pressCode = created.code as string
    }
  }

  // Re-ensure the SOP<->machine link every run -- site-editor's reset
  // cascades sop_machines away (T-52-05-B).
  const { error: linkErr } = await db
    .from('sop_machines')
    .upsert({ organisation_id: siteOrgId, sop_id: plantSopId, machine_id: pressId }, { onConflict: 'sop_id,machine_id' })
  if (linkErr) throw new Error(`sop_machines upsert failed: ${linkErr.message}`)

  return { siteOrgId, plantSopId, pressId, pressCode }
}

/** True if the real SOPstart org now has a drawn site (>=1 machine). */
export async function realOrgHasDrawnSite(db: SupabaseClient): Promise<boolean> {
  const { data: layouts, error: layoutErr } = await db
    .from('site_layouts')
    .select('id')
    .eq('organisation_id', REAL_SOPSTART_ORG_ID)
    .not('scene_path', 'is', null)
  if (layoutErr) throw new Error(`real-org layout lookup failed: ${layoutErr.message}`)
  if (!layouts || layouts.length === 0) return false
  const { count, error: machErr } = await db
    .from('site_machines')
    .select('id', { count: 'exact', head: true })
    .in(
      'site_layout_id',
      layouts.map((l) => l.id)
    )
  if (machErr) throw new Error(`real-org machine lookup failed: ${machErr.message}`)
  return (count ?? 0) > 0
}

const SHOTS = path.join(process.cwd(), '.planning', 'evals', 'latest')
fs.mkdirSync(SHOTS, { recursive: true })

/** Screenshot a page, bounded so a page that never idles can't starve the rest of the test. */
export async function shot(page: Page, name: string) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

/** Fail the test on any uncaught page error or React hydration/minified error in the console. */
export function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/Minified React error|Hydration|hydrat|Warning:|Unhandled/i.test(t)) errors.push(`console: ${t.slice(0, 200)}`)
  })
  return errors
}
