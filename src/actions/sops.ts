'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadSessionSchema, getSourceFileType, isBlockedMacroFile, createVideoSopPipelineSessionSchema } from '@/lib/validators/sop'
import type { UploadSession } from '@/types/sop'

export async function createUploadSession(
  files: { name: string; size: number; type: string }[]
): Promise<{ sessions: UploadSession[] } | { error: string }> {
  const result = uploadSessionSchema.safeParse({ files })
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid files' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get org_id from JWT claims
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation found' }

  // Check role
  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'You need admin access to upload SOPs.' }
  }

  const admin = createAdminClient()
  const sessions: UploadSession[] = []

  for (const file of result.data.files) {
    // Reject macro-enabled Office files before any parsing library is invoked
    if (isBlockedMacroFile(file.name)) {
      return { error: `${file.name} is not supported — macro-enabled Office files are blocked for security. Save as .xlsx or .pptx and try again.` }
    }

    const fileType = getSourceFileType(file.type)

    // Create SOP record (status: uploading)
    const { data: sop, error: sopError } = await admin
      .from('sops')
      .insert({
        organisation_id: organisationId,
        source_file_name: file.name,
        source_file_type: fileType,
        source_file_path: '', // will update after upload
        uploaded_by: user.id,
        status: 'uploading',
      })
      .select('id')
      .single()

    if (sopError || !sop) {
      console.error('SOP creation error:', sopError)
      return { error: 'Failed to create upload session. Please try again.' }
    }

    // Build storage path: {org_id}/{sop_id}/original/{filename}
    const path = `${organisationId}/${sop.id}/original/${file.name}`

    // Create presigned upload URL
    const { data: signedData, error: signError } = await admin.storage
      .from('sop-documents')
      .createSignedUploadUrl(path)

    if (signError || !signedData) {
      console.error('Presigned URL error:', signError)
      return { error: 'Failed to create upload URL. Please try again.' }
    }

    // Update SOP with the storage path
    await admin.from('sops').update({ source_file_path: path }).eq('id', sop.id)

    // Create parse job (queued)
    await admin.from('parse_jobs').insert({
      organisation_id: organisationId,
      sop_id: sop.id,
      file_path: path,
      file_type: fileType,
      status: 'queued',
    })

    sessions.push({
      sopId: sop.id,
      uploadUrl: signedData.signedUrl,
      token: signedData.token,
      path,
    })
  }

  return { sessions }
}

export async function triggerParse(sopId: string): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Update SOP status to parsing
  const { error } = await supabase
    .from('sops')
    .update({ status: 'parsing' })
    .eq('id', sopId)

  if (error) {
    console.error('trigger parse error:', error)
    return { error: 'Failed to start parsing' }
  }

  // Client triggers /api/sops/parse directly (fire-and-forget doesn't work in Next.js 16 server actions)
  return { success: true }
}

