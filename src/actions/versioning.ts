'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ------------------------------------------------------------
// uploadNewVersion
// Creates a new SOP record as the next version of an existing SOP,
// updates the old record's superseded_by FK, and returns upload session details.
// ------------------------------------------------------------
export async function uploadNewVersion(
  oldSopId: string,
  file: { name: string; size: number; type: string }
): Promise<
  | { success: true; newSopId: string; uploadUrl: string; token: string; path: string }
  | { success: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Verify admin/safety_manager role
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string | undefined = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to upload SOP versions.' }
  }

  // Fetch old SOP record
  const { data: oldSop, error: fetchError } = await supabase
    .from('sops')
    .select('id, version, parent_sop_id, organisation_id, source_file_type')
    .eq('id', oldSopId)
    .single()

  if (fetchError || !oldSop) {
    return { success: false, error: 'SOP not found' }
  }

  const organisationId: string = oldSop.organisation_id
  // All versions of the same SOP share the same parent_sop_id (the first version's id)
  const newParentId: string = (oldSop.parent_sop_id as string | null) ?? oldSop.id
  const newVersion: number = oldSop.version + 1

  // Determine file type
  const extensionMap: Record<string, 'docx' | 'pdf' | 'image'> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'docx',
    'application/pdf': 'pdf',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
  }
  const fileType: 'docx' | 'pdf' | 'image' = extensionMap[file.type] ?? 'docx'

  const admin = createAdminClient()

  // Create new SOP record
  const { data: newSop, error: insertError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      source_file_name: file.name,
      source_file_type: fileType,
      source_file_path: '',
      uploaded_by: user.id,
      status: 'uploading' as const,
      version: newVersion,
      parent_sop_id: newParentId,
    })
    .select('id')
    .single()

  if (insertError || !newSop) {
    console.error('New SOP version creation error:', insertError)
    return { success: false, error: 'Failed to create new version record.' }
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string | undefined = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to notify workers.' }
  }

  // Fetch new SOP to get organisation_id
  const { data: newSop } = await supabase
    .from('sops')
    .select('organisation_id')
    .eq('id', newSopId)
    .single()

  if (!newSop) return { success: false, error: 'New SOP not found' }

  const organisationId: string = newSop.organisation_id

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

  const userIds = Array.from(userIdSet)

  if (userIds.length > 0) {
    const notificationRows = userIds.map(uid => ({
      organisation_id: organisationId,
      user_id: uid,
      sop_id: newSopId,
      type: 'sop_updated',
      read: false,
    }))

    const { error: notifyError } = await admin
      .from('worker_notifications')
      .insert(notificationRows)

    if (notifyError) {
      console.error('Notification insert error:', notifyError)
      return { success: false, error: 'Failed to create notifications.' }
    }
  }

  // Update sop_assignments to point to new SOP
  await admin
    .from('sop_assignments')
    .update({ sop_id: newSopId })
    .eq('sop_id', oldSopId)

  return { success: true, notified: userIds.length }
}

// ------------------------------------------------------------
// getVersionHistory
// Returns all versions of an SOP lineage, ordered newest first.
// ------------------------------------------------------------
export async function getVersionHistory(
  sopId: string
): Promise<
  | { success: true; versions: VersionRecord[] }
  | { success: false; error: string }
> {
  const supabase = await createClient()

  // Get the SOP to find parent_sop_id
  const { data: sop, error: fetchError } = await supabase
    .from('sops')
    .select('id, parent_sop_id, title, source_file_name')
    .eq('id', sopId)
    .single()

  if (fetchError || !sop) {
    return { success: false, error: 'SOP not found' }
  }

  // The parent for this lineage: if current SOP has a parent_sop_id use that,
  // otherwise this SOP is the original and is its own parent.
  const parentId: string = (sop.parent_sop_id as string | null) ?? sop.id

  // Query all SOPs in the lineage
  const { data: versions, error: versionsError } = await supabase
    .from('sops')
    .select('id, version, status, uploaded_by, created_at, superseded_by, title, source_file_name, parent_sop_id')
    .or(`parent_sop_id.eq.${parentId},id.eq.${parentId}`)
    .order('version', { ascending: false })

  if (versionsError) {
    console.error('Version history error:', versionsError)
    return { success: false, error: 'Failed to load version history.' }
  }

  return { success: true, versions: (versions ?? []) as VersionRecord[] }
}

export interface VersionRecord {
  id: string
  version: number
  status: string
  uploaded_by: string
  created_at: string
  superseded_by: string | null
  title: string | null
  source_file_name: string
  parent_sop_id: string | null
}

// ------------------------------------------------------------
// markNotificationRead
// Marks a single notification as read for the authenticated user.
// ------------------------------------------------------------
export async function markNotificationRead(
  notificationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

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
