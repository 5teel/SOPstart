'use server'

/**
 * Phase 51 — site model server actions (D-01, D-02, D-04, D-05, D-07, D-12).
 *
 * Exports:
 *  - listSiteForOrg()       — the org's site (layout + machines + links + departments + SOPs + canGenerate)
 *  - createSceneUploadUrl() — signed upload URL for a brand-new scene image
 *  - upsertSiteLayout()     — probes the stored object with sharp, records natural size (D-07)
 *  - upsertSiteMachine()    — create/update a machine's name/department/polygon (D-02)
 *  - deleteSiteMachine()    — delete a machine (sop_machines cascades, D-13)
 *  - setSopMachines()       — replace-semantics SOP<->machine linking, insert-before-prune (D-12)
 *  - listSopMachines()      — machines + departments + this SOP's linked ids, for the builder panel
 *
 * All functions return a discriminated union `{ ... } | { error }` — never throw.
 * requireAdminContext() runs first in every export; the session client carries the
 * admin write RLS policy on all three tables (D-04) — no service-role client is
 * ever imported here. Every query also adds an explicit `.eq('organisation_id', orgId)`
 * using the SESSION organisationId (never a value read off a fetched row — 2026-07-28).
 *
 * These tables are not yet in database.types.ts, so the session client is used
 * through an untyped view, exactly as departments.ts does for its junction tables.
 */
import { z } from 'zod'
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminContext } from '@/lib/auth/guards'
import {
  SCENE_MAX_BYTES,
  upsertSiteMachineSchema,
  upsertSiteLayoutSchema,
  setSopMachinesSchema,
  sceneExtSchema,
} from '@/lib/validators/site'
import type {
  SiteData,
  SiteLayout,
  SiteMachine,
  SopMachineLink,
  SiteDepartment,
  SiteSopOption,
} from '@/lib/validators/site'
import { scenePath, polygonWithinScene, newMachineCode, SCENE_BUCKET, SCENE_SIGNED_TTL_SEC } from '@/lib/site/scene'

// ---------------------------------------------------------------------------
// 1. listSiteForOrg
// ---------------------------------------------------------------------------

export async function listSiteForOrg(): Promise<SiteData | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const { data: layoutRow, error: layoutErr } = await db
    .from('site_layouts')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (layoutErr) {
    console.error('[listSiteForOrg] layout error', layoutErr)
    return { error: layoutErr.message }
  }

  let layout: (SiteLayout & { sceneUrl: string }) | null = null
  let machines: SiteMachine[] = []

  if (layoutRow) {
    const row = layoutRow as SiteLayout
    let sceneUrl = ''
    if (row.scene_path) {
      const { data: signed, error: signErr } = await db.storage
        .from(SCENE_BUCKET)
        .createSignedUrl(row.scene_path, SCENE_SIGNED_TTL_SEC)
      // A signing failure is an error, not a silent null — the scene must be
      // shown or the caller must know it can't be.
      if (signErr || !signed) {
        console.error('[listSiteForOrg] sign error', signErr)
        return { error: 'Could not load the site scene' }
      }
      sceneUrl = signed.signedUrl
    }
    layout = { ...row, sceneUrl }

    const { data: machineRows, error: machineErr } = await db
      .from('site_machines')
      .select('*')
      .eq('site_layout_id', row.id)
      .eq('organisation_id', orgId)
      .order('sort', { ascending: true })
      .order('name', { ascending: true })
    if (machineErr) {
      console.error('[listSiteForOrg] machines error', machineErr)
      return { error: machineErr.message }
    }
    machines = (machineRows ?? []) as SiteMachine[]
  }

  const { data: linkRows, error: linkErr } = await db
    .from('sop_machines')
    .select('sop_id, machine_id')
    .eq('organisation_id', orgId)
  if (linkErr) {
    console.error('[listSiteForOrg] links error', linkErr)
    return { error: linkErr.message }
  }

  const { data: deptRows, error: deptErr } = await db
    .from('departments')
    .select('id, name, colour')
    .eq('organisation_id', orgId)
    .eq('archived', false)
    .order('name', { ascending: true })
  if (deptErr) {
    console.error('[listSiteForOrg] departments error', deptErr)
    return { error: deptErr.message }
  }

  const { data: sopRows, error: sopErr } = await db
    .from('sops')
    .select('id, title')
    .eq('organisation_id', orgId)
    .not('title', 'is', null)
    .order('title', { ascending: true })
  if (sopErr) {
    console.error('[listSiteForOrg] sops error', sopErr)
    return { error: sopErr.message }
  }

  return {
    layout,
    machines,
    links: (linkRows ?? []) as SopMachineLink[],
    departments: (deptRows ?? []) as SiteDepartment[],
    sops: (sopRows ?? []) as SiteSopOption[],
    // The key itself is never returned — only whether it's set (T-51-04).
    canGenerate: Boolean(process.env.GEMINI_API_KEY),
  }
}