export async function createVideoUploadSession(
  file: { name: string; size: string; type: string }
): Promise<{ sopId: string; path: string; token: string; signedUploadUrl: string | null } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get org_id and role from JWT claims (same pattern as createUploadSession)
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation found' }

  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'You need admin access to upload SOPs.' }
  }

  // Create SOP record with video type
  const admin = createAdminClient()
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      title: null,
      status: 'uploading',
      version: 1,
      source_file_path: '',
      source_file_type: 'video' as const,
      source_file_name: file.name,
      is_ocr: false,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (sopError || !sop) {
    console.error('Video SOP creation error:', sopError)
    return { error: 'Failed to create upload session. Please try again.' }
  }

  // Storage path: {org_id}/{sop_id}/audio/{filename}
  // May be extracted MP3 audio or raw webm video (mobile fallback)
  const ext = file.name.split('.').pop() || 'mp3'
  const storagePath = `${organisationId}/${sop.id}/audio/audio.${ext}`

  // Update SOP with storage path + create parse job
  // If either fails, clean up and return error (pseudo-atomic)
  const { error: updateError } = await admin
    .from('sops')
    .update({ source_file_path: storagePath })
    .eq('id', sop.id)

  if (updateError) {
    await admin.from('sops').delete().eq('id', sop.id)
    return { error: 'Failed to create upload session. Please try again.' }
  }

  const { error: jobError } = await admin
    .from('parse_jobs')
    .insert({
      organisation_id: organisationId,
      sop_id: sop.id,
      status: 'queued',
      file_path: storagePath,
      file_type: 'video',
      input_type: 'video_file',
      current_stage: 'uploading',
    })

  if (jobError) {
    console.error('Parse job creation error:', jobError)
    await admin.from('sops').delete().eq('id', sop.id)
    return { error: 'Failed to create upload session. Please try again.' }
  }

  // Use service role key for TUS upload auth
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  // Generate a presigned upload URL for direct upload (small files < 10MB)
  let signedUploadUrl: string | null = null
  const fileSize = parseInt(file.size, 10)
  if (fileSize < 10 * 1024 * 1024) {
    const { data: signedData } = await admin.storage
      .from('sop-videos')
      .createSignedUploadUrl(storagePath)
    signedUploadUrl = signedData?.signedUrl ?? null
  }

  return {
    sopId: sop.id,
    path: storagePath,
    token,
    signedUploadUrl,
  }
}

export async function reparseSop(sopId: string): Promise<{ success: true; sopId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Delete existing sections (cascade deletes steps and images)
  await supabase.from('sop_sections').delete().eq('sop_id', sopId)

  // Reset SOP status to parsing
  await supabase
    .from('sops')
    .update({
      status: 'parsing',
      title: null,
      overall_confidence: null,
      parse_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sopId)

  // Fetch SOP details for the new parse job
  const { data: sop } = await supabase
    .from('sops')
    .select('organisation_id, source_file_path, source_file_type')
    .eq('id', sopId)
    .single()

  if (!sop) return { error: 'SOP not found' }

  const admin = createAdminClient()

  // Verify the source file exists in storage before queuing re-parse
  const bucket = sop.source_file_type === 'video' ? 'sop-videos' : 'sop-documents'
  const { data: fileCheck } = await admin.storage
    .from(bucket)
    .createSignedUrl(sop.source_file_path, 10)

  if (!fileCheck?.signedUrl) {
    return { error: 'Source file not found — the original upload may not have completed. Please re-upload the file.' }
  }

  await admin.from('parse_jobs').insert({
    organisation_id: sop.organisation_id,
    sop_id: sopId,
    file_path: sop.source_file_path,
    file_type: sop.source_file_type,
    status: 'queued',
  })

  // Return sopId — client triggers parse API directly
  // (server action fire-and-forget fetch gets aborted by Next.js 16)
  return { success: true, sopId }
}

/**
 * Re-structure a video SOP using the existing transcript (skips re-transcription).
 * Much faster than full re-parse (~3-5s vs ~15-30s).
 */
export async function restructureSop(sopId: string): Promise<{ success: true; sopId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Find existing parse job with transcript
  const { data: existingJob } = await supabase
    .from('parse_jobs')
    .select('id, transcript_text, organisation_id, file_path, file_type')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; transcript_text: string | null; organisation_id: string; file_path: string; file_type: string } | null }

  if (!existingJob?.transcript_text) {
    return { error: 'No existing transcript found — use full re-transcribe instead.' }
  }

  // Delete existing sections
  await supabase.from('sop_sections').delete().eq('sop_id', sopId)

  // Reset SOP status
  await supabase
    .from('sops')
    .update({
      status: 'parsing',
      title: null,
      overall_confidence: null,
      parse_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sopId)

  // Create new parse job that carries forward the transcript
  const admin = createAdminClient()
  await admin.from('parse_jobs').insert({
    organisation_id: existingJob.organisation_id,
    sop_id: sopId,
    file_path: existingJob.file_path,
    file_type: existingJob.file_type,
    status: 'queued',
    current_stage: 'structuring',
    transcript_text: existingJob.transcript_text,
    transcript_segments: null, // will be re-populated from existing job if needed
  })

  return { success: true, sopId }
}

