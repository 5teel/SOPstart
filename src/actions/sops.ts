'use server'

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

  // Update SOP with storage path
  await admin
    .from('sops')
    .update({ source_file_path: storagePath })
    .eq('id', sop.id)

  // Create parse job for video
  await admin
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
