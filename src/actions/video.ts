'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Publish a generated video job (sets published = true).
 * Workers will see this video in the SOP video tab.
 */
export async function publishVideo(jobId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { error } = await admin
    .from('video_generation_jobs')
    .update({ published: true, updated_at: new Date().toISOString() })
    .eq('id', jobId)

  if (error) throw new Error(error.message)
}

/**
 * Unpublish a generated video job (sets published = false).
 */
export async function unpublishVideo(jobId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { error } = await admin
    .from('video_generation_jobs')
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq('id', jobId)

  if (error) throw new Error(error.message)
}

/**
 * Re-generate a video. Sets the existing job status to 'queued' and resets
 * video_url. The pipeline (Plan 02) will pick this up and re-render.
 * Returns the same job ID so the UI can continue polling.
 */
export async function regenerateVideo(jobId: string): Promise<{ jobId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('video_generation_jobs')
    .update({
      status: 'queued',
      current_stage: null,
      video_url: null,
      shotstack_render_id: null,
      error_message: null,
      completed_at: null,
      published: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to reset job')
  return { jobId: data.id }
}

/**
 * Delete a video generation job (e.g. after a failure).
 */
export async function deleteVideoJob(jobId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { error } = await admin
    .from('video_generation_jobs')
    .delete()
    .eq('id', jobId)

  if (error) throw new Error(error.message)
}

/**
 * Record that a worker viewed a generated video (creates a video_view completion record).
 * This is used by the worker-facing video player (Plan 04).
 */
export async function recordVideoView(params: {
  sopId: string
  sopVersion: number
  videoJobId: string
}): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // Cast as unknown to bypass generated types — sop_completions was extended in migration
  // 00013 with completion_type and video_job_id columns (Plan 01), but database.types.ts
  // is manually maintained and not yet updated with these new columns (Plan 04 will update).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await admin
    .from('sop_completions')
    .insert({
      sop_id: params.sopId,
      sop_version: params.sopVersion,
      worker_id: user.id,
      completion_type: 'video_view',
      video_job_id: params.videoJobId,
      status: 'pending_sign_off',
    } as any)

  if (error && error.code !== '23505') {
    // Ignore duplicate (idempotent view recording)
    throw new Error(error.message)
  }
}
