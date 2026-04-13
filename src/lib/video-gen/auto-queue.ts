import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface EnqueueInput {
  sopId: string
  organisationId: string
  createdBy: string
}

interface EnqueueResult {
  enqueued?: { jobId: string; pipelineRunId: string; versionNumber: number }
  skipped?: true
  error?: string
}

/**
 * Called from the publish route after a successful draft -> published
 * transition. Reads the SOP's parse_jobs row; if pipeline_run_id is set,
 * enqueues a video_generation_jobs row tagged with the same pipeline and
 * fires the pipeline via next/server after(). Never throws.
 *
 * Phase 10 note: the legacy UNIQUE(sop_id, format, sop_version) constraint
 * was dropped in migration 00018. We use the same pattern as
 * `generateNewVersion` in src/actions/video.ts:
 *   1. If an active job already exists for this SOP+format, return it (idempotent).
 *   2. Otherwise compute nextVersion and INSERT a new row.
 */
export async function enqueueVideoGenerationForPipeline(
  input: EnqueueInput,
): Promise<EnqueueResult> {
  try {
    const admin = createAdminClient()

    // 1. Find the pipeline_run_id from the SOP's most recent parse_job
    const { data: parseJob } = await admin
      .from('parse_jobs')
      .select('id, pipeline_run_id')
      .eq('sop_id', input.sopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!parseJob || !parseJob.pipeline_run_id) {
      return { skipped: true }
    }

    const pipelineRunId = parseJob.pipeline_run_id

    // 2. Read requested format from the pipeline run row
    const { data: pipelineRun } = await admin
      .from('sop_pipeline_runs')
      .select('requested_video_format')
      .eq('id', pipelineRunId)
      .maybeSingle()

    if (!pipelineRun) {
      return { skipped: true }
    }

    const format = pipelineRun.requested_video_format

    // 3. Verify SOP is published (defence-in-depth — caller should
    //    only invoke us after a successful publish)
    const { data: sop } = await admin
      .from('sops')
      .select('id, version, status')
      .eq('id', input.sopId)
      .maybeSingle()

    if (!sop) return { error: 'SOP not found for auto-queue' }
    if (sop.status !== 'published') {
      return { error: 'SOP must be published before auto-queue' }
    }

    // 4. Idempotency guard — if an active (non-terminal) job already
    //    exists for this SOP+format, reuse it. Prevents double-queue
    //    if publish is somehow retried.
    const { data: activeJob } = await admin
      .from('video_generation_jobs')
      .select('id, version_number, status, pipeline_run_id')
      .eq('sop_id', input.sopId)
      .eq('format', format)
      .in('status', ['queued', 'analyzing', 'generating_audio', 'rendering'])
      .limit(1)
      .maybeSingle()

    if (activeJob) {
      return {
        enqueued: {
          jobId: activeJob.id,
          pipelineRunId,
          versionNumber: activeJob.version_number,
        },
      }
    }

    // 5. Compute next version number (app-level counter scoped to SOP,
    //    matches generateNewVersion pattern in src/actions/video.ts).
    const { data: maxRow } = await admin
      .from('video_generation_jobs')
      .select('version_number')
      .eq('sop_id', input.sopId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (maxRow?.version_number ?? 0) + 1

    // 6. Create new versioned job tagged with the pipeline run id
    const { data: newJob, error: insertError } = await admin
      .from('video_generation_jobs')
      .insert({
        organisation_id: input.organisationId,
        sop_id: input.sopId,
        sop_version: sop.version,
        format,
        version_number: nextVersion,
        status: 'queued' as const,
        created_by: input.createdBy,
        pipeline_run_id: pipelineRunId,
      })
      .select('id')
      .single()

    if (insertError || !newJob) {
      console.error('[auto-queue] video job insert error:', insertError)
      return { error: 'Failed to create video generation job' }
    }

    const jobId = newJob.id

    // 7. Fire pipeline via after() — lazy dynamic import so the publish
    //    route bundle doesn't drag in the full video-gen stack.
    after(async () => {
      try {
        const { runVideoGenerationPipeline } = await import('@/lib/video-gen/pipeline')
        await runVideoGenerationPipeline(jobId)
      } catch (err) {
        console.error(`[auto-queue] pipeline error for job ${jobId}:`, err)
      }
    })

    return { enqueued: { jobId, pipelineRunId, versionNumber: nextVersion } }
  } catch (err) {
    console.error('[auto-queue] unexpected error:', err)
    return { error: 'Auto-queue failed' }
  }
}
