import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueVideoGenerationForPipeline } from '@/lib/video-gen/auto-queue'

// POST /api/sops/[sopId]/publish — transition draft -> published
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const supabase = await createClient()

  // 1. Resolve user + org for downstream auto-queue call
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | undefined = jwtClaims['organisation_id']
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }

  // 2. Verify all sections are approved (server-side check — don't trust client)
  //    PRESERVED EXACTLY from pre-Phase-9 implementation (PATH-06, D-02).
  const { count: unapprovedCount, error: countError } = await supabase
    .from('sop_sections')
    .select('*', { count: 'exact', head: true })
    .eq('sop_id', sopId)
    .eq('approved', false)

  if (countError) {
    return NextResponse.json({ error: 'Failed to check section approvals' }, { status: 500 })
  }

  if (unapprovedCount && unapprovedCount > 0) {
    return NextResponse.json(
      { error: 'All sections must be approved before publishing' },
      { status: 400 }
    )
  }

  // 3. Publish
  const { error: publishError } = await supabase
    .from('sops')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sopId)
    .eq('status', 'draft') // Only publish drafts

  if (publishError) {
    return NextResponse.json({ error: 'Failed to publish SOP' }, { status: 500 })
  }

  // 4. Auto-queue video generation if this SOP arrived via the pipeline
  //    flow (PATH-03). Never blocks/rolls back the publish — failures
  //    are logged and surfaced on the progress page.
  const queueResult = await enqueueVideoGenerationForPipeline({
    sopId,
    organisationId,
    createdBy: user.id,
  })

  if (queueResult.error) {
    console.error(`[publish] auto-queue failed for SOP ${sopId}:`, queueResult.error)
  }

  return NextResponse.json({
    success: true,
    pipelineAutoQueued: 'enqueued' in queueResult,
  })
}
