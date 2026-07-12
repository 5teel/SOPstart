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
import { finalizeRenderJob } from '@/lib/video-gen/finalize-job'

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
    outcome: 'already_ready' | 'recovered' | 'still_rendering' | 'render_failed' | 'download_failed' | 'check_failed'
    detail?: string
  }> = []

  for (const job of stuckJobs) {
    const renderId = job.shotstack_render_id as string

    try {
      const render = await getShotstackRender(renderId)
      const result = await finalizeRenderJob(admin, job, render)
      results.push({ jobId: job.id, renderId, previousStatus: job.status, ...result })
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
