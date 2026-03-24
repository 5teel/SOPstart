'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadSessionSchema, getSourceFileType } from '@/lib/validators/sop'
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

export async function reparseSop(sopId: string): Promise<{ success: boolean } | { error: string }> {
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
