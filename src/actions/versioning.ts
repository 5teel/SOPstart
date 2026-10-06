'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionContext } from '@/lib/auth/session-context'
import { getSourceFileType, isBlockedMacroFile } from '@/lib/validators/sop'
import { notify } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'

// ------------------------------------------------------------
// uploadNewVersion
// Creates a new SOP record as the next version of an existing SOP,
// updates the old record's superseded_by FK, and returns upload session details.
//
// D-05/D-06: routes video sources through the same transcription pipeline
// createVideoUploadSession uses, instead of the document parser — the
// `isVideo` discriminator on the return value tells the caller which upload
// routine to run (createVideoUploadSession/startVideoSopUpload for video,
// the presigned PUT + /api/sops/parse pair for everything else).
// ------------------------------------------------------------
export async function uploadNewVersion(
  oldSopId: string,
  file: { name: string; size: number; type: string }
): Promise<
  | { success: true; newSopId: string; uploadUrl: string; token?: string; path: string; isVideo: boolean }
  | { success: false; error: string }
> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Verify admin/safety_manager role
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to upload SOP versions.' }
  }

  // Reject macro-enabled Office files before any row is created (T-40-07-01 —
  // this guard was previously absent from uploadNewVersion, mirroring
  // createUploadSession).
  if (isBlockedMacroFile(file.name)) {
    return { success: false, error: `${file.name} is not supported — macro-enabled Office files are blocked for security. Save as .xlsx or .pptx and try again.` }
  }

  // Fetch old SOP record
  const { data: oldSop, error: fetchError } = await supabase
    .from('sops')
    .select('id, version, parent_sop_id, organisation_id, source_file_type, refresher_interval_months, category_slug')
    .eq('id', oldSopId)
    .single()

  if (fetchError || !oldSop) {
    return { success: false, error: 'SOP not found' }
  }

  // WR-07: assert the caller's org matches the SOP, mirroring cloneSopAsDraft.
  // The session-client SOP fetch uses RLS as a first gate, but the admin client below
  // bypasses RLS — explicit org assertion is the self-enforcing defence-in-depth.
  if (!organisationId || oldSop.organisation_id !== organisationId) {
    return { success: false, error: 'Access denied: SOP belongs to a different organisation.' }
  }
  // All versions of the same SOP share the same parent_sop_id (the first version's id)
  const newParentId: string = (oldSop.parent_sop_id as string | null) ?? oldSop.id
  const newVersion: number = oldSop.version + 1

  // Determine file type (T-40-07-03 — throws on unknown rather than silently
  // defaulting to 'docx', matching createUploadSession's precedent).
  let fileType: ReturnType<typeof getSourceFileType>
  try {
    fileType = getSourceFileType(file.type)
  } catch {
    return { success: false, error: 'Unsupported file type: ' + file.type }
  }
  const isVideo = fileType === 'video'

  const admin = createAdminClient()

  // Create new SOP record
  const { data: newSop, error: insertError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      source_file_name: file.name,
      source_file_type: fileType,
      source_file_path: '',
      uploaded_by: userId,
      status: 'uploading' as const,
      version: newVersion,
      parent_sop_id: newParentId,
      // Phase 36 / REF-01: the refresher interval is the worker's re-walkthrough
      // clock and must survive supersede (D-01) — this insert is an explicit
      // field list, so any future per-SOP column must be added here too.
      refresher_interval_months: oldSop.refresher_interval_months ?? null,
      // Phase 40 / DAT-01: a new version keeps the old version's category.
      category_slug: oldSop.category_slug ?? null,
    })
    .select('id')
    .single()

  if (insertError || !newSop) {
    console.error('New SOP version creation error:', insertError)
    return { success: false, error: 'Failed to create new version record.' }
  }

  if (isVideo) {
    // Video branch (D-06): storage path + bucket + parse_jobs shape mirror
    // createVideoUploadSession exactly, so the same transcription pipeline
    // picks this job up.
    const ext = file.name.split('.').pop() || 'mp4'
    const path = `${organisationId}/${newSop.id}/audio/audio.${ext}`

    await admin.from('sops').update({ source_file_path: path }).eq('id', newSop.id)

    const { error: jobError } = await admin.from('parse_jobs').insert({
      organisation_id: organisationId,
      sop_id: newSop.id,
      file_path: path,
      file_type: 'video',
      input_type: 'video_file',
      current_stage: 'uploading',
      status: 'queued',
    })

    if (jobError) {
      console.error('Parse job creation error:', jobError)
      await admin.from('sops').delete().eq('id', newSop.id)
      return { success: false, error: 'Failed to create upload session. Please try again.' }
    }

    // Mark old SOP as superseded by new SOP
    await admin.from('sops').update({ superseded_by: newSop.id }).eq('id', oldSopId)

    // TUS uploads authenticate with the caller's own session access token
    // (resolved client-side in startVideoSopUpload), not a presigned PUT URL.
    return {
      success: true,
      newSopId: newSop.id,
      uploadUrl: '',
      path,
      isVideo: true,
    }
  }

  const path = `${organisationId}/${newSop.id}/original/${file.name}`

  // Create presigned upload URL
  const { data: signedData, error: signError } = await admin.storage
    .from('sop-documents')
    .createSignedUploadUrl(path)

  if (signError || !signedData) {
    console.error('Presigned URL error:', signError)
    return { success: false, error: 'Failed to create upload URL.' }
  }

  // Update new SOP with storage path
  await admin.from('sops').update({ source_file_path: path }).eq('id', newSop.id)

  // Create parse job for new version
  await admin.from('parse_jobs').insert({
    organisation_id: organisationId,
    sop_id: newSop.id,
    file_path: path,
    file_type: fileType,
    status: 'queued',
  })

  // Mark old SOP as superseded by new SOP
  await admin
    .from('sops')
    .update({ superseded_by: newSop.id })
    .eq('id', oldSopId)

  return {
    success: true,
    newSopId: newSop.id,
    uploadUrl: signedData.signedUrl,
    token: signedData.token,
    path,
    isVideo: false,
  }
}