// ---------------------------------------------------------------------------
// 2. createSceneUploadUrl
// ---------------------------------------------------------------------------

export async function createSceneUploadUrl(
  input: { ext: string }
): Promise<{ layoutId: string; path: string; token: string } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsedExt = sceneExtSchema.safeParse(input?.ext)
  if (!parsedExt.success) return { error: 'Invalid file type' }

  // The v1 UI works with the org's first/only layout — refuse a second scene
  // rather than silently orphaning the first (also caps paid generations, T-51-04-A).
  const { data: existing, error: existingErr } = await db
    .from('site_layouts')
    .select('id')
    .eq('organisation_id', orgId)
    .limit(1)
    .maybeSingle()
  if (existingErr) {
    console.error('[createSceneUploadUrl] existing check error', existingErr)
    return { error: existingErr.message }
  }
  if (existing) return { error: 'This organisation already has a site' }

  const layoutId = crypto.randomUUID()
  const path = scenePath(orgId, layoutId, parsedExt.data)

  // The client never supplies a path — it is built server-side from the
  // session org + a server-generated UUID + a validated ext enum (T-51-03).
  const { data: signedData, error: signError } = await db.storage
    .from(SCENE_BUCKET)
    .createSignedUploadUrl(path)
  if (signError || !signedData) {
    console.error('[createSceneUploadUrl] sign error', signError)
    return { error: 'Failed to create upload URL. Please try again.' }
  }

  return { layoutId, path, token: signedData.token }
}

// ---------------------------------------------------------------------------
// 3. upsertSiteLayout — the ONLY place a layout row is written (D-07).
//    The generate route calls this too, so the natural-size probe exists
//    exactly once (2026-09-27 "the same classifier written twice will drift").
// ---------------------------------------------------------------------------

