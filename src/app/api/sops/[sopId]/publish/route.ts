import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueVideoGenerationForPipeline } from '@/lib/video-gen/auto-queue'

// POST /api/sops/[sopId]/publish — transition draft -> published
//
// Phase 21 (Plan 21-04 Task 2) — per-block verify gate.
//   - Rejects with 400 { error: 'unverified_blocks', count: N } if any
//     sop_section_blocks row for this SOP has verified_by_admin_id IS NULL.
//   - Skipped for AI-prompt SOPs (CONV-12 carve-out).
//   - Skipped for pre-Phase-20 SOPs that have no source_file_path (no
//     parser produced provenance, so there's nothing to verify).
//   - Defence-in-depth — the builder UI also disables the publish button
//     (VerifyProgressIndicator), but a client could still POST directly.
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

  // 2b. Phase 21 verify-checklist gate — defence in depth (D-CV2-04 Layer 3).
  //     Bypass for AI-prompt sources (CONV-12) and pre-Phase-20 SOPs
  //     (no source_file_path means there's no parser-provenance to verify).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sopRow, error: sopErr } = await (supabase as any)
    .from('sops')
    .select('source_type, source_file_path')
    .eq('id', sopId)
    .maybeSingle()

  if (sopErr) {
    return NextResponse.json({ error: 'Failed to load SOP for verify gate' }, { status: 500 })
  }

  const sourceType: string | null = (sopRow?.source_type as string | null) ?? null
  const sourceFilePath: string | null = (sopRow?.source_file_path as string | null) ?? null
  const verifyGateApplies = sourceType !== 'ai_prompt' && !!sourceFilePath

  if (verifyGateApplies) {
    // Collect this SOP's section ids, then count unverified junction rows.
    const { data: sectionRows, error: sectErr } = await supabase
      .from('sop_sections')
      .select('id')
      .eq('sop_id', sopId)

    if (sectErr) {
      return NextResponse.json({ error: 'Failed to load sections for verify gate' }, { status: 500 })
    }

    const sectionIds = (sectionRows ?? []).map((r: { id: string }) => r.id)
    if (sectionIds.length > 0) {
      const { count: unverifiedCount, error: blkErr } = await supabase
        .from('sop_section_blocks')
        .select('*', { count: 'exact', head: true })
        .in('sop_section_id', sectionIds)
        .is('verified_by_admin_id', null)

      if (blkErr) {
        return NextResponse.json({ error: 'Failed to check verified_by_admin_id' }, { status: 500 })
      }

      if (unverifiedCount && unverifiedCount > 0) {
        return NextResponse.json(
          { error: 'unverified_blocks', count: unverifiedCount },
          { status: 400 }
        )
      }
    }
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
