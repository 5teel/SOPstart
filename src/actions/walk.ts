'use server'

/**
 * Phase 58 (58-09, FOC-04) -- the walk's server. Every hazard/PPE acknowledgement,
 * step done and photo is written to the worker's in-progress sop_walks row as it
 * happens (D-09, D-15), so a reopened SOP resumes from the server's record.
 *
 * The server is the gate (D-08): the walk belongs to the SESSION worker and org,
 * the step belongs to the walk's SOP, only hazard/PPE steps take an
 * acknowledgement, a photo-required step cannot be done without its photo, and a
 * step ahead of the current one is refused unless the SOP allows forward jumps.
 *
 * No schema takes an organisation, user or role field (CLAUDE.md 2026-09-30,
 * 2026-10-03). sop_walks has no authenticated write policy (00072): every write
 * here goes through the service client and self-enforces the scope with
 * organisation_id + worker_id filters from the session, so nothing a client sends
 * straight to PostgREST can forge a step, ack or photo. Async exports only.
 */
import { z } from 'zod'
import type { Json } from '@/types/database.types'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentIndex, isReachable } from '@/lib/sop/focus'
import { latestPublishedOf, type LineageRow } from '@/lib/sop/lineage-current'
import { loadWalkSop, toWalkState, WALK_COLUMNS, type WalkPhoto, type WalkState } from '@/lib/sop/walk-read'

const uuid = z.string().uuid()
type Fail = { error: string }

const startSchema = z.object({ sopId: uuid })
const recordSchema = z.object({
  walkId: uuid,
  stepId: uuid,
  action: z.enum(['complete', 'photo']),
  photo: z.object({ localId: uuid, storagePath: z.string().min(1).max(300) }).optional(),
})
const startOverSchema = z.object({ walkId: uuid })

async function sessionOrFail() {
  const ctx = await getSessionContext()
  if (!ctx.userId) return { error: 'Not authenticated' } as Fail
  if (!ctx.organisationId) return { error: 'No organisation found' } as Fail
  return { supabase: ctx.supabase, userId: ctx.userId, organisationId: ctx.organisationId }
}

/** Find or insert the worker's in-progress walk on a published SOP of the session org. */
async function openWalk(
  ctx: { supabase: Awaited<ReturnType<typeof getSessionContext>>['supabase']; userId: string; organisationId: string },
  sopId: string
): Promise<{ walk: WalkState } | Fail> {
  const { supabase, userId, organisationId } = ctx
  const { data: sop } = await supabase
    .from('sops')
    .select('id, version, status')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!sop || sop.status !== 'published') return { error: 'This SOP is not available to walk.' }

  const admin = createAdminClient()
  const existing = () =>
    admin
      .from('sop_walks')
      .select(WALK_COLUMNS)
      .eq('organisation_id', organisationId)
      .eq('worker_id', userId)
      .eq('sop_id', sopId)
      .eq('status', 'in_progress')
      .maybeSingle()

  const found = await existing()
  if (found.data) return { walk: toWalkState(found.data) }

  const { data: inserted, error } = await admin
    .from('sop_walks')
    .insert({ organisation_id: organisationId, worker_id: userId, sop_id: sopId, sop_version: sop.version ?? 1 })
    .select(WALK_COLUMNS)
    .single()
  if (inserted) return { walk: toWalkState(inserted) }

  // 23505: another tab won the one-in-progress index; take its row.
  if (error?.code === '23505') {
    const raced = await existing()
    if (raced.data) return { walk: toWalkState(raced.data) }
  }
  console.error('startWalk insert error:', error)
  return { error: 'Could not start the walk. Please try again.' }
}

export async function startWalk(rawInput: unknown): Promise<{ walk: WalkState } | Fail> {
  const parsed = startSchema.safeParse(rawInput)
  if (!parsed.success) return { error: 'Invalid input' }
  const ctx = await sessionOrFail()
  if ('error' in ctx) return ctx
  return openWalk(ctx, parsed.data.sopId)
}

