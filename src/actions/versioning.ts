'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionContext } from '@/lib/auth/session-context'
import { computeNextVersionLineage } from '@/lib/builder/version-lineage'

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
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Verify admin/safety_manager role
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

  // WR-07: assert the caller's org matches the SOP, mirroring cloneSopAsDraft.
  // The session-client SOP fetch uses RLS as a first gate, but the admin client below
  // bypasses RLS — explicit org assertion is the self-enforcing defence-in-depth.
  if (!organisationId || oldSop.organisation_id !== organisationId) {
    return { success: false, error: 'Access denied: SOP belongs to a different organisation.' }
  }
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
      uploaded_by: userId,
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
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

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

// computeNextVersionLineage is a pure sync helper — it lives in
// '@/lib/builder/version-lineage' because every export of this 'use server'
// module must be an async function (Next.js server-action constraint).

// ------------------------------------------------------------
// cloneSopAsDraft (AFL-VER-01 / D-05)
// Deep-copies a published SOP's sections, steps, block junctions, and images
// into a new draft SOP that continues the version lineage.
//
// The status sentinel pattern keeps the DB consistent:
//   1. Insert new SOP row with status='uploading' (sentinel).
//   2. Batch-copy sop_sections → sop_steps → sop_section_blocks → sop_images.
//   3. On ANY failure: delete the partial draft (CASCADE removes children).
//   4. On full success: update status to 'draft'.
//
// Publishing the cloned draft supersedes the prior version via the EXISTING
// publish path. This function NEVER sets superseded_by on the source SOP.
// Org-scope is self-enforced (CLAUDE.md 2026-06-15 pattern).
// ------------------------------------------------------------
export async function cloneSopAsDraft(
  publishedSopId: string
): Promise<{ success: true; newDraftId: string } | { success: false; error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Role guard — same gate as uploadNewVersion
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to clone SOP versions.' }
  }

  // Fetch source SOP — use RLS-scoped client to verify org ownership
  const { data: sourceSop, error: fetchError } = await supabase
    .from('sops')
    .select('id, version, parent_sop_id, organisation_id, title, source_file_name, source_file_type, source_file_path')
    .eq('id', publishedSopId)
    .single()

  if (fetchError || !sourceSop) {
    return { success: false, error: 'SOP not found or access denied.' }
  }

  // Self-enforce org-scope (CLAUDE.md 2026-06-15): verify source belongs to caller's org
  if (!organisationId || sourceSop.organisation_id !== organisationId) {
    return { success: false, error: 'Access denied: SOP belongs to a different organisation.' }
  }

  const { newVersion, newParentId } = computeNextVersionLineage(sourceSop as { id: string; version: number; parent_sop_id: string | null })
  const admin = createAdminClient()

  // Step 1: Insert new SOP row with status sentinel 'uploading'
  const { data: newSop, error: insertError } = await admin
    .from('sops')
    .insert({
      organisation_id: sourceSop.organisation_id,
      title: sourceSop.title,
      source_file_name: sourceSop.source_file_name,
      source_file_type: sourceSop.source_file_type,
      source_file_path: sourceSop.source_file_path,
      uploaded_by: userId,
      status: 'uploading' as const,
      version: newVersion,
      parent_sop_id: newParentId,
    })
    .select('id')
    .single()

  if (insertError || !newSop) {
    console.error('cloneSopAsDraft: new SOP insert error:', insertError)
    return { success: false, error: 'Failed to create new draft SOP.' }
  }

  const newSopId = newSop.id

  try {
    // Step 2a: Fetch source sections
    // Column names per database.types.ts: confidence (not confidence_score), no sub_heading, no show_media_side_by_side
    const { data: sourceSections, error: sectionsError } = await admin
      .from('sop_sections')
      .select('id, section_kind_id, sort_order, layout_data, layout_version, title, content, section_type, confidence, approved')
      .eq('sop_id', publishedSopId)
      .order('sort_order', { ascending: true })

    if (sectionsError) throw new Error(`Failed to fetch source sections: ${sectionsError.message}`)

    const sections = sourceSections ?? []
    // Map old section id → new section id (for steps and block junctions)
    const sectionIdMap = new Map<string, string>()

    if (sections.length > 0) {
      // Step 2b: Batch-insert sections (without old id; DB generates new ids)
      const sectionRows = sections.map(sec => ({
        sop_id: newSopId,
        section_kind_id: sec.section_kind_id,
        sort_order: sec.sort_order,
        layout_data: sec.layout_data,
        layout_version: sec.layout_version,
        title: sec.title,
        content: sec.content,
        section_type: sec.section_type,
        confidence: sec.confidence,
        approved: sec.approved,
      }))

      const { data: newSections, error: secInsertError } = await admin
        .from('sop_sections')
        .insert(sectionRows)
        .select('id, sort_order')

      if (secInsertError || !newSections) {
        throw new Error(`Failed to copy sections: ${secInsertError?.message ?? 'no data'}`)
      }

      // Build sectionIdMap by array index: sections[] and newSections[] are both ordered
      // sort_order ASC (sections fetched with .order), and RETURNING preserves insert order.
      // Matching by sort_order is incorrect when two sections share a sort_order (no UNIQUE
      // constraint) — index matching is always unambiguous (WR-02 fix).
      sections.forEach((oldSec, idx) => {
        const newSec = newSections[idx]
        if (newSec) {
          sectionIdMap.set(oldSec.id, newSec.id)
        }
      })

      // Step 2c: Copy sop_steps for each section
      // Column names per database.types.ts: section_id (not sop_section_id), step_number (not sort_order), required_tools (not tools)
      const { data: sourceSteps, error: stepsError } = await admin
        .from('sop_steps')
        .select('id, section_id, step_number, text, warning, caution, tip, required_tools, time_estimate_minutes, photo_required')
        .in('section_id', sections.map(s => s.id))
        .order('step_number', { ascending: true })

      if (stepsError) throw new Error(`Failed to fetch source steps: ${stepsError.message}`)

      const steps = sourceSteps ?? []
      const stepIdMap = new Map<string, string>()

      if (steps.length > 0) {
        const stepRows = steps.map(step => ({
          section_id: sectionIdMap.get(step.section_id) ?? step.section_id,
          step_number: step.step_number,
          text: step.text,
          warning: step.warning,
          caution: step.caution,
          tip: step.tip,
          required_tools: step.required_tools,
          time_estimate_minutes: step.time_estimate_minutes,
          photo_required: step.photo_required,
        }))

        const { data: newSteps, error: stepsInsertError } = await admin
          .from('sop_steps')
          .insert(stepRows)
          .select('id, section_id, step_number')

        if (stepsInsertError || !newSteps) {
          throw new Error(`Failed to copy steps: ${stepsInsertError?.message ?? 'no data'}`)
        }

        // Build stepIdMap by array position within each old section group.
        // steps[] is ordered step_number ASC, newSteps[] RETURNING preserves insert order.
        // Matching by (section_id, step_number) is incorrect when step_number repeats
        // within a section — index-based is unambiguous (WR-03 fix).
        // Group old steps by old section id, newSteps by new section id, then zip by index.
        const oldStepsBySec = new Map<string, typeof steps>()
        for (const s of steps) {
          const arr = oldStepsBySec.get(s.section_id) ?? []
          arr.push(s)
          oldStepsBySec.set(s.section_id, arr)
        }
        const newStepsByNewSec = new Map<string, typeof newSteps>()
        for (const ns of newSteps) {
          const arr = newStepsByNewSec.get(ns.section_id) ?? []
          arr.push(ns)
          newStepsByNewSec.set(ns.section_id, arr)
        }
        for (const [oldSecId, oldGroup] of oldStepsBySec) {
          const newSecId = sectionIdMap.get(oldSecId)
          if (!newSecId) continue
          const newGroup = newStepsByNewSec.get(newSecId) ?? []
          oldGroup.forEach((oldStep, idx) => {
            const newStep = newGroup[idx]
            if (newStep) {
              stepIdMap.set(oldStep.id, newStep.id)
            }
          })
        }
      }

      // Step 2d: Copy sop_section_blocks junction rows
      // Blocks themselves are shared library items — only the FK reference is copied.
      // snapshot_content is required (database.types.ts Insert); copy from source row.
      const { data: sourceJunctions, error: junctionsError } = await admin
        .from('sop_section_blocks')
        .select('sop_section_id, block_id, sort_order, snapshot_content, pin_mode, block_provenance, pinned_version_id')
        .in('sop_section_id', sections.map(s => s.id))

      if (junctionsError) throw new Error(`Failed to fetch block junctions: ${junctionsError.message}`)

      const junctions = sourceJunctions ?? []
      if (junctions.length > 0) {
        const junctionRows = junctions.map(junc => ({
          sop_section_id: sectionIdMap.get(junc.sop_section_id) ?? junc.sop_section_id,
          block_id: junc.block_id,
          sort_order: junc.sort_order,
          snapshot_content: junc.snapshot_content,
          pin_mode: junc.pin_mode,
          block_provenance: junc.block_provenance,
          pinned_version_id: junc.pinned_version_id,
        }))

        const { error: juncInsertError } = await admin
          .from('sop_section_blocks')
          .insert(junctionRows)

        if (juncInsertError) {
          throw new Error(`Failed to copy block junctions: ${juncInsertError.message}`)
        }
      }

      // Step 2e: Copy sop_images by reference (RESEARCH.md Pitfall 7 / A3)
      // sop_images are shared immutable storage objects — copy the DB row with the same
      // storage_path (no re-upload). Re-point section_id and step_id to new ids.
      // Column names per database.types.ts: section_id (not sop_section_id), content_type (not mime_type)
      const { data: sourceImages, error: imagesError } = await admin
        .from('sop_images')
        .select('id, section_id, step_id, storage_path, alt_text, sort_order, content_type')
        .in('section_id', sections.map(s => s.id))

      if (imagesError) throw new Error(`Failed to fetch source images: ${imagesError.message}`)

      const images = sourceImages ?? []
      if (images.length > 0) {
        const imageRows = images.map(img => ({
          sop_id: newSopId,
          section_id: sectionIdMap.get(img.section_id ?? '') ?? img.section_id,
          step_id: img.step_id ? (stepIdMap.get(img.step_id) ?? img.step_id) : null,
          storage_path: img.storage_path, // shared — no re-upload
          alt_text: img.alt_text,
          sort_order: img.sort_order,
          content_type: img.content_type,
        }))

        const { error: imgInsertError } = await admin
          .from('sop_images')
          .insert(imageRows)

        if (imgInsertError) {
          throw new Error(`Failed to copy images: ${imgInsertError.message}`)
        }
      }
    }

    // Step 3: All copies succeeded — flip status sentinel to 'draft'
    // DO NOT set superseded_by on sourceSop here — that only happens on publish (D-05)
    const { error: statusError } = await admin
      .from('sops')
      .update({ status: 'draft' })
      .eq('id', newSopId)

    if (statusError) {
      throw new Error(`Failed to set draft status: ${statusError.message}`)
    }

    return { success: true, newDraftId: newSopId }

  } catch (err) {
    // Step 4: Cleanup — delete partial draft (CASCADE removes sections/steps/junctions/images)
    console.error('cloneSopAsDraft: copy failure, cleaning up partial draft:', err)
    await admin.from('sops').delete().eq('id', newSopId)
    const message = err instanceof Error ? err.message : 'Unknown error during SOP clone.'
    return { success: false, error: message }
  }
}