export async function deleteSop(sopId: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify admin role
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

  // Delete sections (cascade deletes steps/images), parse jobs, assignments, then SOP
  const admin = createAdminClient()
  await admin.from('sop_sections').delete().eq('sop_id', sopId)
  await admin.from('parse_jobs').delete().eq('sop_id', sopId)
  await admin.from('sop_assignments').delete().eq('sop_id', sopId)
  await admin.from('video_generation_jobs').delete().eq('sop_id', sopId)
  await admin.from('worker_notifications').delete().eq('sop_id', sopId)
  const { error } = await admin.from('sops').delete().eq('id', sopId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function createVideoSopPipelineSession(input: {
  file: { name: string; size: number; type: string }
  format: 'narrated_slideshow' | 'screen_recording'
}): Promise<
  | { pipelineId: string; sopId: string; uploadUrl: string; token: string; path: string }
  | { error: string }
> {
  // 1. Validate input
  const parsed = createVideoSopPipelineSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { file, format } = parsed.data

  // 2. Auth + role check (same JWT pattern as createUploadSession)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation found' }
  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'You need admin access to upload SOPs.' }
  }

  // 3. Block macro-enabled Office files
  if (isBlockedMacroFile(file.name)) {
    return { error: `${file.name} is not supported — macro-enabled Office files are blocked for security. Save as .xlsx or .pptx and try again.` }
  }

  // 4. Determine source file type (throws on unknown — let it surface)
  let fileType: ReturnType<typeof getSourceFileType>
  try {
    fileType = getSourceFileType(file.type)
  } catch {
    return { error: `Unsupported file type: ${file.type}` }
  }

  const admin = createAdminClient()

  // 5. Create pipeline run row
  const { data: pipelineRun, error: pipelineError } = await admin
    .from('sop_pipeline_runs')
    .insert({
      organisation_id: organisationId,
      requested_video_format: format,
      status: 'active',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (pipelineError || !pipelineRun) {
    console.error('Pipeline run creation error:', pipelineError)
    return { error: 'Failed to start pipeline. Please try again.' }
  }

  // 6. Create SOP row (uploading status), linked to pipeline
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      source_file_name: file.name,
      source_file_type: fileType,
      source_file_path: '',
      uploaded_by: user.id,
      status: 'uploading',
      pipeline_run_id: pipelineRun.id,
    })
    .select('id')
    .single()

  if (sopError || !sop) {
    console.error('SOP creation error:', sopError)
    return { error: 'Failed to create upload session. Please try again.' }
  }

  // 7. Build storage path + presigned URL
  const path = `${organisationId}/${sop.id}/original/${file.name}`
  const { data: signedData, error: signError } = await admin.storage
    .from('sop-documents')
    .createSignedUploadUrl(path)

  if (signError || !signedData) {
    console.error('Presigned URL error:', signError)
    return { error: 'Failed to create upload URL. Please try again.' }
  }

  await admin.from('sops').update({ source_file_path: path }).eq('id', sop.id)

  // 8. Create parse_jobs row linked to pipeline
  await admin.from('parse_jobs').insert({
    organisation_id: organisationId,
    sop_id: sop.id,
    file_path: path,
    file_type: fileType,
    status: 'queued',
    input_type: 'upload',
    pipeline_run_id: pipelineRun.id,
  })

  return {
    pipelineId: pipelineRun.id,
    sopId: sop.id,
    uploadUrl: signedData.signedUrl,
    token: signedData.token,
    path,
  }
}