export async function upsertSiteLayout(
  input: { id: string; ext: string; name?: string }
): Promise<{ layout: SiteLayout } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = upsertSiteLayoutSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { id, ext, name } = parsed.data

  const path = scenePath(orgId, id, ext)

  const { data: fileBlob, error: downloadErr } = await db.storage.from(SCENE_BUCKET).download(path)
  if (downloadErr || !fileBlob) {
    console.error('[upsertSiteLayout] download error', downloadErr)
    return { error: 'Could not read the uploaded image' }
  }

  const buf = Buffer.from(await fileBlob.arrayBuffer())
  if (buf.byteLength > SCENE_MAX_BYTES) {
    await db.storage.from(SCENE_BUCKET).remove([path])
    return { error: 'That file is not a JPG or PNG image' }
  }

  let meta: sharp.Metadata
  try {
    meta = await sharp(buf).metadata()
  } catch (err) {
    console.error('[upsertSiteLayout] sharp error', err)
    await db.storage.from(SCENE_BUCKET).remove([path])
    return { error: 'That file is not a JPG or PNG image' }
  }
  if ((meta.format !== 'jpeg' && meta.format !== 'png') || !meta.width || !meta.height) {
    await db.storage.from(SCENE_BUCKET).remove([path])
    return { error: 'That file is not a JPG or PNG image' }
  }

  const now = new Date().toISOString()
  const { data: layoutRow, error: upsertErr } = await db
    .from('site_layouts')
    .upsert(
      {
        id,
        organisation_id: orgId,
        name: name ?? 'Site',
        scene_path: path,
        scene_width: meta.width,
        scene_height: meta.height,
        updated_at: now,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single()
  if (upsertErr || !layoutRow) {
    console.error('[upsertSiteLayout] upsert error', upsertErr)
    return { error: upsertErr?.message ?? 'Failed to save the site scene' }
  }

  return { layout: layoutRow as SiteLayout }
}

// ---------------------------------------------------------------------------
// 4. upsertSiteMachine — polygon must lie inside the layout's scene (D-02).
// ---------------------------------------------------------------------------

export async function upsertSiteMachine(
  input: {
    id?: string
    siteLayoutId: string
    name: string
    departmentId: string | null
    polygon: [number, number][]
    sort?: number
  }
): Promise<{ machine: SiteMachine } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = upsertSiteMachineSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { id, siteLayoutId, name, departmentId, polygon, sort } = parsed.data

  const { data: layoutRow, error: layoutErr } = await db
    .from('site_layouts')
    .select('scene_width, scene_height')
    .eq('id', siteLayoutId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (layoutErr) {
    console.error('[upsertSiteMachine] layout lookup error', layoutErr)
    return { error: layoutErr.message }
  }
  if (!layoutRow) return { error: 'Site not found' }
  const { scene_width, scene_height } = layoutRow as { scene_width: number | null; scene_height: number | null }
  if (!scene_width || !scene_height || !polygonWithinScene(polygon, scene_width, scene_height)) {
    return { error: 'Every corner must be on the scene' }
  }

  if (departmentId) {
    const { data: deptRow, error: deptErr } = await db
      .from('departments')
      .select('id')
      .eq('id', departmentId)
      .eq('organisation_id', orgId)
      .maybeSingle()
    if (deptErr) {
      console.error('[upsertSiteMachine] department lookup error', deptErr)
      return { error: deptErr.message }
    }
    if (!deptRow) return { error: 'Unknown department' }
  }

  const now = new Date().toISOString()

  if (id) {
    const { data: updated, error: updateErr } = await db
      .from('site_machines')
      .update({
        name,
        department_id: departmentId,
        polygon,
        ...(sort !== undefined ? { sort } : {}),
        updated_at: now,
      })
      .eq('id', id)
      .eq('organisation_id', orgId)
      .select('*')
    if (updateErr) {
      console.error('[upsertSiteMachine] update error', updateErr)
      return { error: updateErr.message }
    }
    if (!updated || updated.length === 0) return { error: 'Machine not found' }
    return { machine: updated[0] as SiteMachine }
  }

  // Retry up to 3 times only on a code-uniqueness collision (23505).
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: inserted, error: insertErr } = await db
      .from('site_machines')
      .insert({
        site_layout_id: siteLayoutId,
        organisation_id: orgId,
        name,
        department_id: departmentId,
        polygon,
        code: newMachineCode(),
        sort: sort ?? 0,
        updated_at: now,
      })
      .select('*')
      .single()
    if (!insertErr) return { machine: inserted as SiteMachine }
    if (insertErr.code !== '23505') {
      console.error('[upsertSiteMachine] insert error', insertErr)
      return { error: insertErr.message }
    }
  }
  return { error: 'Could not generate a unique machine code — try again' }
}

// ---------------------------------------------------------------------------
// 5. deleteSiteMachine — sop_machines links go by FK cascade (D-13).
// ---------------------------------------------------------------------------

export async function deleteSiteMachine(machineId: string): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  if (!z.string().uuid().safeParse(machineId).success) return { error: 'Invalid machine id' }

  const { data: deleted, error } = await db
    .from('site_machines')
    .delete()
    .eq('id', machineId)
    .eq('organisation_id', orgId)
    .select('id')
  if (error) {
    console.error('[deleteSiteMachine] delete error', error)
    return { error: error.message }
  }
  if (!deleted || deleted.length === 0) return { error: 'Machine not found' }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 6. setSopMachines — replace semantics, insert-new-then-prune (D-12, T-51-01-E).