// ------------------------------------------------------------
// restoreVersionAsNew (AFL-VER-03 / D-06)
// Restores an OLD (possibly superseded) version by copying its content FORWARD
// into a new draft. Delegates to cloneSopAsDraft — the deep-copy and lineage
// continuation logic is identical; only the source is an old version rather
// than the current published one.
//
// D-06 APPEND-ONLY INVARIANT: This function NEVER mutates superseded_by on old
// rows, never sets status='published' on an old id, and never rewrites any old
// version row's content. History is strictly append-only. The restored draft
// then follows the normal publish path which supersedes whichever version is
// current at publish time.
// ------------------------------------------------------------
export async function restoreVersionAsNew(
  oldVersionSopId: string
): Promise<{ success: true; newDraftId: string } | { success: false; error: string }> {
  // Restore = clone an old version forward into a new draft.
  // Re-uses cloneSopAsDraft which handles: auth guard, role check (admin/safety_manager),
  // org-scope self-enforcement, version lineage continuation, status sentinel,
  // cleanup-on-failure, and the no-superseded_by-on-clone invariant.
  // D-06: nothing here reactivates old rows — the old version stays superseded.
  return cloneSopAsDraft(oldVersionSopId)
}

// ------------------------------------------------------------
// getSopVersionForDiff (AFL-VER-02 / D-07)
// Fetches a single SOP version's header + sections for the diff page.
// Uses the admin client (RESEARCH.md Pitfall 5) so superseded versions
// — which may be invisible to the session client — are always readable.
// Org-scope is self-enforced: verifies the SOP belongs to the caller's org.
// This is an admin-only action; role is checked before invoking.
// ------------------------------------------------------------
export type SopVersionPayload = {
  id: string
  title: string | null
  version: number
  status: string
  published_at: string | null
  superseded_by: string | null
  sections: Array<{
    id: string
    title: string
    sort_order: number
    section_type: string
    content: string | null
    layout_data: unknown
  }>
}

