'use server'

/**
 * Phase 26 Plan 26-13 (D-03, R5) — persist + bake diagram annotations. Closes
 * the absorbed Phase 17 arc (slice 3).
 *
 *   saveAnnotation — appends a Konva scene (+ natural dims) to sop_image_annotations.
 *   bakeAnnotation — flattens the published diagram to a content-versioned baked
 *                    PNG and records baked_storage_path/baked_at on the scene row.
 *
 * Security (CLAUDE.md 2026-06-15 / 2026-06-26 / 2026-06-27):
 *   - sop_image_annotations has NO authenticated write policy (append-only,
 *     migration 00039) → all writes go through createAdminClient() (service-role).
 *   - Service-role BYPASSES RLS, so BOTH actions self-enforce org-scope: the
 *     caller's org comes from getSessionContext() (locally-verified JWT), the
 *     target sop_image is confirmed to belong to that org (via its sop), and every
 *     write is filtered with `.eq('organisation_id', callerOrg)` — a service-role
 *     write can never touch another org's row (recurring bug family CR-02/WR-05).
 *   - Async-only 'use server': the pure path/version helpers live in
 *     src/lib/builder/baked-path.ts (a sync export here breaks next build).
 */

import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { bakedStoragePath, nextBakedVersion } from '@/lib/builder/baked-path'
import type { Json } from '@/types/database.types'

type SaveResult = { success: true; annotationId: string } | { success: false; error: string }
type BakeResult = { success: true; bakedStoragePath: string } | { success: false; error: string }

/** Caller's org id from the locally-verified session context. */
async function callerOrgId(): Promise<string | null> {
  const { userId, organisationId } = await getSessionContext()
  if (!userId) return null
  return organisationId
}

/**
 * Confirm `sopImageId` belongs to `orgId` (via its SOP) and return the sop_id.
 * sop_images has no organisation_id column, so org membership is checked through
 * the org-scoped sops row — service-role bypasses RLS, so this join IS the gate.
 */
async function imageSopIdForOrg(
  admin: ReturnType<typeof createAdminClient>,
  sopImageId: string,
  orgId: string
): Promise<string | null> {
  const { data: img } = await admin
    .from('sop_images')
    .select('sop_id')
    .eq('id', sopImageId)
    .single()
  if (!img) return null
  const { data: sop } = await admin
    .from('sops')
    .select('id')
    .eq('id', img.sop_id)
    .eq('organisation_id', orgId)
    .single()
  return sop ? img.sop_id : null
}

/**
 * Append a scene for a diagram image. One row per save (non-destructive history);
 * the worker reads the latest baked row.
 */
export async function saveAnnotation(input: {
  sopImageId: string
  scene: Json
  naturalWidth?: number | null
  naturalHeight?: number | null
}): Promise<SaveResult> {
  const orgId = await callerOrgId()
  if (!orgId) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const sopId = await imageSopIdForOrg(admin, input.sopImageId, orgId)
  if (!sopId) return { success: false, error: 'Image not found in your organisation' }

  const { data, error } = await admin
    .from('sop_image_annotations')
    .insert({
      organisation_id: orgId, // self-set from JWT, never client-supplied
      sop_image_id: input.sopImageId,
      scene: input.scene,
      natural_width: input.naturalWidth ?? null,
      natural_height: input.naturalHeight ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to save annotation' }
  return { success: true, annotationId: data.id }
}

/**
 * Bake the flattened PNG (client-rasterised via stage.toDataURL) onto the latest
 * scene row: upload a content-versioned baked PNG (service-role) + record its
 * path/timestamp. The worker then serves that flat <img>, never Konva (R8).
 */
export async function bakeAnnotation(input: {
  sopImageId: string
  dataUrl: string
}): Promise<BakeResult> {
  const orgId = await callerOrgId()
  if (!orgId) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const sopId = await imageSopIdForOrg(admin, input.sopImageId, orgId)
  if (!sopId) return { success: false, error: 'Image not found in your organisation' }

  // Latest scene row for this image (org-scoped) — the bake attaches to it.
  const { data: latest } = await admin
    .from('sop_image_annotations')
    .select('id, baked_storage_path')
    .eq('sop_image_id', input.sopImageId)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return { success: false, error: 'No annotation scene to bake' }

  const version = nextBakedVersion(latest.baked_storage_path)
  const storagePath = bakedStoragePath(sopId, input.sopImageId, version)

  // Decode the client PNG data URL → bytes (Buffer is server-only, safe here).
  const base64 = input.dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const bytes = Buffer.from(base64, 'base64')

  const { error: upErr } = await admin.storage
    .from('sop-images')
    .upload(storagePath, bytes, { contentType: 'image/png', upsert: true })
  if (upErr) return { success: false, error: 'Failed to upload baked image' }

  const { error: updErr } = await admin
    .from('sop_image_annotations')
    .update({ baked_storage_path: storagePath, baked_at: new Date().toISOString() })
    .eq('id', latest.id)
    .eq('organisation_id', orgId) // self-enforced org-scope on the write
  if (updErr) return { success: false, error: 'Failed to record baked path' }

  return { success: true, bakedStoragePath: storagePath }
}