//    Used by both the editor panel (51-05) and the builder modal (51-06).
// ---------------------------------------------------------------------------

export async function setSopMachines(
  input: { sopId: string; machineIds: string[] }
): Promise<{ machineIds: string[] } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const parsed = setSopMachinesSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { sopId, machineIds } = parsed.data

  const { data: sopRow, error: sopErr } = await db
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (sopErr) {
    console.error('[setSopMachines] sop lookup error', sopErr)
    return { error: sopErr.message }
  }
  if (!sopRow) return { error: 'SOP not found in your organisation' }

  let validIds: string[] = []
  if (machineIds.length > 0) {
    const { data: machineRows, error: machineErr } = await db
      .from('site_machines')
      .select('id')
      .eq('organisation_id', orgId)
      .in('id', machineIds)
    if (machineErr) {
      console.error('[setSopMachines] machine lookup error', machineErr)
      return { error: machineErr.message }
    }
    validIds = ((machineRows ?? []) as Array<{ id: string }>).map((m) => m.id)
  }

  // Insert the new set BEFORE pruning the old one: a failure between the two
  // calls leaves a superset of links, never a lost link (T-51-01-E).
  if (validIds.length > 0) {
    const rows = validIds.map((machine_id) => ({ sop_id: sopId, machine_id, organisation_id: orgId }))
    const { error: upsertErr } = await db
      .from('sop_machines')
      .upsert(rows, { onConflict: 'sop_id,machine_id', ignoreDuplicates: true })
    if (upsertErr) {
      console.error('[setSopMachines] upsert error', upsertErr)
      return { error: upsertErr.message }
    }
  }

  let pruneQuery = db.from('sop_machines').delete().eq('sop_id', sopId).eq('organisation_id', orgId)
  if (validIds.length > 0) {
    pruneQuery = pruneQuery.not('machine_id', 'in', `(${validIds.join(',')})`)
  }
  const { error: pruneErr } = await pruneQuery
  if (pruneErr) {
    console.error('[setSopMachines] prune error', pruneErr)
    return { error: pruneErr.message }
  }

  return { machineIds: validIds }
}

// ---------------------------------------------------------------------------
// 7. listSopMachines — org machines + departments + this SOP's linked ids.
// ---------------------------------------------------------------------------

export async function listSopMachines(
  sopId: string
): Promise<{ machines: SiteMachine[]; departments: SiteDepartment[]; linkedIds: string[] } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  if (!z.string().uuid().safeParse(sopId).success) return { error: 'Invalid SOP id' }

  const { data: sopRow, error: sopErr } = await db
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (sopErr) {
    console.error('[listSopMachines] sop lookup error', sopErr)
    return { error: sopErr.message }
  }
  if (!sopRow) return { error: 'SOP not found in your organisation' }

  const { data: machineRows, error: machineErr } = await db
    .from('site_machines')
    .select('id, name, department_id, sort')
    .eq('organisation_id', orgId)
    .order('sort', { ascending: true })
    .order('name', { ascending: true })
  if (machineErr) {
    console.error('[listSopMachines] machines error', machineErr)
    return { error: machineErr.message }
  }

  const { data: deptRows, error: deptErr } = await db
    .from('departments')
    .select('id, name, colour')
    .eq('organisation_id', orgId)
    .eq('archived', false)
    .order('name', { ascending: true })
  if (deptErr) {
    console.error('[listSopMachines] departments error', deptErr)
    return { error: deptErr.message }
  }

  const { data: linkRows, error: linkErr } = await db
    .from('sop_machines')
    .select('machine_id')
    .eq('sop_id', sopId)
    .eq('organisation_id', orgId)
  if (linkErr) {
    console.error('[listSopMachines] links error', linkErr)
    return { error: linkErr.message }
  }

  return {
    machines: (machineRows ?? []) as SiteMachine[],
    departments: (deptRows ?? []) as SiteDepartment[],
    linkedIds: ((linkRows ?? []) as Array<{ machine_id: string }>).map((r) => r.machine_id),
  }
}
