import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import { enqueueVideoGenerationForPipeline } from '@/lib/video-gen/auto-queue'
import { triggerAgentSynthesis } from '@/lib/agent-layer/synthesis'
import { resolveCadenceMonths, computeReviewDueDate } from '@/lib/governance/cadences'

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
  // parseJwtPayload, not raw atob — JWT payloads are Base64URL (CLAUDE.md 2026-06-26)
  const jwtClaims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const organisationId = jwtClaims['organisation_id'] as string | undefined
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
    .select('source_type, source_file_path, category, parent_sop_id')
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

  // 3b. Phase 28 D28-04 — review-clock reset on publish. Non-fatal: the
  //     publish above already succeeded and is never rolled back for this.
  //     Resolves cadence months from the org's sop_review_cadences for this
  //     SOP's category, stamps review_due_at/last_reviewed_at on the
  //     just-published row, and (when parent_sop_id is set — this publish
  //     supersedes a prior version) appends a sop_review_events 'superseded'
  //     row. Intentionally NOT run inside cloneSopAsDraft — a cloned-but-
  //     unpublished draft must not look "just reviewed" (RESEARCH Pattern 4
  //     anti-pattern).
  try {
    const publishedAt = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cadenceRows } = await (supabase as any)
      .from('sop_review_cadences')
      .select('category, months')
      .eq('organisation_id', organisationId)

    const orgCadences: Record<string, number> = {}
    for (const row of (cadenceRows ?? []) as Array<{ category: string; months: number }>) {
      orgCadences[row.category] = row.months
    }
    const months = resolveCadenceMonths(sopRow?.category ?? null, orgCadences)
    const reviewDue = computeReviewDueDate(publishedAt, months)

    const { error: resetErr } = await supabase
      .from('sops')
      .update({ review_due_at: reviewDue, last_reviewed_at: publishedAt })
      .eq('id', sopId)
    if (resetErr) {
      console.error(`[publish] review-clock reset failed for SOP ${sopId}:`, resetErr)
    }

    if (sopRow?.parent_sop_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: eventErr } = await (supabase as any)
        .from('sop_review_events')
        .insert({
          sop_id: sopId,
          organisation_id: organisationId,
          reviewed_by: user.id,
          action: 'superseded',
        })
      if (eventErr) {
        console.error(`[publish] superseded event insert failed for SOP ${sopId}:`, eventErr)
      }
    }
  } catch (err) {
    console.error(`[publish] review-clock reset threw for SOP ${sopId}:`, err)
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

  // 5. Phase 26.5 D-04 — fire-and-forget agent-metadata regeneration.
  //    Never awaited, never affects the response — a failed synthesis
  //    never fails the publish (mirrors step 4's video auto-queue shape).
  triggerAgentSynthesis(sopId, organisationId)

  return NextResponse.json({
    success: true,
    pipelineAutoQueued: 'enqueued' in queueResult,
  })
}
