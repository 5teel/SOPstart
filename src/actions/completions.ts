'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { SignOffSchema as signOffSchema } from '@/lib/validators/completions'
import { isSignedOffAssessor } from '@/lib/competency/assessor'
import { recordDecision } from '@/lib/decisions/record'
import { notify, signOffRecipients } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'
import { userLabels } from '@/lib/members/labels'
import { createHash } from 'node:crypto'
import { hashInput, reviewMissing } from '@/lib/sop/focus'
import { loadWalkSop, toWalkState, WALK_COLUMNS } from '@/lib/sop/walk-read'

// ---------------------------------------------------------------
// submitCompletion -- Send for sign-off
//
// submitCompletion({ walkId }) submits from the server's own sop_walks row (Phase 58, D-10/D-15/D-22):
// nothing the client says about steps, hash or photos is read. The completion id is the
// walk id, which makes the insert its own idempotency key.
// submitted_at is deliberately OMITTED -- the DB DEFAULT now() is the authoritative server timestamp.
// On conflict (23505 duplicate key): idempotent retry -- missing photo rows are added, then success.
// ---------------------------------------------------------------
export async function submitCompletion(
  rawInput: unknown
): Promise<{ success: true; completionId: string } | { success: false; error: string }> {
  const parsed = z.object({ walkId: z.string().uuid() }).strict().safeParse(rawInput)
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const { userId, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('sop_walks')
    .select(WALK_COLUMNS)
    .eq('id', parsed.data.walkId)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
    .maybeSingle()
  if (!row) return { success: false, error: 'Start the SOP again.' }
  const walk = toWalkState(row)
  if (row.status === 'submitted') return { success: true, completionId: walk.id }
  if (row.status !== 'in_progress') return { success: false, error: 'Start the SOP again.' }

  const sop = await loadWalkSop(admin, organisationId, walk.sop_id)
  if (!sop || sop.order.length === 0) return { success: false, error: 'This SOP has no steps to send.' }

  // Whatever the jump-ahead setting: every acknowledgement, required photo and step.
  const missing = [
    ...reviewMissing(sop.order, {
      acked: new Set(Object.keys(walk.acks)),
      photos: new Set(walk.photos.map((p) => p.stepId)),
    }).map((m) => m.text),
    ...sop.order.filter((e) => !walk.done[e.step.id]).map((e) => `finish step ${e.index}`),
  ]
  if (missing.length > 0) {
    return { success: false, error: `${missing.length} ${missing.length === 1 ? 'thing' : 'things'} still to do: ${missing.join(', ')}` }
  }

  // Recomputed here from the walk row, never from the client.
  const localId = walk.id
  const photoStoragePaths = walk.photos
  const stepData: Record<string, number> = {}
  for (const { step } of sop.order) stepData[step.id] = Date.parse(walk.done[step.id])
  const ackTrace = sop.order.flatMap(({ step }) =>
    walk.acks[step.id] ? [{ stepId: step.id, timestamp: Date.parse(walk.acks[step.id]) }] : []
  )

  // Photo paths must be exactly what getPhotoUploadUrl signs for this org and
  // walk: no extra segments, no `..`, a UUID file name and a known extension.
  const photoPrefix = `${organisationId}/completions/${localId}/`
  const validPhotoPath = (p: { localId: string; storagePath: string }) =>
    p.storagePath === `${photoPrefix}${p.localId}.jpg` || p.storagePath === `${photoPrefix}${p.localId}.png`
  if (!photoStoragePaths.every(validPhotoPath)) {
    return { success: false, error: 'Invalid photo path.' }
  }

  const { error: insertError } = await admin
    .from('sop_completions')
    .insert({
      id: localId,
      organisation_id: organisationId,
      sop_id: walk.sop_id,
      worker_id: userId,               // the signed-in worker (RLS key)
      sop_version: walk.sop_version,
      content_hash: createHash('sha256').update(hashInput(sop.order)).digest('hex'),
      step_data: stepData,
      // jsonb on the DB side; the generated Json union does not admit typed object arrays.
      step_ack_trace: ackTrace as unknown as Json,
    })

  // 23505 = unique_violation: the completion row was already written by an
  // earlier attempt. Fall through so a retry can still add the photo rows that
  // attempt failed to save.
  const isRetry = insertError?.code === '23505'
  if (insertError && !isRetry) {
    console.error('submitCompletion insert error:', insertError)
    return { success: false, error: 'Failed to submit completion.' }
  }

  // Insert completion_photos records for each uploaded photo
  if (photoStoragePaths.length > 0) {
    let toInsert = photoStoragePaths
    if (isRetry) {
      // Only the worker who wrote the completion may attach photos to it, and
      // rows an earlier attempt did save are not duplicated.
      const { data: existing } = await admin
        .from('sop_completions')
        .select('worker_id, organisation_id')
        .eq('id', localId)
        .single()
      if (!existing || existing.worker_id !== userId || existing.organisation_id !== organisationId) {
        return { success: false, error: 'Failed to submit completion.' }
      }
      const { data: saved } = await admin
        .from('completion_photos')
        .select('storage_path')
        .eq('completion_id', localId)
        .eq('organisation_id', organisationId)
      const have = new Set((saved ?? []).map((r) => r.storage_path))
      toInsert = photoStoragePaths.filter((p) => !have.has(p.storagePath))
    }

    if (toInsert.length > 0) {
      const { error: photoError } = await admin.from('completion_photos').insert(
        toInsert.map((p) => ({
          organisation_id: organisationId,
          completion_id: localId,
          step_id: p.stepId,
          storage_path: p.storagePath,
          content_type: p.contentType,
        }))
      )
      if (photoError) {
        // The client keeps the walk open and resubmits; the retry saves the missing rows.
        console.error('submitCompletion photo insert error:', photoError)
        return { success: false, error: 'Photos could not be saved. Please try again.' }
      }
    }
  }

  const { error: walkError } = await admin
    .from('sop_walks')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', walk.id)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
  if (walkError) {
    // The completion exists; a retry finds it (23505 path) and finishes the walk.
    console.error('submitCompletion walk update error:', walkError)
    return { success: false, error: 'Failed to submit completion.' }
  }

  // The worker's own ledger row (D-22). Its failure never undoes the completion.
  const signed = await recordSignature({ completionId: walk.id, sopId: walk.sop_id, role: 'worker' })
  if (!signed.success) console.error('submitCompletion signature error:', signed.error)

  // D-08: tell whoever signs this off. After the ledger row; never fails the submit.
  try {
    const recipients = await signOffRecipients(organisationId, userId)
    if (recipients.length > 0) {
      const [labels, { data: sopRow }] = await Promise.all([
        userLabels([userId]),
        admin.from('sops').select('title').eq('id', walk.sop_id).eq('organisation_id', organisationId).maybeSingle(),
      ])
      const title = notificationTitle({ kind: 'signoff', sop: sopRow?.title ?? 'a SOP', name: labels.get(userId)?.fullName ?? null })
      const place = notificationPlace('signoff')
      const key = dedupeKey({ kind: 'signoff', completionId: walk.id })
      await notify(
        organisationId,
        recipients.map((uid) => ({ userId: uid, kind: 'signoff' as const, title, place, subjectType: 'sop', subjectId: walk.sop_id, dedupeKey: key })),
      )
    }
  } catch (err) {
    console.error('submitCompletion sign-off notification failed:', err)
  }
  return { success: true, completionId: walk.id }
}

// ---------------------------------------------------------------
// signOffCompletion
//
// Claims sop_completions.status via admin client (bypasses RLS; conditional on
// the walk still being pending), then creates the immutable completion_sign_offs
// record (D-17). On rejection: inserts a worker_notifications record.
// ---------------------------------------------------------------
export async function signOffCompletion(
  rawInput: unknown
): Promise<{ success: true; logged: boolean } | { success: false; error: string }> {
  const parsed = signOffSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { completionId, decision, reason } = parsed.data

  // Validate rejection reason (must be non-empty if rejecting)
  if (decision === 'rejected') {
    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Rejection reason must be at least 10 characters.' }
    }
  }

  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Verify caller is supervisor, safety_manager or admin. Phase 37 D-06:
  // admin is a peer of safety_manager on every other governance surface —
  // widening this array is what makes the override path below reachable at
  // all (37-RESEARCH Pitfall 2 — admin was previously hard-excluded here).
  if (!role || !['supervisor', 'safety_manager', 'admin'].includes(role)) {
    return { success: false, error: 'Only supervisors, safety managers and admins can sign off completions.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()

  // Fetch the completion to get worker_id and sop_id
  const { data: completion, error: fetchError } = await admin
    .from('sop_completions')
    .select('id, worker_id, sop_id, organisation_id, status')
    .eq('id', completionId)
    .single()

  if (fetchError || !completion) {
    return { success: false, error: 'Completion record not found.' }
  }

  // Org-scope guard — must run before the role branch so safety_manager cannot
  // sign off completions from another org. Admin client bypasses RLS, so we
  // self-enforce here (CLAUDE.md 2026-06-15 pattern, CR-04 fix).
  if (completion.organisation_id !== organisationId) {
    return { success: false, error: 'Completion record not found.' }
  }

  // Nobody signs off their own walk (59 A-03), and a walk already decided is not
  // decided twice -- a double submit must not write a second sign-off or ledger row.
  if (completion.worker_id === userId) {
    return { success: false, error: 'You cannot sign off your own completion' }
  }
  if (completion.status !== 'pending_sign_off') {
    return { success: false, error: 'This completion has already been decided.' }
  }

  // ASR-01 gate (D-03) — the completion sign-off is the strongest
  // competence-advancing record, so it is gated identically to
  // recordObservation's performed_to_sop branch. Only 'approved' is gated
  // (branch-before-gate) — rejecting is never competence-advancing and must
  // stay reachable regardless of assessor status.
  let isOverride = false
  if (decision === 'approved') {
    // Admin client for the PREDICATE READ ONLY (mirrors observations.ts):
    // isSignedOffAssessor reads sop_completions/completion_sign_offs/
    // sop_observations on the caller's own behalf, and RLS does not
    // reliably return a supervisor's own rows about OTHER workers — a
    // session-client read would falsely deny a legitimate assessor. The
    // predicate self-enforces org scope; organisationId is session-derived.
    const assessor = await isSignedOffAssessor(userId, completion.sop_id, admin, organisationId)
    if (!assessor) {
      if (role === 'admin' || role === 'safety_manager') {
        if (!parsed.data.overrideReason || parsed.data.overrideReason.trim().length < 10) {
          return { success: false, error: 'ASSESSOR_OVERRIDE_REQUIRED' }
        }
        isOverride = true
      } else {
        return { success: false, error: 'NOT_SIGNED_OFF_ASSESSOR' }
      }
    }
  }

  // For supervisors: verify the worker is in their supervisor_assignments
  if (role === 'supervisor') {
    const { data: assignment } = await admin
      .from('supervisor_assignments')
      .select('id')
      .eq('supervisor_id', userId)
      .eq('worker_id', completion.worker_id)
      .eq('organisation_id', organisationId)
      .single()

    if (!assignment) {
      return { success: false, error: 'You are not assigned to supervise this worker.' }
    }
  }

  // Claim the walk first (59 review WR-01): the status read above is only a fast
  // path, so two in-flight submits could both pass it. The conditional update is
  // the real guard -- whichever request flips the status writes the records, the
  // other sees zero rows and stops before any sign-off or ledger row.
  const newStatus = decision === 'approved' ? 'signed_off' : 'rejected'
  const { data: claimed, error: updateError } = await admin
    .from('sop_completions')
    .update({ status: newStatus })
    .eq('id', completionId)
    .eq('organisation_id', organisationId)
    .eq('status', 'pending_sign_off')
    .select('id')

  if (updateError) {
    console.error('signOffCompletion status update error:', updateError)
    return { success: false, error: 'Failed to record sign-off.' }
  }
  if (!claimed?.length) {
    return { success: false, error: 'This completion has already been decided.' }
  }

  // INSERT into completion_sign_offs (second immutable record, D-17)
  const { error: signOffError } = await admin
    .from('completion_sign_offs')
    .insert({
      organisation_id: organisationId,
      completion_id: completionId,
      supervisor_id: userId,
      decision,
      reason: reason ?? null,
      is_assessor_override: isOverride,
      override_reason: isOverride ? parsed.data.overrideReason : null,
    })

  if (signOffError) {
    console.error('signOffCompletion insert error:', signOffError)
    return { success: false, error: 'Failed to record sign-off.' }
  }

  // One ledger row per decision (59 review WR-02): a rejection is logged here; an
  // approval is logged by its counter-signature below (kind countersign, the row
  // the inbox counts as cleared). The worker's own sign_off row is written on submit.
  const details = {
    worker_id: completion.worker_id,
    reason: reason ?? null,
    is_assessor_override: isOverride,
    override_reason: isOverride ? parsed.data.overrideReason : null,
  }
  let logged = false
  if (decision === 'rejected') {
    const rec = await recordDecision({
      kind: 'reject',
      subject: { kind: 'completion', id: completionId },
      sopId: completion.sop_id,
      summary: 'Rejected a completion',
      details,
    })
    logged = rec.ok
  }

  // The supervisor counter-signature is written here, after the status change, so no
  // client can skip it (59 F-04). Its failure never undoes the sign-off.
  if (decision === 'approved') {
    const countersigned = await recordSignature({ completionId, sopId: completion.sop_id, role: 'supervisor', details })
    if (!countersigned.success) console.error('signOffCompletion counter-signature error:', countersigned.error)
    logged = countersigned.success && countersigned.logged
  }

  // On rejection: notify the worker
  if (decision === 'rejected') {
    const { error: notifyError } = await admin
      .from('worker_notifications')
      .insert({
        organisation_id: organisationId,
        user_id: completion.worker_id,
        sop_id: completion.sop_id,
        type: 'completion_rejected',
        read: false,
      })

    if (notifyError) {
      console.error('signOffCompletion notification error:', notifyError)
      // Non-fatal: sign-off is already recorded
    }
  }

  revalidatePath('/')
  return { success: true, logged }
}

// ---------------------------------------------------------------
// getPhotoUploadUrl
//
// Generates a presigned upload URL for a completion photo.
// Path: {session org}/completions/{completionLocalId}/{localId}.jpg
// The org comes from the session only, and both ids must be UUIDs so a
// crafted id cannot add path segments or point at another org's folder.
// Uses admin client to bypass RLS for storage bucket access.
// ---------------------------------------------------------------
export async function getPhotoUploadUrl(input: {
  localId: string
  contentType: string
  completionLocalId: string
}): Promise<{ url: string; path: string } | { error: string }> {
  const parsed = z
    .object({
      localId: z.string().uuid(),
      contentType: z.string(),
      completionLocalId: z.string().uuid(),
    })
    .safeParse(input)
  if (!parsed.success) return { error: 'Invalid upload request.' }

  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  // Only the session worker's own in-progress walk may take a photo upload URL.
  const { data: walk } = await supabase
    .from('sop_walks')
    .select('id')
    .eq('id', parsed.data.completionLocalId)
    .eq('organisation_id', organisationId)
    .eq('worker_id', userId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (!walk) return { error: 'Start the SOP again.' }

  // Determine file extension from content type
  const ext = parsed.data.contentType === 'image/png' ? 'png' : 'jpg'
  const path = `${organisationId}/completions/${parsed.data.completionLocalId}/${parsed.data.localId}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('completion-photos')
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('getPhotoUploadUrl error:', error)
    return { error: 'Failed to generate upload URL.' }
  }

  return { url: data.signedUrl, path }
}

// ---------------------------------------------------------------
// recordSignature -- internal helper, deliberately NOT exported (59 review CR-01):
// an exported function in this file is a POST endpoint for every org member,
// and this one writes an immutable signature row plus a ledger row.
//
// Appends a worker or supervisor signature to sop_completion_signatures.
// This table has NO authenticated INSERT policy (append-only, legally
// immutable — migration 00038), so the write is service-role.
//
// AFL-VER-05: worker self-sign at completion + supervisor counter-sign (D-09/D-10).
// Its only callers are submitCompletion (role worker, the caller's own walk) and
// signOffCompletion (role supervisor, after the status change); both have already
// checked the session role, the org and the completion. The signer is always the
// signed-in session user.
// ---------------------------------------------------------------
async function recordSignature(input: {
  completionId: string
  sopId: string
  role: 'worker' | 'supervisor'
  details?: Record<string, unknown>
}): Promise<{ success: true; logged: boolean } | { success: false; error: string }> {
  const { completionId, sopId, role, details } = input
  const { userId, organisationId } = await getSessionContext()
  if (!userId || !organisationId) return { success: false, error: 'Not authenticated' }

  // Insert signature row — service-role, append-only (no UPDATE/DELETE)
  // signed_at is DB DEFAULT now() (not client-supplied — authoritative server timestamp)
  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from('sop_completion_signatures')
    .insert({
      organisation_id: organisationId,
      completion_id: completionId,
      role,
      roster_user_id: userId,
    })

  if (insertError) {
    console.error('recordSignature insert error:', insertError)
    return { success: false, error: 'Failed to record signature.' }
  }

  // The one ledger row for this signature (59 review WR-02): the worker's submit is
  // sign_off ("Sent for sign-off"), the supervisor's approval is countersign ("Signed off").
  const rec = await recordDecision({
    kind: role === 'supervisor' ? 'countersign' : 'sign_off',
    subject: { kind: 'completion', id: completionId },
    sopId,
    summary: role === 'supervisor' ? 'Signed off a completion' : 'Sent a SOP for sign-off',
    details: { role, ...details },
  })

  return { success: true, logged: rec.ok }
}
