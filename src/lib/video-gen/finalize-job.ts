/**
 * Shared, idempotent finalizer for a Shotstack video_generation_job.
 *
 * A render can be finalized from three places: the in-request poll loop
 * (pipeline.ts happy path), the Shotstack completion webhook
 * (generate-video/callback — the self-healing path), and the manual
 * recover/finalize endpoints. They all converge here so the download →
 * re-upload → status logic lives once.
 *
 * Idempotent: if the job is already `ready`, this is a no-op — whichever
 * path wins the race (poll vs callback) finalizes; the loser sees `ready`
 * and does nothing.
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import type { ShotstackRenderResponse } from './types'

export type FinalizeOutcome =
  | 'already_ready'
  | 'recovered'
  | 'render_failed'
  | 'download_failed'
  | 'still_rendering'

export interface FinalizableJob {
  id: string
  sop_id: string
  organisation_id: string
  status: string
}

export interface FinalizeResult {
  outcome: FinalizeOutcome
  detail?: string
}

/**
 * Given a job row and the authoritative Shotstack render status, drive the
 * job to its terminal state (ready | failed) or report it's still rendering.
 */
export async function finalizeRenderJob(
  admin: ReturnType<typeof createAdminClient>,
  job: FinalizableJob,
  render: ShotstackRenderResponse,
): Promise<FinalizeResult> {
  // Idempotency guard — don't re-download an already-finalized job.
  if (job.status === 'ready') return { outcome: 'already_ready' }

  if (render.status === 'done' && render.url) {
    const videoResponse = await fetch(render.url)
    if (!videoResponse.ok) {
      return {
        outcome: 'download_failed',
        detail: `Shotstack URL returned ${videoResponse.status} — video may have expired (24h TTL)`,
      }
    }

    const buffer = Buffer.from(await videoResponse.arrayBuffer())
    const path = `${job.organisation_id}/${job.sop_id}/video/${job.id}.mp4`

    const { error: uploadError } = await admin.storage
      .from('sop-generated-videos')
      .upload(path, buffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) {
      return { outcome: 'download_failed', detail: `Storage upload failed: ${uploadError.message}` }
    }

    await admin
      .from('video_generation_jobs')
      .update({
        status: 'ready',
        current_stage: 'ready',
        video_url: path,
        error_message: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return { outcome: 'recovered' }
  }

  if (render.status === 'failed') {
    await admin
      .from('video_generation_jobs')
      .update({
        status: 'failed',
        current_stage: 'failed',
        error_message: `Shotstack render failed: ${render.error ?? 'unknown'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return { outcome: 'render_failed', detail: render.error ?? 'unknown' }
  }

  return { outcome: 'still_rendering', detail: `Shotstack status: ${render.status}` }
}
