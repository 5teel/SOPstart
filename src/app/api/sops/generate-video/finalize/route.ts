import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShotstackRender } from '@/lib/video-gen/shotstack-client'

export const maxDuration = 60

/**
 * Finalize a video generation job that was left in 'rendering_pending' state.
 * Called by the client-side polling when it detects the pipeline timed out
 * but Shotstack may have finished.
 */
export async function POST(request: NextRequest) {
  const { jobId } = (await request.json()) as { jobId: string }
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: job } = await admin
    .from('video_generation_jobs')
    .select('id, sop_id, organisation_id, shotstack_render_id, current_stage')
    .eq('id', jobId)
    .single()

  if (!job || !job.shotstack_render_id) {
    return NextResponse.json({ error: 'Job not found or no render ID' }, { status: 404 })
  }

  // Only finalize jobs that are in rendering_pending or still rendering
  if (job.current_stage !== 'rendering_pending' && job.current_stage !== 'rendering') {
    return NextResponse.json({ status: job.current_stage })
  }

  const render = await getShotstackRender(job.shotstack_render_id)
  console.log(`[finalize] Job ${jobId} render status: ${render.status}`)

  if (render.status === 'done' && render.url) {
    // Download and re-upload
    const response = await fetch(render.url)
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to download from Shotstack' }, { status: 500 })
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const path = `${job.organisation_id}/${job.sop_id}/video/${jobId}.mp4`

    await admin.storage
      .from('sop-generated-videos')
      .upload(path, buffer, { contentType: 'video/mp4', upsert: true })

    await admin
      .from('video_generation_jobs')
      .update({
        status: 'ready',
        current_stage: 'ready',
        video_url: path,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    return NextResponse.json({ status: 'ready' })
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
      .eq('id', jobId)

    return NextResponse.json({ status: 'failed', error: render.error })
  }

  // Still rendering
  return NextResponse.json({ status: 'rendering' })
}
