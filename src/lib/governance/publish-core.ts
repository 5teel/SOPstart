import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { triggerAgentSynthesis } from '@/lib/agent-layer/synthesis'
import { resolveCadenceMonths, computeReviewDueDate } from '@/lib/governance/cadences'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSopCollectionsForOrg } from '@/lib/org-model/sop-collections'
import { recordDecision } from '@/lib/decisions/record'

// ------------------------------------------------------------
// Phase 29 D29-03/Pattern 4 — performPublish() is the SINGLE relocated
// source of publish truth. Its body is the pre-Phase-29 publish route's
// steps 2 through 5, moved essentially verbatim so both the no-chain route
// path and Plan 29-02's approveStep final-step branch call the IDENTICAL
// code — this is what makes APR-01's "byte-identical no-chain path" and
// APR-04's "same publish logic completes automatically" both literally true,
// not just similar-looking. Do NOT duplicate any gate logic elsewhere
// (RESEARCH anti-pattern).
//
// assertPublishGates() factors the step / tick / open-finding checks out so
// Plan 29-02's chain-gate can run the SAME gates BEFORE diverting an SOP into pending_approval (locked D29-03 ordering).
//
// This is a plain module (no 'use server') — importable by both the API
// route and future server actions.
// ------------------------------------------------------------

type Supabase = SupabaseClient<Database>

export type PublishGateResult =
  | { ok: true }
  | { ok: false; error: string; status: number; count?: number }

export type PerformPublishResult =
  | { success: true }
  | { success: false; error: string; status: number; count?: number }

/**
 * Phase 58 D-16: the one publish gate, for every SOP. Three counts, no bypass:
 * at least one focus step, every focus step ticked, no open AI finding.
 */
export async function assertPublishGates(supabase: Supabase, sopId: string): Promise<PublishGateResult> {
  const { count: total, error: totalErr } = await supabase
    .from('sop_focus_steps')
    .select('*', { count: 'exact', head: true })
    .eq('sop_id', sopId)

  if (totalErr) {
    return { ok: false, error: 'Failed to check steps', status: 500 }
  }

  if (!total) {
    return { ok: false, error: 'no_steps', status: 400, count: 0 }
  }

  const { count: unticked, error: tickErr } = await supabase
    .from('sop_focus_steps')
    .select('*', { count: 'exact', head: true })
    .eq('sop_id', sopId)
    .is('verified_by_admin_id', null)

  if (tickErr) {
    return { ok: false, error: 'Failed to check step ticks', status: 500 }
  }

  if (unticked && unticked > 0) {
    return { ok: false, error: 'unverified_steps', status: 400, count: unticked }
  }

  const { count: open, error: findErr } = await supabase
    .from('sop_ai_findings')
    .select('*', { count: 'exact', head: true })
    .eq('sop_id', sopId)
    .is('cleared_at', null)

  if (findErr) {
    return { ok: false, error: 'Failed to check AI findings', status: 500 }
  }

  if (open && open > 0) {
    return { ok: false, error: 'open_findings', status: 400, count: open }
  }

  return { ok: true }
}

export interface PerformPublishParams {
  sopId: string
  organisationId: string
  userId: string
  /** Set by Plan 29-02's approveStep final-step branch to stamp approval_state
   * in the same UPDATE statement that flips status -> published. Undefined
   * for the no-chain path — the UPDATE is then byte-equivalent to today. */
  approvalState?: 'approved'
}

/**
 * The ONE place `sops.status` flips to 'published' (D29-03). Re-runs the
 * publish gates internally so an SOP edited while a chain was pending still
 * gets validated at final-approval time (RESEARCH Pitfall 6 — closed for
 * free by this shared extraction).
 */
