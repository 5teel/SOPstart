/**
 * POST /api/sops/recover-renders
 *
 * Recovery endpoint for Shotstack renders that completed but were never
 * downloaded due to pipeline polling timeouts. Checks all jobs with a
 * shotstack_render_id that are stuck in rendering/failed status, polls
 * Shotstack for completion, downloads and re-uploads completed videos.
 *
 * Admin-only. Run manually when needed.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShotstackRender } from '@/lib/video-gen/shotstack-client'

export async function POST() {
  // Auth check — admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Find all jobs with a shotstack_render_id that are stuck
  const { data: stuckJobs, error: queryError } = await admin
    .from('video_generation_jobs')
    .select('id, sop_id, organisation_id, shotstack_render_id, status, error_message')
    .not('shotstack_render_id', 'is', null)
    .in('status', ['rendering', 'failed'])
    .order('created_at', { ascending: false })

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  if (!stuckJobs || stuckJobs.length === 0) {
    return NextResponse.json({ message: 'No stuck jobs with render IDs found', recovered: 0 })
  }

  const results: Array<{
    jobId: string
    renderId: string
    previousStatus: string
    outcome: 'recovered' | 'still_rendering' | 'render_failed' | 'download_failed' | 'check_failed'
    detail?: string
  }> = []

  for (const job of stuckJobs) {
    const renderId = job.shotstack_render_id as string

    try {
      const render = await getShotstackRender(renderId)

      if (render.status === 'done' && render.url) {
        // Render completed on Shotstack — download and re-upload
        try {
          const videoResponse = await fetch(render.url)
          if (!videoResponse.ok) {
            results.push({
              jobId: job.id,
              renderId,
              previousStatus: job.status,
              outcome: 'download_failed',
              detail: `Shotstack URL returned ${videoResponse.status} — video may have expired (24h TTL)`,
            })
            continue
          }

          const contentLength = videoResponse.headers.get('content-length')
          console.log(`[recover-renders] Downloading ${renderId}: ${contentLength ?? 'unknown'} bytes`)

          const arrayBuffer = await videoResponse.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const path = `${job.organisation_id}/${job.sop_id}/video/${job.id}.mp4`

          console.log(`[recover-renders] Uploading ${buffer.length} bytes to ${path}`)

          const { error: uploadError } = await admin.storage
            .from('sop-generated-videos')
            .upload(path, buffer, { contentType: 'video/mp4', upsert: true, duplex: 'half' } as Record<string, unknown>)

          if (uploadError) {
            results.push({
              jobId: job.id,
              renderId,
              previousStatus: job.status,
              outcome: 'download_failed',
              detail: `Storage upload failed: ${uploadError.message}`,
            })
            continue
          }

          // Mark as ready
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

          results.push({
            jobId: job.id,
            renderId,
            previousStatus: job.status,
            outcome: 'recovered',
          })
        } catch (dlErr) {
          results.push({
            jobId: job.id,
            renderId,
            previousStatus: job.status,
            outcome: 'download_failed',
            detail: dlErr instanceof Error ? dlErr.message : String(dlErr),
          })
        }
      } else if (render.status === 'failed') {
        // Mark as failed with Shotstack's error
        await admin
          .from('video_generation_jobs')
          .update({
            status: 'failed',
            current_stage: 'failed',
            error_message: `Shotstack render failed: ${render.error ?? 'unknown'}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        results.push({
          jobId: job.id,
          renderId,
          previousStatus: job.status,
          outcome: 'render_failed',
          detail: render.error ?? 'unknown',
        })
      } else {
        // Still rendering or other status
        results.push({
          jobId: job.id,
          renderId,
          previousStatus: job.status,
          outcome: 'still_rendering',
          detail: `Shotstack status: ${render.status}`,
        })
      }
    } catch (err) {
      results.push({
        jobId: job.id,
        renderId,
        previousStatus: job.status,
        outcome: 'check_failed',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const recovered = results.filter((r) => r.outcome === 'recovered').length

  return NextResponse.json({
    message: `Checked ${stuckJobs.length} stuck jobs, recovered ${recovered}`,
    recovered,
    total_checked: stuckJobs.length,
    results,
  })
}
