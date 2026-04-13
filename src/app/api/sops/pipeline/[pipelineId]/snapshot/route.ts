import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const { pipelineId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? (JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64').toString('utf-8')
      ) as Record<string, unknown>)
    : {}
  const organisationId = jwtClaims['organisation_id'] as string | undefined
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const admin = createAdminClient()

  const pipelineRunResult = await admin
    .from('sop_pipeline_runs')
    .select('id, organisation_id')
    .eq('id', pipelineId)
    .maybeSingle()
  const pipelineRun = pipelineRunResult.data as {
    id: string
    organisation_id: string
  } | null

  if (!pipelineRun || pipelineRun.organisation_id !== organisationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sopResult = await admin
    .from('sops')
    .select('id, title, status, source_file_name, pipeline_run_id')
    .eq('pipeline_run_id', pipelineId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sop = sopResult.data as {
    id: string
    title: string | null
    status: string
    source_file_name: string
    pipeline_run_id: string | null
  } | null

  let parseJob: {
    id: string
    status: string
    current_stage: string | null
    error_message: string | null
  } | null = null
  if (sop) {
    const parseJobResult = await admin
      .from('parse_jobs')
      .select('id, status, current_stage, error_message')
      .eq('sop_id', sop.id)
      .eq('pipeline_run_id', pipelineId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    parseJob = parseJobResult.data as typeof parseJob
  }

  const videoJobResult = await admin
    .from('video_generation_jobs')
    .select('id, status, video_url, error_message, format, sop_version, current_stage')
    .eq('pipeline_run_id', pipelineId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const videoJob = videoJobResult.data as {
    id: string
    status: string
    video_url: string | null
    error_message: string | null
    format: string
    sop_version: number
    current_stage: string | null
  } | null

  return NextResponse.json({ sop, parseJob, videoJob })
}