// ---------------------------------------------------------------
// createSopFromWizard (Phase 12 SB-AUTH-01)
// Atomic SOP + sections create for the blank-page authoring wizard.
// - Zod-validates input (title required, kindIds min 1 max 10)
// - JWT admin/safety_manager role guard
// - Inserts sops row with source_type='blank', status='draft'
// - Fetches section_kinds via the user's RLS-scoped client (prevents
//   cross-org kind forgery — T-12-03-02)
// - Batched insert of sop_sections mirroring kind.slug → section_type
//   (matches createSection precedent in src/actions/sections.ts)
// - Compensating cleanup (admin.from('sops').delete) on any section
//   insert failure so no orphan sops rows are left behind
// ---------------------------------------------------------------
const CreateSopFromWizardInput = z.object({
  title: z.string().min(1).max(200),
  sopNumber: z.string().max(60).nullable().optional(),
  kindIds: z.array(z.string().uuid()).min(1).max(10),
  // Phase 13 D-Tax-03: SOP-level category from controlled vocab (block_categories.slug).
  // Optional — picker scoring still works without it (falls back to all-of-kind).
  categoryTag: z.string().max(120).nullable().optional(),
})

export async function createSopFromWizard(
  input: z.infer<typeof CreateSopFromWizardInput>
): Promise<{ sopId: string } | { error: string }> {
  const parsed = CreateSopFromWizardInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation found' }

  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

  const admin = createAdminClient()

  // Phase 13 D-Tax-03: validate categoryTag against the controlled
  // block_categories.slug vocab before insert. T-13-03-07 mitigation —
  // no DB FK enforces this, so the application layer is the gate.
  if (parsed.data.categoryTag) {
    const { data: cat } = await supabase
      .from('block_categories')
      .select('slug')
      .eq('slug', parsed.data.categoryTag)
      .maybeSingle()
    if (!cat) return { error: 'Invalid category tag' }
  }

  // 1. Insert the SOP row (source_type='blank', status='draft').
  //    source_file_type='docx' is a placeholder — source_type='blank' is the
  //    authoritative signal that this SOP was built from scratch.
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      source_file_name: parsed.data.title,
      source_file_type: 'docx',
      source_file_path: '',
      uploaded_by: user.id,
      status: 'draft',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source_type: 'blank' as any,
      title: parsed.data.title,
      sop_number: parsed.data.sopNumber ?? null,
      // Phase 13 D-Tax-03: SOP-level primary category for picker pre-filter.
      category_tag: parsed.data.categoryTag ?? null,
    })
    .select('id')
    .single()

  if (sopError || !sop) {
    console.error('[createSopFromWizard] sop insert error', sopError)
    return { error: 'Failed to create SOP. Please try again.' }
  }

  // 2. Fetch the selected kinds via the caller's RLS-scoped supabase client
  //    (prevents an attacker from forging another org's custom kind —
  //    T-12-03-02). If the count is off, RLS filtered something out.
  const { data: kinds, error: kindsErr } = await supabase
    .from('section_kinds')
    .select('id, slug, display_name')
    .in('id', parsed.data.kindIds)

  if (kindsErr || !kinds || kinds.length !== parsed.data.kindIds.length) {
    // Compensating cleanup: delete the orphan SOP row
    await admin.from('sops').delete().eq('id', sop.id)
    return { error: 'One or more section kinds not found or not accessible' }
  }

  // 3. Batched insert of sop_sections — mirror kind.slug → section_type
  //    (sections.ts:71-80 precedent). gap-of-10 sort_order for future manual
  //    reordering (reorderSections RPC in Plan 04 relies on this).
  const sectionsPayload = parsed.data.kindIds.map((kindId, i) => {
    const kind = kinds.find((k) => k.id === kindId)!
    return {
      sop_id: sop.id,
      section_type: kind.slug,
      section_kind_id: kind.id,
      title: kind.display_name,
      content: null,
      sort_order: (i + 1) * 10,
      approved: false,
    }
  })

  const { error: sectionsErr } = await admin
    .from('sop_sections')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(sectionsPayload as any)

  if (sectionsErr) {
    console.error('[createSopFromWizard] sections insert error', sectionsErr)
    // Compensating cleanup
    await admin.from('sops').delete().eq('id', sop.id)
    return { error: 'Failed to create SOP sections. Please try again.' }
  }

  return { sopId: sop.id }
}
