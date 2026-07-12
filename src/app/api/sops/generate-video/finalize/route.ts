import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShotstackRender } from '@/lib/video-gen/shotstack-client'
import { finalizeRenderJob } from '@/lib/video-gen/finalize-job'

export const maxDuration = 60

/**
 * Finalize a video generation job that was left in 'rendering_pending' state.
 * Called by the client-side polling when it detects the pipeline timed out
 * but Shotstack may have finished. The Shotstack callback webhook does the
 * same thing automatically — this is the pull-based fallback.
 */
export async function POST(request: NextRequest) {
  const { jobId } = (await request.json()) as { jobId: string }
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: job } = await admin
    .from('video_generation_jobs')
    .select('id, sop_id, organisation_id, status, shotstack_render_id, current_stage')
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

  const result = await finalizeRenderJob(admin, job, render)
  return NextResponse.json(result)
}
