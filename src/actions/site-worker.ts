'use server'

/**
 * Phase 52 (D-03) — worker-readable site read. Every export in THIS file is
 * SESSION-SCOPED, NOT admin-gated (the opposite invariant of src/actions/site.ts,
 * which is why this lives in its own file — RESEARCH Pitfall 1/A1). RLS
 * (migration 00067_site_model.sql, same-org SELECT for every role) is the
 * primary control; every query here ALSO carries an explicit
 * `.eq('organisation_id', orgId)` using the SESSION organisationId (never a
 * value read off a fetched row — 2026-07-28, 2026-08-04). The signed scene/
 * sprite URLs are TTL-bounded (SCENE_SIGNED_TTL_SEC) and are never logged.
 *
 * These tables are not yet in database.types.ts, so the session client is
 * used through an untyped view, exactly as src/actions/site.ts does.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSessionContext } from '@/lib/auth/session-context'
import type { SopMachineLink, SiteDepartment, WorkerSiteData, WorkerSiteMachine } from '@/lib/validators/site'
import { SCENE_BUCKET, SCENE_SIGNED_TTL_SEC } from '@/lib/site/scene'

export async function listSiteForWorker(): Promise<WorkerSiteData | { error: string }> {
  const ctx = await getSessionContext()
  if (!ctx.userId) return { error: 'Not signed in' }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  // 1. The org's site layout — oldest first, same as listSiteForOrg (D-04).
  const { data: layoutRow, error: layoutErr } = await db
    .from('site_layouts')
    .select('id, scene_path, scene_width, scene_height')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (layoutErr) {
    console.error('[listSiteForWorker] layout error', layoutErr)
    return { error: layoutErr.message }
  }
  const layout = layoutRow as { id: string; scene_path: string | null; scene_width: number | null; scene_height: number | null } | null
  if (!layout || !layout.scene_path || !layout.scene_width || !layout.scene_height) {
    // No layout, or an incomplete one — the page falls back to the list (D-04).
    return { layout: null, machines: [], links: [], departments: [] }
  }

  // 2. Sign the scene. A signing failure is an error, not a silent null.
  const { data: signedScene, error: sceneSignErr } = await db.storage
    .from(SCENE_BUCKET)
    .createSignedUrl(layout.scene_path, SCENE_SIGNED_TTL_SEC)
  if (sceneSignErr || !signedScene) {
    console.error('[listSiteForWorker] scene sign error', sceneSignErr)
    return { error: 'Could not load the site scene' }
  }

  // 3. This layout's machines.
  const { data: machineRows, error: machineErr } = await db
    .from('site_machines')
    .select('id, name, department_id, polygon, sprite_path, code')
    .eq('site_layout_id', layout.id)
    .eq('organisation_id', orgId)
    .order('sort', { ascending: true })
    .order('name', { ascending: true })
  if (machineErr) {
    console.error('[listSiteForWorker] machines error', machineErr)
    return { error: machineErr.message }
  }
  const machineData = (machineRows ?? []) as Array<{
    id: string
    name: string
    department_id: string | null
    polygon: WorkerSiteMachine['polygon']
    sprite_path: string | null
    code: string
  }>

  if (machineData.length === 0) {
    return {
      layout: { id: layout.id, sceneUrl: signedScene.signedUrl, sceneWidth: layout.scene_width, sceneHeight: layout.scene_height },
      machines: [],
      links: [],
      departments: [],
    }
  }

  // 4. Sprite URLs — a failed sign is "no photo yet", not a hard error.
  const machines: WorkerSiteMachine[] = await Promise.all(
    machineData.map(async (m) => {
      let spriteUrl: string | null = null
      if (m.sprite_path) {
        const { data: signedSprite } = await db.storage.from(SCENE_BUCKET).createSignedUrl(m.sprite_path, SCENE_SIGNED_TTL_SEC)
        spriteUrl = signedSprite?.signedUrl ?? null
      }
      return { id: m.id, name: m.name, department_id: m.department_id, polygon: m.polygon, spriteUrl, code: m.code }
    })
  )
  const machineIds = machines.map((m) => m.id)

  // 5. SOP<->machine links, narrowed to this caller's visible PUBLISHED SOPs.
  const { data: linkRows, error: linkErr } = await db
    .from('sop_machines')
    .select('sop_id, machine_id')
    .eq('organisation_id', orgId)
    .in('machine_id', machineIds)
  if (linkErr) {
    console.error('[listSiteForWorker] links error', linkErr)
    return { error: linkErr.message }
  }
  const rawLinks = (linkRows ?? []) as SopMachineLink[]

  const { data: visibleSopRows, error: sopErr } = await db
    .from('sops')
    .select('id')
    .eq('organisation_id', orgId)
    .eq('status', 'published')
  if (sopErr) {
    console.error('[listSiteForWorker] sops error', sopErr)
    return { error: sopErr.message }
  }
  const visibleSopIds = new Set(((visibleSopRows ?? []) as Array<{ id: string }>).map((r) => r.id))
  const links = rawLinks.filter((l) => visibleSopIds.has(l.sop_id))

  // 6. Departments (for chip labels + zone colours).
  const { data: deptRows, error: deptErr } = await db
    .from('departments')
    .select('id, name, colour')
    .eq('organisation_id', orgId)
    .eq('archived', false)
    .order('name', { ascending: true })
  if (deptErr) {
    console.error('[listSiteForWorker] departments error', deptErr)
    return { error: deptErr.message }
  }

  return {
    layout: { id: layout.id, sceneUrl: signedScene.signedUrl, sceneWidth: layout.scene_width, sceneHeight: layout.scene_height },
    machines,
    links,
    departments: (deptRows ?? []) as SiteDepartment[],
  }
}
