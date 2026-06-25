'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import type { Json } from '@/types/database.types'
import {
  SubmitCompletionSchema as submitCompletionSchema,
  SignOffSchema as signOffSchema,
  RecordSignatureSchema as recordSignatureSchema,
} from '@/lib/validators/completions'

// ---------------------------------------------------------------
// submitCompletion
//
// Inserts a completion record into sop_completions using the
// client-generated UUID as the primary key (idempotency key).
// submitted_at is deliberately OMITTED — uses DB DEFAULT now() (COMP-01).
// On conflict (23505 duplicate key): returns success (idempotent retry).
// ---------------------------------------------------------------
export async function submitCompletion(
  rawInput: unknown
): Promise<{ success: true; completionId: string } | { success: false; error: string }> {
  const parsed = submitCompletionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Not authenticated' }

  // Extract organisation_id from JWT custom claims (set by custom_access_token_hook)
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const organisationId: string | null = (jwtClaims['organisation_id'] as string | undefined) ?? null
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()
  const { localId, sopId, sopVersion, contentHash, stepData, photoStoragePaths, stepAckTrace, rosterWorkerId } =
    parsed.data

  // Phase 23 D-11: validate rosterWorkerId belongs to the same org before writing.
  // (RESEARCH Pitfall 4, CLAUDE.md 2026-06-15 — cross-tenant attribution attack surface)
  // Uses the regular session client so RLS org-scope is enforced automatically.
  let resolvedRosterWorkerId: string | null = null
  if (rosterWorkerId) {
    const { data: memberCheck } = await supabase
      .from('organisation_members')
      .select('user_id')
      .eq('user_id', rosterWorkerId)
      .eq('organisation_id', organisationId)
      .single()
    if (!memberCheck) {
      return { success: false, error: 'Roster user not in this organisation.' }
    }
    resolvedRosterWorkerId = rosterWorkerId
  }

  // Insert into sop_completions — client UUID as PK for idempotent retry
  // submitted_at intentionally omitted: DB DEFAULT now() is the authoritative server timestamp
  // step_ack_trace (Phase 15 D-21): append-only evidence of sequential reading.
  // Server treats client-supplied trace as informational — D-20 / threat model
  // T-15-02-01: it's evidence, not a gate.
  // roster_worker_id (Phase 23 D-11): attribution column — worker_id STAYS as user.id (kiosk
  // account uid, the RLS key). roster_worker_id is the floor-identity attribution column only.
  const { error: insertError } = await admin
    .from('sop_completions')
    .insert({
      id: localId,
      organisation_id: organisationId,
      sop_id: sopId,
      worker_id: user.id,              // kiosk account uid (RLS key — DO NOT change)
      roster_worker_id: resolvedRosterWorkerId,  // D-11 attribution (null for non-kiosk)
      sop_version: sopVersion,
      content_hash: contentHash,
      step_data: stepData as Record<string, number>,
      // Cast through unknown: ack-trace is jsonb on the DB side; the
      // generated Json type union doesn't admit typed object arrays
      // directly.
      step_ack_trace: (stepAckTrace ?? []) as unknown as Json,
    })

  if (insertError) {
    // 23505 = unique_violation (duplicate key) — completion already submitted, treat as success
    if (insertError.code === '23505') {
      return { success: true, completionId: localId }
    }
    console.error('submitCompletion insert error:', insertError)
    return { success: false, error: 'Failed to submit completion.' }
  }

  // Insert completion_photos records for each uploaded photo
  if (photoStoragePaths.length > 0) {
    const photoRows = photoStoragePaths.map((p) => ({
      organisation_id: organisationId,
      completion_id: localId,
      step_id: p.stepId,
      storage_path: p.storagePath,
      content_type: p.contentType,
    }))

    const { error: photoError } = await admin
      .from('completion_photos')
      .insert(photoRows)

    if (photoError) {
      console.error('submitCompletion photo insert error:', photoError)
      // Non-fatal: completion record is already inserted; photos can be retried
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

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Not authenticated' }

  // Verify caller is supervisor or safety_manager
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const role: string | undefined = jwtClaims['user_role'] as string | undefined
  const organisationId: string | null = (jwtClaims['organisation_id'] as string | undefined) ?? null

  if (!role || !['supervisor', 'safety_manager'].includes(role)) {
    return { success: false, error: 'Only supervisors and safety managers can sign off completions.' }
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
  // For supervisors: verify the worker is in their supervisor_assignments
  if (role === 'supervisor') {
    const { data: assignment } = await admin
      .from('supervisor_assignments')
      .select('id')
      .eq('supervisor_id', user.id)
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
      supervisor_id: user.id,
      decision,
      reason: reason ?? null,
    })

  if (signOffError) {
    console.error('signOffCompletion insert error:', signOffError)
    return { success: false, error: 'Failed to record sign-off.' }
  }

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
// Path: {orgId}/completions/{completionLocalId}/{localId}.jpg
// Uses admin client to bypass RLS for storage bucket access.
// ---------------------------------------------------------------
export async function getPhotoUploadUrl(input: {
  localId: string
  contentType: string
  orgId: string
  completionLocalId: string
}): Promise<{ url: string; path: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' }

  // Derive orgId from JWT if caller passed empty string (offline client pattern)
  let orgId = input.orgId
  if (!orgId) {
    const { data: { session } } = await supabase.auth.getSession()
    const jwtClaims = session?.access_token
      ? parseJwtPayload(session.access_token)
      : {}
    orgId = (jwtClaims['organisation_id'] as string | undefined) ?? ''
  }
  if (!orgId) return { error: 'No organisation found' }

  // Determine file extension from content type
  const ext = input.contentType === 'image/png' ? 'png' : 'jpg'
  const path = `${orgId}/completions/${input.completionLocalId}/${input.localId}.${ext}`

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
// The roster_user_id must belong to the caller's org (cross-tenant guard, T-23-06-01).
// ---------------------------------------------------------------
export async function recordSignature(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = recordSignatureSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { completionId, role, rosterUserId } = parsed.data

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Not authenticated' }

  // Extract organisation_id from JWT custom claims
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const organisationId: string | null = (jwtClaims['organisation_id'] as string | undefined) ?? null
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

  // Verify rosterUserId belongs to the same org (T-23-06-01 cross-tenant guard)
  const { data: memberCheck } = await admin
    .from('organisation_members')
    .select('user_id')
    .eq('user_id', rosterUserId)
    .eq('organisation_id', organisationId)
    .single()

  if (!memberCheck) {
    return { success: false, error: 'Roster user not in this organisation.' }
  }

  // Insert signature row — service-role, append-only (no UPDATE/DELETE)
  // signed_at is DB DEFAULT now() (not client-supplied — authoritative server timestamp)
  const { error: insertError } = await admin
    .from('sop_completion_signatures')
    .insert({
      organisation_id: organisationId,
      completion_id: completionId,
      role,
      roster_user_id: rosterUserId,
    })

  if (insertError) {
    console.error('recordSignature insert error:', insertError)
    return { success: false, error: 'Failed to record signature.' }
  }

  return { success: true }
}
