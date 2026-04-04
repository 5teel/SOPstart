import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateVideoSchema } from '@/lib/validators/sop'
import { runVideoGenerationPipeline } from '@/lib/video-gen/pipeline'

// Video generation can take up to 4 min (polling timeout) — requires Vercel Pro
export const maxDuration = 300

export async function POST(request: NextRequest) {
  // 1. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = generateVideoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { sopId, format } = parsed.data

  // 2. Auth check — get user and verify admin/safety_manager role
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string | undefined = jwtClaims['user_role']
  const organisationId: string | undefined = jwtClaims['organisation_id']

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return NextResponse.json({ error: 'Admin or Safety Manager role required' }, { status: 403 })
  }

  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 3. Verify SOP exists and is published
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .select('id, status, version, organisation_id')
    .eq('id', sopId)
    .single()

  if (sopError || !sop) {
    return NextResponse.json({ error: 'SOP not found' }, { status: 404 })
  }

  if (sop.status !== 'published') {
    return NextResponse.json(
      { error: 'Only published SOPs can be used for video generation' },
      { status: 422 },
    )
  }

  const sopVersion = sop.version

  // 4. Idempotency check (D-14): return existing non-failed job for same SOP + format + version
  const { data: existingJob } = await admin
    .from('video_generation_jobs')
    .select('id, status')
    .eq('sop_id', sopId)
    .eq('format', format)
    .eq('sop_version', sopVersion)
    .neq('status', 'failed')
    .maybeSingle()

  if (existingJob) {
    return NextResponse.json({ jobId: existingJob.id }, { status: 200 })
  }

  // 5. Create new job record
  const { data: newJob, error: insertError } = await admin
    .from('video_generation_jobs')
    .insert({
      organisation_id: organisationId,
      sop_id: sopId,
      sop_version: sopVersion,
      format,
      status: 'queued',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !newJob) {
    console.error('Video job creation error:', insertError)
    return NextResponse.json({ error: 'Failed to create video generation job' }, { status: 500 })
  }

  // 6. Fire-and-forget: run the pipeline without awaiting
  void runVideoGenerationPipeline(newJob.id).catch((err) => {
    console.error(`[generate-video] Unhandled pipeline error for job ${newJob.id}:`, err)
  })

  // 7. Return 202 Accepted with the new job ID
  return NextResponse.json({ jobId: newJob.id }, { status: 202 })
}
