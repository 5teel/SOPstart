'use server'

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
// publishVideo
//
// Sets published=true on a ready video_generation_jobs record.
// ---------------------------------------------------------------
export async function publishVideo(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()

  const { error } = await admin
    .from('video_generation_jobs')
    .update({ published: true, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'ready')

  if (error) {
    console.error('publishVideo error:', error)
    return { success: false, error: 'Failed to publish video' }
  }

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
// deleteVideoJob
//
// Deletes the job record and its associated Storage files.
// ---------------------------------------------------------------
export async function deleteVideoJob(
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

  // Remove all audio files for this SOP (we stored under {orgId}/{sopId}/audio/)
  // List and delete audio files
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
    console.error('deleteVideoJob error:', deleteError)
    return { success: false, error: 'Failed to delete video job' }
  }

  return { success: true }
}

// ---------------------------------------------------------------
// regenerateVideo
//
// Marks the existing job(s) for this SOP+format as failed (clears
// the UNIQUE constraint), creates a new job, and fires the pipeline.
// Does NOT call the API route — inline the same logic to avoid the
// unnecessary HTTP round-trip.
// ---------------------------------------------------------------
export async function regenerateVideo(
  sopId: string,
  format: VideoFormat,
): Promise<{ jobId: string } | { error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()

  // Fetch current SOP to get version and verify it exists
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .select('id, version, organisation_id, status')
    .eq('id', sopId)
    .single()

  if (sopError || !sop) {
    return { error: 'SOP not found' }
  }

  if (sop.status !== 'published') {
    return { error: 'Only published SOPs can be used for video generation' }
  }

  // Mark all existing non-failed jobs for this SOP+format as failed
  // This clears the UNIQUE(sop_id, format, sop_version) constraint for the new job
  await admin
    .from('video_generation_jobs')
    .update({
      status: 'failed',
      error_message: 'Superseded by regeneration request',
      updated_at: new Date().toISOString(),
    })
    .eq('sop_id', sopId)
    .eq('format', format)
    .neq('status', 'failed')

  // Create new job record
  const { data: newJob, error: insertError } = await admin
    .from('video_generation_jobs')
    .insert({
      organisation_id: auth.organisationId,
      sop_id: sopId,
      sop_version: sop.version,
      format,
      status: 'queued',
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (insertError || !newJob) {
    console.error('regenerateVideo job creation error:', insertError)
    return { error: 'Failed to create regeneration job' }
  }

  // Fire-and-forget pipeline — same pattern as the API route handler
  void runVideoGenerationPipeline(newJob.id).catch((err) => {
    console.error(`[regenerateVideo] Unhandled pipeline error for job ${newJob.id}:`, err)
  })

  return { jobId: newJob.id }
}