export async function performPublish(
  supabase: Supabase,
  params: PerformPublishParams,
): Promise<PerformPublishResult> {
  const { sopId, organisationId, userId, approvalState } = params

  const gate = await assertPublishGates(supabase, sopId)
  if (!gate.ok) {
    return { success: false, error: gate.error, status: gate.status, count: gate.count }
  }

  // Reload the fields step 3b needs (category_slug, parent_sop_id) — a second
  // lightweight select rather than threading assertPublishGates' internal
  // sopRow out, keeping assertPublishGates' signature exactly as locked.
  // Phase 40 DAT-01: category (free text) -> category_slug (fixed vocabulary).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sopRow } = await (supabase as any)
    .from('sops')
    .select('category_slug, parent_sop_id')
    .eq('id', sopId)
    .maybeSingle()

  // Step 3: Publish. The ONLY functional change from pre-Phase-29 behavior:
  // when approvalState is provided, the same UPDATE also stamps it — when
  // undefined (no-chain path) this UPDATE is byte-equivalent to today.
  const updatePayload: Record<string, unknown> = {
    status: 'published',
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (approvalState) updatePayload.approval_state = approvalState

  const { data: publishedRows, error: publishError } = await supabase
    .from('sops')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq('id', sopId)
    .eq('status', 'draft') // Only publish drafts
    .select('id')

  if (publishError) {
    return { success: false, error: 'Failed to publish SOP', status: 500 }
  }

  // Updating 0 rows is NOT a PostgREST error — a replayed/duplicate publish of
  // an already-published SOP would otherwise fall through and corrupt the audit
  // trail (false 'superseded' event) + reset the review clock without a review
  // (MR-01). Short-circuit before step 3b when nothing transitioned.
  if (!publishedRows || publishedRows.length === 0) {
    return { success: false, error: 'SOP is not a draft', status: 409 }
  }

  // Phase 56 DEC-01: one ledger row per publish. Here (not in the route or in
  // approveStep) so the no-chain route and the final approval step both log it.
  // Fail-soft and outside assertPublishGates, whose body is hash-pinned.
  await recordDecision({
    kind: 'publish',
    subject: { kind: 'sop', id: sopId },
    sopId,
    summary: approvalState ? 'Published the SOP after its approval chain' : 'Published the SOP',
    details: { approval_state: approvalState ?? null, replaces_sop_id: sopRow?.parent_sop_id ?? null },
  })

  // Step 3b: Phase 28 D28-04 — review-clock reset on publish. Non-fatal: the
  //     publish above already succeeded and is never rolled back for this.
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
    const months = resolveCadenceMonths(sopRow?.category_slug ?? null, orgCadences)
    const reviewDue = computeReviewDueDate(publishedAt, months)

    const { error: resetErr } = await supabase
      .from('sops')
      .update({ review_due_at: reviewDue, last_reviewed_at: publishedAt })
      .eq('id', sopId)
    if (resetErr) {
      console.error(`[performPublish] review-clock reset failed for SOP ${sopId}:`, resetErr)
    }

    if (sopRow?.parent_sop_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: eventErr } = await (supabase as any)
        .from('sop_review_events')
        .insert({
          sop_id: sopId,
          organisation_id: organisationId,
          reviewed_by: userId,
          action: 'superseded',
        })
      if (eventErr) {
        console.error(`[performPublish] superseded event insert failed for SOP ${sopId}:`, eventErr)
      }
    }
  } catch (err) {
    console.error(`[performPublish] review-clock reset threw for SOP ${sopId}:`, err)
  }

  // Step 3c: Phase 32 CR-02 — the runtime sop_collections companion write.
  //     Mirrors migration 00047 Steps A/B for this SOP so every published SOP
  //     is reachable by the grant system (collections are the ONLY unit
  //     access_grants can target). Non-fatal like steps 3b/4 — the publish
  //     already succeeded — but logged loudly; the access-view wire-up page
  //     re-runs the same ensure as a second chance.
  try {
    const admin = createAdminClient()
    const ensured = await ensureSopCollectionsForOrg(admin, organisationId, sopId)
    if ('error' in ensured) {
      console.error(`[performPublish] ensureSopCollections failed for SOP ${sopId}:`, ensured.error)
    }
  } catch (err) {
    console.error(`[performPublish] ensureSopCollections threw for SOP ${sopId}:`, err)
  }

  // Step 4: Phase 26.5 D-04 — fire-and-forget agent-metadata regeneration.
  //     Never awaited, never affects the response — a failed synthesis
  //     never fails the publish.
  triggerAgentSynthesis(sopId, organisationId)

  return { success: true }
}
