'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------

const photoStoragePathSchema = z.object({
  localId: z.string().uuid(),
  stepId: z.string().uuid(),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
})

const submitCompletionSchema = z.object({
  localId: z.string().uuid(),
  sopId: z.string().uuid(),
  sopVersion: z.number().int().positive(),
  contentHash: z.string().min(1).max(64),
  stepData: z.record(z.string(), z.number()),
  photoStoragePaths: z.array(photoStoragePathSchema),
})

const signOffSchema = z.object({
  completionId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
})

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
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()
  const { localId, sopId, sopVersion, contentHash, stepData, photoStoragePaths } = parsed.data

  // Insert into sop_completions — client UUID as PK for idempotent retry
  // submitted_at intentionally omitted: DB DEFAULT now() is the authoritative server timestamp
  const { error: insertError } = await admin
    .from('sop_completions')
    .insert({
      id: localId,
      organisation_id: organisationId,
      sop_id: sopId,
      worker_id: user.id,
      sop_version: sopVersion,
      content_hash: contentHash,
      step_data: stepData as Record<string, number>,
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
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string | undefined = jwtClaims['user_role']
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null

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
      ? JSON.parse(atob(session.access_token.split('.')[1]))
      : {}
    orgId = jwtClaims['organisation_id'] ?? ''
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
