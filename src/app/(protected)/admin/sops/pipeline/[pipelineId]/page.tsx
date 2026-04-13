import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PipelineProgressClient } from './PipelineProgressClient'

interface PageProps {
  params: Promise<{ pipelineId: string }>
}

type SopRow = {
  id: string
  title: string | null
  status: string
  source_file_name: string
  pipeline_run_id: string | null
}

type ParseJobRow = {
  id: string
  status: string
  current_stage: string | null
  error_message: string | null
}

type VideoJobRow = {
  id: string
  status: string
  video_url: string | null
  error_message: string | null
  format: string
  sop_version: number
  current_stage: string | null
}

export default async function PipelineProgressPage({ params }: PageProps) {
  const { pipelineId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? (JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64').toString('utf-8')
      ) as Record<string, unknown>)
    : {}
  const organisationId = jwtClaims['organisation_id'] as string | undefined
  if (!organisationId) redirect('/dashboard')

  const admin = createAdminClient()

  const pipelineRunResult = await admin
    .from('sop_pipeline_runs')
    .select('id, organisation_id, requested_video_format, status, created_at')
    .eq('id', pipelineId)
    .maybeSingle()
  const pipelineRun = pipelineRunResult.data as {
    id: string
    organisation_id: string
    requested_video_format: 'narrated_slideshow' | 'screen_recording'
    status: string
    created_at: string
  } | null

  if (!pipelineRun || pipelineRun.organisation_id !== organisationId) {
    redirect('/admin/sops')
  }

  // Find the sop referencing this pipeline run
  const sopResult = await admin
    .from('sops')
    .select('id, title, status, source_file_name, pipeline_run_id')
    .eq('pipeline_run_id', pipelineId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sop = sopResult.data as SopRow | null

  let parseJob: ParseJobRow | null = null
  if (sop) {
    const parseJobResult = await admin
      .from('parse_jobs')
      .select('id, status, current_stage, error_message')
      .eq('sop_id', sop.id)
      .eq('pipeline_run_id', pipelineId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    parseJob = parseJobResult.data as ParseJobRow | null
  }

  const videoJobResult = await admin
    .from('video_generation_jobs')
    .select('id, status, video_url, error_message, format, sop_version, current_stage')
    .eq('pipeline_run_id', pipelineId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const videoJob = videoJobResult.data as VideoJobRow | null

  return (
    <PipelineProgressClient
      pipelineId={pipelineId}
      initialPipelineStatus={pipelineRun.status}
      requestedFormat={pipelineRun.requested_video_format}
      initialSop={sop}
      initialParseJob={parseJob}
      initialVideoJob={videoJob}
    />
  )
}
