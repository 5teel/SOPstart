'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import {
  SubmitCompletionSchema as submitCompletionSchema,
  SignOffSchema as signOffSchema,
  RecordSignatureSchema as recordSignatureSchema,
} from '@/lib/validators/completions'
import { isSignedOffAssessor } from '@/lib/competency/assessor'
import { recordDecision } from '@/lib/decisions/record'

// ---------------------------------------------------------------
// submitCompletion
//
// Inserts a completion record into sop_completions using the
// client-generated UUID as the primary key (idempotency key).
// submitted_at is deliberately OMITTED — uses DB DEFAULT now() (COMP-01).
// On conflict (23505 duplicate key): idempotent retry -- missing photo rows are added, then success.
// ---------------------------------------------------------------
export async function submitCompletion(
  rawInput: unknown
): Promise<{ success: true; completionId: string } | { success: false; error: string }> {
  const parsed = submitCompletionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { userId, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()
  const { localId, sopId, sopVersion, contentHash, stepData, photoStoragePaths, stepAckTrace } = parsed.data

  // Photo paths must be exactly what getPhotoUploadUrl signs for this org and
  // completion: no extra segments, no `..`, a UUID file name and a known extension.
  const photoPrefix = `${organisationId}/completions/${localId}/`
  const validPhotoPath = (p: { localId: string; storagePath: string }) =>
    p.storagePath === `${photoPrefix}${p.localId}.jpg` || p.storagePath === `${photoPrefix}${p.localId}.png`
  if (!photoStoragePaths.every(validPhotoPath)) {
    return { success: false, error: 'Invalid photo path.' }
  }

  // Insert into sop_completions — client UUID as PK for idempotent retry
  // submitted_at intentionally omitted: DB DEFAULT now() is the authoritative server timestamp
  // step_ack_trace (Phase 15 D-21): append-only evidence of sequential reading.
  // Server treats client-supplied trace as informational — D-20 / threat model
  // T-15-02-01: it's evidence, not a gate.
  const { error: insertError } = await admin
    .from('sop_completions')
    .insert({
      id: localId,
      organisation_id: organisationId,
      sop_id: sopId,
      worker_id: userId,               // the signed-in worker (RLS key)
      sop_version: sopVersion,
      content_hash: contentHash,
      step_data: stepData as Record<string, number>,
      // Cast through unknown: ack-trace is jsonb on the DB side; the
      // generated Json type union doesn't admit typed object arrays
      // directly.
      step_ack_trace: (stepAckTrace ?? []) as unknown as Json,
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

  return { success: true, completionId: localId }
}

// ---------------------------------------------------------------
// signOffCompletion
//
// Creates a second immutable completion_sign_offs record (D-17).
// Then updates sop_completions.status via admin client (bypasses RLS).
// On rejection: inserts a worker_notifications record.
// ---------------------------------------------------------------
export async function signOffCompletion(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
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
    .select('id, worker_id, sop_id, organisation_id')
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

  await recordDecision({
    kind: decision === 'approved' ? 'sign_off' : 'reject',
    subject: { kind: 'completion', id: completionId },
    sopId: completion.sop_id,
    summary: decision === 'approved' ? 'Signed off a completion' : 'Rejected a completion',
    details: {
      worker_id: completion.worker_id,
      reason: reason ?? null,
      is_assessor_override: isOverride,
      override_reason: isOverride ? parsed.data.overrideReason : null,
    },
  })

  // UPDATE sop_completions.status via admin client (bypasses RLS — only status field)
  const newStatus = decision === 'approved' ? 'signed_off' : 'rejected'
  const { error: updateError } = await admin
    .from('sop_completions')
    .update({ status: newStatus })
    .eq('id', completionId)
    .eq('organisation_id', organisationId)

  if (updateError) {
    console.error('signOffCompletion status update error:', updateError)
    return { success: false, error: 'Sign-off recorded but status update failed.' }
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

  revalidatePath('/activity')
  return { success: true }
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

  const { userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

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
// recordSignature
//
// Appends a worker or supervisor signature to sop_completion_signatures.
// This table has NO authenticated INSERT policy (append-only, legally
// immutable — migration 00038). MUST use createAdminClient() with
// self-enforced org-scope (CLAUDE.md 2026-06-15, T-23-06-04).
//
// AFL-VER-05: worker self-sign at completion + supervisor counter-sign (D-09/D-10).
// The signer is always the signed-in session user -- never a client-supplied id --
// and a supervisor counter-signature needs a supervisor-or-above session role.
// ---------------------------------------------------------------
export async function recordSignature(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = recordSignatureSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { completionId, role } = parsed.data

  const { userId, role: sessionRole, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (role === 'supervisor' && (!sessionRole || !['supervisor', 'safety_manager', 'admin'].includes(sessionRole))) {
    return { success: false, error: 'Only supervisors, safety managers and admins can counter-sign.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()

  // Verify the completion belongs to the caller's org (org-scope self-enforcement,
  // T-23-06-04 — service-role bypasses RLS so we must check manually)
  const { data: completion, error: fetchError } = await admin
    .from('sop_completions')
    .select('id, organisation_id')
    .eq('id', completionId)
    .single()

  if (fetchError || !completion) {
    return { success: false, error: 'Completion not found.' }
  }
  if (completion.organisation_id !== organisationId) {
    return { success: false, error: 'Completion does not belong to your organisation.' }
  }

  // Insert signature row — service-role, append-only (no UPDATE/DELETE)
  // signed_at is DB DEFAULT now() (not client-supplied — authoritative server timestamp)
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

  await recordDecision({
    kind: role === 'supervisor' ? 'countersign' : 'sign_off',
    subject: { kind: 'completion', id: completionId },
    sopId: null, // not in scope here; the completion id in subject resolves it
    summary: role === 'supervisor' ? 'Counter-signed a completion' : 'Signed their completion',
    details: { role },
  })

  return { success: true }
}