export async function recordWalkStep(rawInput: unknown): Promise<{ walk: WalkState } | Fail> {
  const parsed = recordSchema.safeParse(rawInput)
  if (!parsed.success) return { error: 'Invalid input' }
  const { walkId, stepId, action, photo } = parsed.data
  if (action === 'photo' && !photo) return { error: 'Invalid input' }

  const ctx = await sessionOrFail()
  if ('error' in ctx) return ctx
  const { supabase, userId, organisationId } = ctx
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('sop_walks')
    .select(WALK_COLUMNS)
    .eq('id', walkId)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (!row) return { error: 'Start the walk again.' }
  const walk = toWalkState(row)

  const sop = await loadWalkSop(supabase, organisationId, walk.sop_id)
  const entry = sop?.order.find((e) => e.step.id === stepId)
  if (!sop || !entry) return { error: 'That step is not part of this SOP.' }

  const doneIds = new Set(Object.keys(walk.done))
  if (!isReachable(sop.order, stepId, doneIds, sop.allow_forward_jump)) return { error: 'Finish the steps before this one first.' }

  const now = new Date().toISOString()
  const acks = { ...walk.acks }
  const done = { ...walk.done }
  let photos: WalkPhoto[] = walk.photos

  if (action === 'photo') {
    // Exactly what getPhotoUploadUrl signs for this org and walk (retake replaces).
    const prefix = `${organisationId}/completions/${walkId}/${photo!.localId}`
    const ext = photo!.storagePath === `${prefix}.png` ? 'png' : photo!.storagePath === `${prefix}.jpg` ? 'jpg' : null
    if (!ext) return { error: 'Invalid photo path.' }
    // The object must have landed in the bucket: a path alone proves nothing.
    const file = `${photo!.localId}.${ext}`
    const { data: listed } = await admin.storage.from('completion-photos').list(`${organisationId}/completions/${walkId}`, { search: file })
    if (!(listed ?? []).some((o) => o.name === file)) return { error: 'That photo did not finish uploading.' }
    photos = [
      ...walk.photos.filter((p) => p.stepId !== stepId),
      { localId: photo!.localId, stepId, storagePath: photo!.storagePath, contentType: ext === 'png' ? 'image/png' : 'image/jpeg' },
    ]
  } else if (!done[stepId]) {
    if (entry.step.photo_required && !walk.photos.some((p) => p.stepId === stepId)) return { error: 'Add a photo to continue.' }
    done[stepId] = now
    // Only hazard and PPE steps carry an acknowledgement.
    if (entry.step.kind === 'hazard' || entry.step.kind === 'ppe') acks[stepId] = now
  }

  const next = sop.order[currentIndex(sop.order, new Set(Object.keys(done)))]
  // ponytail: read-modify-write on jsonb; two simultaneous taps could drop one, the worker taps again.
  const { data: saved, error } = await admin
    .from('sop_walks')
    .update({ acks, done, photos: photos as unknown as Json, current_step_id: next?.step.id ?? null, updated_at: now })
    .eq('id', walkId)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
    .eq('status', 'in_progress')
    .select(WALK_COLUMNS)
    .maybeSingle()
  if (error || !saved) {
    console.error('recordWalkStep update error:', error)
    return { error: 'Could not save that step. Please try again.' }
  }
  // A retake replaced the step's photo: the earlier object is unreferenced now (review WR-07).
  // Best effort, after the row is saved; a storage error never fails the step.
  const prev = action === 'photo' ? walk.photos.find((p) => p.stepId === stepId) : undefined
  if (prev && prev.storagePath !== photo!.storagePath && prev.storagePath.startsWith(`${organisationId}/completions/${walkId}/`)) {
    // Awaited: a fire-and-forget promise is cut off when the action returns (sops.ts note).
    const { error: rmErr } = await admin.storage.from('completion-photos').remove([prev.storagePath])
    if (rmErr) console.error('recordWalkStep previous photo remove error:', rmErr)
  }
  return { walk: toWalkState(saved) }
}

export async function startOverWalk(rawInput: unknown): Promise<{ walk: WalkState; sopId: string } | Fail> {
  const parsed = startOverSchema.safeParse(rawInput)
  if (!parsed.success) return { error: 'Invalid input' }
  const ctx = await sessionOrFail()
  if ('error' in ctx) return ctx
  const { supabase, userId, organisationId } = ctx
  const admin = createAdminClient()

  const { data: old } = await admin
    .from('sop_walks')
    .select('id, sop_id')
    .eq('id', parsed.data.walkId)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (!old) return { error: 'Start the walk again.' }

  // The latest published version of this walk's lineage (D-12).
  const { data: source } = await supabase
    .from('sops')
    .select('id, parent_sop_id')
    .eq('id', old.sop_id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!source) return { error: 'This SOP is not available to walk.' }
  const root = source.parent_sop_id ?? source.id
  const { data: family } = await supabase
    .from('sops')
    .select('id, version, parent_sop_id, status')
    .eq('organisation_id', organisationId)
    .or(`id.eq.${root},parent_sop_id.eq.${root}`)
  const latest = latestPublishedOf((family ?? []) as LineageRow[], old.sop_id)
  if (!latest) return { error: 'This SOP is not available to walk.' }

  const { error: abandonError } = await admin
    .from('sop_walks')
    .update({ status: 'abandoned', updated_at: new Date().toISOString() })
    .eq('id', old.id)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
    .eq('status', 'in_progress')
  if (abandonError) {
    console.error('startOverWalk abandon error:', abandonError)
    return { error: 'Could not start over. Please try again.' }
  }

  const fresh = await openWalk(ctx, latest.id)
  return 'error' in fresh ? fresh : { walk: fresh.walk, sopId: latest.id }
}
