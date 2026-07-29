import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import { performPublish, assertPublishGates } from '@/lib/governance/publish-core'

// POST /api/sops/[sopId]/publish — transition draft -> published
//
// Phase 29 Plan 01 — steps 2 through 5 (unapproved-sections gate,
// verify-checklist gate, status flip, review-clock reset, video auto-queue,
// agent synthesis) were relocated VERBATIM into performPublish()
// (src/lib/governance/publish-core.ts).
//
// Phase 29 Plan 02 — chain-gate divert (D29-03). LOCKED ORDERING: assertPublishGates()
// runs BEFORE any pending-approval divert, so an SOP with unapproved sections or
// unverified blocks can NEVER enter pending_approval, chain or no chain
// (plan-checker Blocker 1). performPublish() still re-runs the identical gates
// internally at final-approval time (RESEARCH Pitfall 6, closed for free by the
// shared extraction) — this is an EXTRA up-front check via the SAME shared
// function, never a duplicated gate implementation.
//
// If the SOP's category has an approval_chains row, the SOP is diverted into
// approval_state='pending' with a snapshot of the chain's current steps, WITHOUT
// publishing. No-chain categories fall through to performPublish() exactly as
// before — the no-chain response shape is BYTE-IDENTICAL to the pre-Phase-29 route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params

  // 1. Resolve user + org for downstream auto-queue call
  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }

  // Chain-gate: assertPublishGates() FIRST (locked ordering, D29-03) — before
  // any approval_chains lookup or pending divert.
  const gate = await assertPublishGates(supabase, sopId)
  if (!gate.ok) {
    const gateBody = gate.count !== undefined ? { error: gate.error, count: gate.count } : { error: gate.error }
    return NextResponse.json(gateBody, { status: gate.status })
  }

  const { data: sopRow } = await supabase
    .from('sops')
    .select('category_slug, approval_state')
    .eq('id', sopId)
    .maybeSingle()

  // approval_chains is not yet in database.types.ts — (as any) cast matches
  // the sop_review_cadences/ai_model_settings precedent (RESEARCH Pitfall 4).
  // Phase 40 DAT-01: this is the SECOND category-keyed settings table (the
  // first is sop_review_cadences). Its `category` column keeps its name/type
  // (00045 schema unchanged) — only the values change, from free text to a
  // SOP_CATEGORIES slug, via plan 40-06's backfill.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chainRow } = await (supabase as any)
    .from('approval_chains')
    .select('steps')
    .eq('organisation_id', organisationId)
    .eq('category', sopRow?.category_slug ?? '')
    .maybeSingle()

  if (chainRow?.steps?.length > 0) {
    if (sopRow?.approval_state === 'pending') {
      // Idempotent no-op — a second "request publish" click on an already-pending SOP.
      return NextResponse.json({ success: true, pendingApproval: true, alreadyPending: true })
    }

    const { data: updated } = await supabase
      .from('sops')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ approval_state: 'pending', approval_snapshot: chainRow.steps } as any)
      .eq('id', sopId)
      .eq('status', 'draft')
      .is('approval_state', null)
      .select('id')

    if (!updated || updated.length === 0) {
      return NextResponse.json({ success: true, pendingApproval: true, alreadyPending: true })
    }
    return NextResponse.json({ success: true, pendingApproval: true })
  }

  // No chain configured — falls through to performPublish(), BYTE IDENTICAL to
  // the pre-Phase-29 response shape.
  const result = await performPublish(supabase, { sopId, organisationId, userId })

  if (!result.success) {
    // count is only present for the unverified_blocks 400 — byte-identical
    // to the pre-Phase-29 { error: 'unverified_blocks', count } shape.
    const body = result.count !== undefined ? { error: result.error, count: result.count } : { error: result.error }
    return NextResponse.json(body, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    pipelineAutoQueued: result.pipelineAutoQueued,
  })
}