export async function getSopVersionForDiff(
  sopId: string
): Promise<{ success: true; sop: SopVersionPayload } | { success: false; error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }

  // Role guard — admin-only route
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'You need admin access to view version diffs.' }
  }

  // Use admin client to read superseded versions (RESEARCH Pitfall 5)
  const admin = createAdminClient()

  const { data: sop, error: sopError } = await admin
    .from('sops')
    .select('id, title, version, status, published_at, superseded_by, organisation_id')
    .eq('id', sopId)
    .single()

  if (sopError || !sop) {
    return { success: false, error: 'SOP version not found.' }
  }

  // Self-enforce org-scope (T-23-05-01 — admin client bypasses RLS)
  if (!organisationId || sop.organisation_id !== organisationId) {
    return { success: false, error: 'Access denied: SOP belongs to a different organisation.' }
  }

  const { data: sections, error: sectionsError } = await admin
    .from('sop_sections')
    .select('id, title, sort_order, section_type, content, layout_data')
    .eq('sop_id', sopId)
    .order('sort_order', { ascending: true })

  if (sectionsError) {
    console.error('getSopVersionForDiff: sections error:', sectionsError)
    return { success: false, error: 'Failed to load SOP sections.' }
  }

  return {
    success: true,
    sop: {
      id: sop.id,
      title: sop.title,
      version: sop.version,
      status: sop.status,
      published_at: sop.published_at,
      superseded_by: sop.superseded_by,
      sections: (sections ?? []) as SopVersionPayload['sections'],
    },
  }
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
