'use server'

import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordVideoViewSchema } from '@/lib/validators/sop'
import { runVideoGenerationPipeline } from '@/lib/video-gen/pipeline'
import type { VideoFormat } from '@/types/sop'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/** Extract JWT claims from the current session. */
async function getJwtClaims(): Promise<{
  user: { id: string } | null
  role: string | undefined
  organisationId: string | undefined
}> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { user: null, role: undefined, organisationId: undefined }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}

  return {
    user,
    role: jwtClaims['user_role'],
    organisationId: jwtClaims['organisation_id'],
  }
}

/** Check that the caller is an admin or safety manager. */
async function requireAdmin(): Promise<
  | { ok: true; userId: string; organisationId: string }
  | { ok: false; error: string }
> {
  const { user, role, organisationId } = await getJwtClaims()
  if (!user) return { ok: false, error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { ok: false, error: 'Admin or Safety Manager role required' }
  }
  if (!organisationId) return { ok: false, error: 'No organisation found' }
  return { ok: true, userId: user.id, organisationId }
}

// ---------------------------------------------------------------
// recordVideoView
//
// Creates a video_view completion record in sop_completions.
// Fire-and-forget — never throws to the client (D-15).
// ---------------------------------------------------------------
export async function recordVideoView(input: {
  sopId: string
  sopVersion: number
  videoJobId: string
}): Promise<void> {
  const validation = recordVideoViewSchema.safeParse(input)
  if (!validation.success) return

  const { sopId, sopVersion, videoJobId } = validation.data

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | undefined = jwtClaims['organisation_id']
  if (!organisationId) return

  const admin = createAdminClient()

  try {
    // Insert completion record with completion_type='video_view'
    // The sop_completions table was extended with completion_type and video_job_id in migration 00013.
    // database.types.ts Insert type doesn't reflect these columns yet (manual extension pattern),
    // so we cast to any to bypass the type checker.
    await (admin.from('sop_completions') as ReturnType<typeof admin.from>).insert({
      id: crypto.randomUUID(),
      organisation_id: organisationId,
      sop_id: sopId,
      worker_id: user.id,
      sop_version: sopVersion,
      // completion_type and video_job_id were added by migration 00013
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ completion_type: 'video_view', video_job_id: videoJobId } as any),
      status: 'pending_sign_off',
      submitted_at: new Date().toISOString(),
      // content_hash required by existing NOT NULL constraint — use deterministic hash
      content_hash: `video_view:${videoJobId}`,
      step_data: {},
    } as Record<string, unknown>)
    // 23505 conflict (duplicate) is silently ignored — idempotent
  } catch {
    // Fire-and-forget: never propagate errors to client (D-15)
  }
}