// ------------------------------------------------------------
// notifyAssignedWorkers
// Finds all workers assigned to the old SOP and inserts notification
// records pointing to the new SOP. Also updates sop_assignments to
// reference the new SOP so workers see the latest version.
// ------------------------------------------------------------
export async function notifyAssignedWorkers(
  oldSopId: string,
  newSopId: string
): Promise<{ success: true; notified: number } | { success: false; error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to notify workers.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  // The new SOP must be in the caller's own organisation (never an org read off the row).
  const { data: newSop } = await supabase
    .from('sops')
    .select('title, version')
    .eq('id', newSopId)
    .eq('organisation_id', organisationId)
    .single()

  if (!newSop) return { success: false, error: 'New SOP not found' }

  // Get all assignments for old SOP
  const { data: assignments } = await supabase
    .from('sop_assignments')
    .select('assignment_type, role, user_id')
    .eq('sop_id', oldSopId)

  if (!assignments || assignments.length === 0) {
    return { success: true, notified: 0 }
  }

  const admin = createAdminClient()
  const userIdSet = new Set<string>()

  for (const assignment of assignments) {
    if (assignment.assignment_type === 'individual' && assignment.user_id) {
      userIdSet.add(assignment.user_id)
    } else if (assignment.assignment_type === 'role' && assignment.role) {
      // Find users with this role in the org
      const { data: members } = await admin
        .from('organisation_members')
        .select('user_id')
        .eq('organisation_id', organisationId)
        .eq('role', assignment.role)

      if (members) {
        for (const member of members) {
          userIdSet.add(member.user_id)
        }
      }
    }
  }

  // the publishing admin is never told of their own publish (every trigger drops the actor)
  const userIds = Array.from(userIdSet).filter((id) => id !== userId)

  // D-08 / A-02: the new version reaches everyone who does this SOP through the
  // notifications table. Fail-soft: the assignment repoint below always runs.
  if (userIds.length > 0) {
    const title = notificationTitle({ kind: 'new_version', sop: newSop.title ?? 'a SOP', version: newSop.version })
    const place = notificationPlace('new_version', { sopId: newSopId })
    const key = dedupeKey({ kind: 'new_version', sopId: newSopId })
    await notify(
      organisationId,
      userIds.map((uid) => ({ userId: uid, kind: 'new_version' as const, title, place, subjectType: 'sop', subjectId: newSopId, dedupeKey: key })),
    )
  }

  // Update sop_assignments to point to new SOP
  // Service-role write: the session org is enforced here, not left to the RLS read above.
  await admin
    .from('sop_assignments')
    .update({ sop_id: newSopId })
    .eq('sop_id', oldSopId)
    .eq('organisation_id', organisationId)

  return { success: true, notified: userIds.length }
}

// ------------------------------------------------------------
// markNotificationRead
// Marks a single notification as read for the authenticated user.
// ------------------------------------------------------------
export async function markNotificationRead(
  notificationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, userId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('worker_notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('Mark read error:', error)
    return { success: false, error: 'Failed to mark notification as read.' }
  }

  return { success: true }
}
