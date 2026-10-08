/**
 * Deployed-site eval — ADR-0003 site templates.
 *
 * Runs as eval-template-admin, sole admin of a throwaway org ("SOPstart Eval
 * Templates") that beforeAll recreates and afterAll deletes, so applying a
 * template never touches the real org or the shared eval-site org. For each
 * template: reset the org's site, pick the template on the empty state, then
 * prove the site editor lists its departments and machines and screenshot it.
 * The template's picture is the editor's workspace; where the rooms sat in it
 * is gone (ADR-0005), so no room position is asserted.
 *
 * Self-skips when EVAL_BASE_URL is unset.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, EVAL_USERS, signInAs } from './lib/session'
import { REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
import { SCENE_BUCKET } from '@/lib/site/scene'
import { SITE_PRESETS } from '@/lib/site/presets'

const ORG_NAME = 'SOPstart Eval Templates'
const SLOW = { timeout: 60_000 }

let db: SupabaseClient
let orgId = ''

async function clearScenes(id: string) {
  const { data: folders } = await db.storage.from(SCENE_BUCKET).list(id)
  for (const f of folders ?? []) {
    const { data: files } = await db.storage.from(SCENE_BUCKET).list(`${id}/${f.name}`)
    const paths = (files ?? []).map((x) => `${id}/${f.name}/${x.name}`)
    if (paths.length > 0) await db.storage.from(SCENE_BUCKET).remove(paths)
  }
}

async function deleteOrg(id: string) {
  if (id === REAL_SOPSTART_ORG_ID) throw new Error('refusing to delete the real SOPstart org')
  await clearScenes(id)
  const { error } = await db.from('organisations').delete().eq('id', id)
  if (error) throw new Error(`org delete failed: ${error.message}`)
}

test.describe.serial('ADR-0003 site templates', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL not set')

  test.beforeAll(async () => {
    if (!EVAL_ENV_READY) return
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

    const { data: stale } = await db.from('organisations').select('id').eq('name', ORG_NAME)
    for (const o of stale ?? []) await deleteOrg(o.id)

    const { data: org, error: orgErr } = await db.from('organisations').insert({ name: ORG_NAME }).select('id').single()
    if (orgErr || !org) throw new Error(`org create failed: ${orgErr?.message}`)
    orgId = org.id

    const email = EVAL_USERS.templateAdmin
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
    let user = list?.users.find((u) => u.email === email)
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } })
      if (error || !data.user) throw new Error(`user create failed: ${error?.message}`)
      user = data.user
    }
    const { error: memErr } = await db.from('organisation_members').upsert(
      { organisation_id: orgId, user_id: user.id, role: 'admin' },
      { onConflict: 'organisation_id,user_id' }
    )
    if (memErr) throw new Error(`member upsert failed: ${memErr.message}`)
  })

  test.afterAll(async () => {
    if (orgId) await deleteOrg(orgId)
  })

  for (const preset of SITE_PRESETS) {
    test(`${preset.name}: picking the template draws its site, departments and machines`, async ({ page, context }) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width: 1440, height: 900 })
      const errors = watchConsole(page)

      await clearScenes(orgId)
      await db.from('site_layouts').delete().eq('organisation_id', orgId)
      await db.from('departments').delete().eq('organisation_id', orgId)

      await signInAs(context, 'templateAdmin')
      await page.goto('/?s=manage&view=site')
      await expect(page.getByTestId('site-empty-state')).toBeVisible(SLOW)
      await expect(page.getByTestId('site-preset')).toHaveCount(SITE_PRESETS.length)
      if (preset.id === SITE_PRESETS[0].id) await shot(page, 'templates-picker')

      await page.locator(`[data-testid="site-preset"][data-preset-id="${preset.id}"]`).click()
      await expect(page.getByTestId('site-empty-state')).toHaveCount(0, { timeout: 120_000 })

      const { data: layout } = await db.from('site_layouts').select('id, preset, scene_width, scene_height').eq('organisation_id', orgId).single()
      expect(layout?.preset).toBe(preset.id)
      const { count } = await db.from('site_machines').select('id', { count: 'exact', head: true }).eq('site_layout_id', layout!.id)
      expect(count).toBe(preset.machines.length)

      // The editor lists the template's machines and departments.
      await expect(page.getByTestId('site-machine-row')).toHaveCount(preset.machines.length, SLOW)
      await expect(page.getByTestId('dept-strip-row')).toHaveCount(preset.departments.length, SLOW)
      await shot(page, `template-${preset.id}`)

      // Done returns to the list: the home opens on the new site's areas.
      await page.getByTestId('site-edit-done').click()
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      await page.goto('/')
      await expect(page.getByTestId('home')).toBeVisible(SLOW)
      await shot(page, `template-${preset.id}-home`)

      expect(errors).toEqual([])
    })
  }
})
