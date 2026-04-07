import { NextRequest, NextResponse, after } from 'next/server'
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

  // 4. Guard: block if a generation is already active for this SOP+format.
  // Multi-version model: we no longer enforce the old UNIQUE-based idempotency
  // check (existingJob). Instead, just prevent concurrent active generations.
  const { data: activeJob } = await admin
    .from('video_generation_jobs')
    .select('id, status')
    .eq('sop_id', sopId)
    .eq('format', format)
    .in('status', ['queued', 'analyzing', 'generating_audio', 'rendering'])
    .limit(1)
    .maybeSingle()

  if (activeJob) {
    return NextResponse.json({ jobId: activeJob.id }, { status: 200 })
  }

  // 5. Compute next version number (app-level counter scoped to SOP)
  const { data: maxRow } = await admin
    .from('video_generation_jobs')
    .select('version_number')
    .eq('sop_id', sopId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (maxRow?.version_number ?? 0) + 1

  // 6. Create new versioned job record
  const { data: newJob, error: insertError } = await admin
    .from('video_generation_jobs')
    .insert({
      organisation_id: organisationId,
      sop_id: sopId,
      sop_version: sopVersion,
      format,
      version_number: nextVersion,
      status: 'queued' as const,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !newJob) {
    console.error('Video job creation error:', insertError)
    return NextResponse.json({ error: 'Failed to create video generation job' }, { status: 500 })
  }

  const jobId = newJob.id

  // 7. Run the pipeline after response is sent — after() keeps the serverless
  // function alive for the pipeline's duration (up to maxDuration=300s).
  // A plain void call would be killed by Next.js once the response returns.
  after(async () => {
    try {
      await runVideoGenerationPipeline(jobId)
    } catch (err) {
      console.error(`[generate-video] Unhandled pipeline error for job ${jobId}:`, err)
    }
  })

  // 8. Return 202 Accepted with the new job ID
  return NextResponse.json({ jobId }, { status: 202 })
}