// ---------------------------------------------------------------
// generateNewVersion
//
// Creates a new video_generation_jobs row with an incremented
// version_number scoped to the SOP. Replaces regenerateVideo (D-06).
// Blocks if a generation is already active for this SOP+format.
// ---------------------------------------------------------------
export async function generateNewVersion(
  sopId: string,
  format: VideoFormat,
): Promise<{ jobId: string; versionNumber: number } | { error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()

  // Guard: block if a generation is already active for this SOP+format
  const { data: active } = await admin
    .from('video_generation_jobs')
    .select('id, status')
    .eq('sop_id', sopId)
    .eq('format', format)
    .in('status', ['queued', 'analyzing', 'generating_audio', 'rendering'])
    .limit(1)
    .maybeSingle()

  if (active) return { error: 'A generation is already in progress for this format' }

  // Get next version number (app-level counter scoped to SOP)
  const { data: maxRow } = await admin
    .from('video_generation_jobs')
    .select('version_number')
    .eq('sop_id', sopId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (maxRow?.version_number ?? 0) + 1

  // Fetch SOP for version + status check
  const { data: sop } = await admin
    .from('sops')
    .select('id, version, status, organisation_id')
    .eq('id', sopId)
    .single()

  if (!sop || sop.status !== 'published') return { error: 'SOP not found or not published' }

  const { data: newJob, error: insertError } = await admin
    .from('video_generation_jobs')
    .insert({
      organisation_id: auth.organisationId,
      sop_id: sopId,
      sop_version: sop.version,
      format,
      version_number: nextVersion,
      status: 'queued' as const,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (insertError || !newJob) return { error: 'Failed to create version' }

  after(async () => {
    await runVideoGenerationPipeline(newJob.id).catch(console.error)
  })

  return { jobId: newJob.id, versionNumber: nextVersion }
}

// ---------------------------------------------------------------
// publishVersionExclusive
//
// Unpublishes all other versions for this SOP, then publishes the
// target version. Enforces single-published-version invariant (D-03).
// ---------------------------------------------------------------
export async function publishVersionExclusive(
  jobId: string,
  sopId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Step 1: unpublish all versions for this SOP
  const { error: unpubError } = await admin
    .from('video_generation_jobs')
    .update({ published: false, updated_at: now })
    .eq('sop_id', sopId)
    .eq('published', true)

  if (unpubError) return { success: false, error: 'Failed to unpublish existing versions' }

  // Step 2: publish the target version (must be ready and not archived)
  const { error: pubError } = await admin
    .from('video_generation_jobs')
    .update({ published: true, updated_at: now })
    .eq('id', jobId)
    .eq('status', 'ready')

  if (pubError) return { success: false, error: 'Failed to publish version' }

  return { success: true }
}

// ---------------------------------------------------------------
// unpublishVideo
//
// Sets published=false on a video_generation_jobs record.
// ---------------------------------------------------------------
export async function unpublishVideo(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()

  const { error } = await admin
    .from('video_generation_jobs')
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq('id', jobId)

  if (error) {
    console.error('unpublishVideo error:', error)
    return { success: false, error: 'Failed to unpublish video' }
  }

  return { success: true }
}

// ---------------------------------------------------------------
// archiveVersion
//
// Sets archived=true and published=false on the target job (D-05).
// Archiving also unpublishes to prevent published+archived state.
// ---------------------------------------------------------------
export async function archiveVersion(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Archive also unpublishes (D-05 + Pitfall 5: published+archived violates D-03 semantics)
  const { error } = await admin
    .from('video_generation_jobs')
    .update({ archived: true, published: false, updated_at: now })
    .eq('id', jobId)

  if (error) return { success: false, error: 'Failed to archive version' }
  return { success: true }
}

// ---------------------------------------------------------------
// unarchiveVersion
//
// Sets archived=false on the target job (D-05).
// ---------------------------------------------------------------
export async function unarchiveVersion(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('video_generation_jobs')
    .update({ archived: false, updated_at: new Date().toISOString() })
    .eq('id', jobId)

  if (error) return { success: false, error: 'Failed to unarchive version' }
  return { success: true }
}

// ---------------------------------------------------------------
// permanentDeleteVersion
//
// Hard-deletes the job record and its associated Storage files.
// Renamed from deleteVideoJob (D-05). Alias export for migration safety.
// ---------------------------------------------------------------
export async function permanentDeleteVersion(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()

  // Fetch the job to get storage paths
  const { data: job, error: fetchError } = await admin
    .from('video_generation_jobs')
    .select('id, sop_id, organisation_id, video_url')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    return { success: false, error: 'Video job not found' }
  }

  const { organisation_id: orgId, sop_id: sopId } = job
  const bucket = 'sop-generated-videos'

  // Remove all audio files for this SOP (stored under {orgId}/{sopId}/audio/)
  const { data: audioFiles } = await admin.storage
    .from(bucket)
    .list(`${orgId}/${sopId}/audio`)

  if (audioFiles && audioFiles.length > 0) {
    const audioPaths = audioFiles.map((f) => `${orgId}/${sopId}/audio/${f.name}`)
    await admin.storage.from(bucket).remove(audioPaths)
  }

  // Remove the rendered video file
  const videoPath = `${orgId}/${sopId}/video/${jobId}.mp4`
  await admin.storage.from(bucket).remove([videoPath])

  // Delete the job record
  const { error: deleteError } = await admin
    .from('video_generation_jobs')
    .delete()
    .eq('id', jobId)

  if (deleteError) {
    console.error('permanentDeleteVersion error:', deleteError)
    return { success: false, error: 'Failed to delete video job' }
  }

  return { success: true }
}

// Backward-compat alias — existing callers using deleteVideoJob continue to work
// during migration to permanentDeleteVersion.
export { permanentDeleteVersion as deleteVideoJob }

// ---------------------------------------------------------------
// updateVersionLabel
//
// Saves a label (max 60 chars) or clears it (null) on the target job (D-04).
// ---------------------------------------------------------------
export async function updateVersionLabel(
  jobId: string,
  label: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  // Validate label
  const trimmed = label?.trim() || null
  if (trimmed && trimmed.length > 60) return { success: false, error: 'Label must be 60 characters or fewer' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('video_generation_jobs')
    .update({ label: trimmed, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', jobId)

  if (error) return { success: false, error: 'Failed to update label' }
  return { success: true }
}
