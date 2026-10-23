'use server'

/**
 * Phase 29: Approval Chains — server actions.
 *
 * Exports:
 *  - setApprovalChain()   — writes approval_chains via the SERVICE-ROLE client
 *                            (no authenticated write policy by design, mirrors
 *                            setReviewCadence in governance.ts); organisation_id
 *                            sourced ONLY from ctx (JWT-derived), never a
 *                            parameter (T-29-02-01)
 *  - getApprovalChains()  — PLAIN session client read, org-scoped RLS
 *  - approveStep()        — PLAIN session client (every caller is guaranteed
 *                            admin/safety_manager by the two D29-05 surfaces —
 *                            RESEARCH Pitfall 1/3 — so admins_can_update_sops
 *                            already covers this write); server-side
 *                            stepMatchesCaller() gate BEFORE insert (T-29-02-02);
 *                            idempotent on 23505; final-step branch calls the
 *                            SAME performPublish() the no-chain publish route
 *                            calls (APR-04)
 *  - requestChanges()     — PLAIN session client; requires a non-empty comment;
 *                            clears approval_state to NULL, leaves
 *                            approval_snapshot in place (Pattern 2/A3)
 *  - getApprovalStatus()  — PLAIN session client read; used by the builder
 *                            publish stage (29-04)
 *  - getApprovalHistory() — PLAIN session client read; resolves approver labels
 *                            via getOrgMembers() (third call site — reuse, not
 *                            hand-rolled) and step labels from approval_snapshot;
 *                            used by the versions page (29-05)
 *
 * All chain-progression math (who's next, does a step match the caller) is
 * imported from src/lib/governance/approvals.ts — never inlined here (a sync
 * export in a 'use server' file breaks `next build`, CLAUDE.md 2026-06-27).
 *
 * requireAdmin() is reused from governance.ts — never duplicated.
 *
 * approval_chains / sop_approvals are not yet in the generated
 * database.types.ts — accessed via `(supabase as any)` casts, matching the
 * sop_review_cadences/sop_review_events precedent (RESEARCH Pitfall 4).
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/actions/governance'
import { getOrgMembers } from '@/actions/assignments'
import { statusSuffix } from '@/lib/members/authority'
import { memberLabel, userLabels } from '@/lib/members/labels'
import { resolveNextStepIndex, stepMatchesCaller, type ChainStep } from '@/lib/governance/approvals'
import { performPublish } from '@/lib/governance/publish-core'
import { recordDecision } from '@/lib/decisions/record'
import { notifyNextApprover } from '@/lib/notifications/write'
import { approvalChainSchema } from '@/lib/validators/approvals'

export interface ApprovalRow {
  id: string
  sopId: string
  version: number
  stepIndex: number
  approverUserId: string | null
  action: 'approved' | 'changes_requested'
  comment: string | null
  createdAt: string
}

export interface ApprovalStatus {
  state: 'pending' | 'approved' | null
  steps: ChainStep[]
  approvals: ApprovalRow[]
  nextStepIndex: number
  isCallerNextApprover: boolean
  version: number
}

export interface ApprovalHistoryRow {
  id: string
  sopId: string
  stepIndex: number
  stepLabel: string
  approverUserId: string | null
  approverLabel: string
  action: 'approved' | 'changes_requested'
  comment: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// setApprovalChain — D29-01, T-29-02-01
// ---------------------------------------------------------------------------

export async function setApprovalChain(
  category: string,
  steps: ChainStep[],
): Promise<{ success: true; logged: boolean } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const parsed = approvalChainSchema.safeParse({ category, steps })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid approval chain' }
  }

  // A chain can only name someone who can act (59 A-02): every person step must be an
  // admin or safety manager of THIS organisation (read under the session's own RLS).
  const personIds = [...new Set(parsed.data.steps.flatMap((st) => (st.userId ? [st.userId] : [])))]
  if (personIds.length > 0) {
    const supabase = await createClient()
    const { data: people } = await supabase
      .from('organisation_members')
      .select('user_id, role')
      .eq('organisation_id', ctx.organisationId)
      .eq('status', 'active')
      .in('user_id', personIds)
    const eligible = new Set(
      (people ?? []).filter((m) => ['admin', 'safety_manager'].includes(m.role as string)).map((m) => m.user_id as string),
    )
    if (personIds.some((id) => !eligible.has(id))) {
      return { error: 'A chain step can only name an admin or safety manager.' }
    }
  }

  // approval_chains has NO authenticated write policy by design — writes go
  // through the service-role client, self-enforcing org scope from the
  // JWT-derived ctx.organisationId ONLY, never a function parameter
  // (T-29-02-01, mirrors setReviewCadence in governance.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { error } = await admin.from('approval_chains').upsert(
    {
      organisation_id: ctx.organisationId,
      category: parsed.data.category,
      steps: parsed.data.steps,
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organisation_id,category' },
  )

  if (error) {
    console.error('[setApprovalChain] upsert error', error)
    return { error: error.message }
  }
  const rec = await recordDecision({
    kind: 'settings_change',
    subject: { kind: 'approval_chain', id: null },
    summary: 'Changed who approves SOPs',
    details: { setting: 'approval_chain', category: parsed.data.category, steps: parsed.data.steps },
  })
  return { success: true, logged: rec.ok }
}

// ---------------------------------------------------------------------------
// getApprovalChains — D29-01
// ---------------------------------------------------------------------------

export async function getApprovalChains(): Promise<
  { success: true; chains: Array<{ category: string; steps: ChainStep[] }> } | { error: string }
> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('approval_chains')
    .select('category, steps')
    .eq('organisation_id', ctx.organisationId)

  if (error) {
    console.error('[getApprovalChains] read error', error)
    return { error: error.message }
  }
  return { success: true, chains: (data ?? []) as Array<{ category: string; steps: ChainStep[] }> }
}

// ---------------------------------------------------------------------------
// approveStep — APR-03/APR-04, T-29-02-02
// ---------------------------------------------------------------------------

export async function approveStep(
  sopId: string,
  comment?: string,
): Promise<{ success: true; logged: boolean; published: boolean } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()
  const { data: sop } = await supabase
    .from('sops')
    .select('id, title, version, approval_state, approval_snapshot')
    .eq('id', sopId)
    .maybeSingle()

  if (!sop || sop.approval_state !== 'pending') return { error: 'No pending approval for this SOP' }
  const steps = (sop.approval_snapshot as unknown as ChainStep[]) ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvedRows } = await (supabase as any)
    .from('sop_approvals')
    .select('step_index')
    .eq('sop_id', sopId)
    .eq('version', sop.version)
    .eq('action', 'approved')

  const approvedIndexes = new Set(((approvedRows ?? []) as Array<{ step_index: number }>).map((r) => r.step_index))
  const nextIndex = resolveNextStepIndex(steps.length, approvedIndexes)
  if (nextIndex === -1) return { error: 'Chain already complete' }
  // Server-side next-approver gate (T-29-02-02) — never trust a client-supplied
  // "I am the next approver" flag.
  if (!stepMatchesCaller(steps[nextIndex], { userId: ctx.userId, role: ctx.role })) {
    return { error: 'Not your turn to approve' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any).from('sop_approvals').insert({
    sop_id: sopId,
    organisation_id: ctx.organisationId,
    version: sop.version,
    step_index: nextIndex,
    approver_user_id: ctx.userId,
    action: 'approved',
    comment: comment ?? null,
  })
  // 23505 = the partial unique index on (sop_id, version, step_index) WHERE
  // action='approved' — a double-click already recorded this approval; treat
  // as an idempotent no-op, not an error.
  if (insertErr && insertErr.code !== '23505') return { error: insertErr.message }

  // Ledger row only for a fresh approval -- a 23505 duplicate click wrote nothing,
  // so there is nothing to log and nothing the caller needs to be told about.
  let logged = true
  if (!insertErr) {
    const rec = await recordDecision({
      kind: 'approve',
      subject: { kind: 'sop', id: sopId },
      sopId,
      summary: `Approved step ${nextIndex + 1} of the approval chain`,
      details: { version: sop.version, step_index: nextIndex, comment: comment ?? null },
    })
    logged = rec.ok

    // D-08: the next step is told it is their turn (a fresh approval only; never fails it).
    if (nextIndex < steps.length - 1) {
      try {
        await notifyNextApprover({
          organisationId: ctx.organisationId,
          sopId,
          sopTitle: sop.title ?? 'a SOP',
          version: sop.version,
          stepIndex: nextIndex + 1,
          step: steps[nextIndex + 1],
          actorId: ctx.userId,
        })
      } catch (err) {
        console.error('[approveStep] next approver notification failed', err)
      }
    }
  }

  let published = false

  if (nextIndex === steps.length - 1) {
    // Final step — auto-complete the publish via the SAME function the
    // no-chain route path calls (APR-04). Not a duplicated inline status flip.
    const result = await performPublish(supabase, {
      sopId,
      organisationId: ctx.organisationId,
      userId: ctx.userId,
      approvalState: 'approved',
    })
    if (!result.success) return { error: result.error }
    published = true
  }

  return { success: true, logged, published }
}

// ---------------------------------------------------------------------------
// reassignApprovalStep -- Phase 64 D-17
// ---------------------------------------------------------------------------

/**
 * Hand the next step of a pending approval to an active admin or safety manager, but only when that
 * step names someone who is no longer an active member (suspended or left): otherwise nothing moves.
 * Session client, like the other approval writes (admins_can_update_sops covers it).
 */
export async function reassignApprovalStep(
  sopId: string,
  userId: string,
): Promise<{ success: true; logged: boolean } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const ids = z.object({ sopId: z.string().uuid(), userId: z.string().uuid() }).safeParse({ sopId, userId })
  if (!ids.success) return { error: 'That is not valid.' }
  // A two-person chain stays two people (64-REVIEW ME-02): the caller can't hand a step to
  // themselves, then approve it.
  if (userId === ctx.userId) return { error: 'Pick someone other than yourself.' }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('organisation_id', ctx.organisationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!target || !['admin', 'safety_manager'].includes(target.role as string)) {
    return { error: 'Pick an admin or safety manager who is still on the site.' }
  }

  const { data: sop } = await supabase
    .from('sops')
    .select('id, version, approval_state, approval_snapshot')
    .eq('id', sopId)
    .maybeSingle()
  if (!sop || sop.approval_state !== 'pending') return { error: 'No pending approval for this SOP' }
  const steps = (sop.approval_snapshot as unknown as ChainStep[]) ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvedRows } = await (supabase as any)
    .from('sop_approvals')
    .select('step_index, approver_user_id')
    .eq('sop_id', sopId)
    .eq('version', sop.version)
    .eq('action', 'approved')
  const approved = (approvedRows ?? []) as Array<{ step_index: number; approver_user_id: string | null }>
  const approvedIndexes = new Set(approved.map((r) => r.step_index))
  const nextIndex = resolveNextStepIndex(steps.length, approvedIndexes)
  if (nextIndex === -1) return { error: 'Chain already complete' }
  // Nor to someone who already approved this version or is named on another step (ME-02).
  if (
    approved.some((r) => r.approver_user_id === userId) ||
    steps.some((st, i) => i !== nextIndex && st.userId === userId)
  ) {
    return { error: 'Pick someone who has not approved this SOP and is not on another step.' }
  }

  const fromUserId = steps[nextIndex].userId
  if (!fromUserId) return { error: 'That step is still with someone who is on the site.' }
  const { data: holder } = await supabase
    .from('organisation_members')
    .select('id')
    .eq('organisation_id', ctx.organisationId)
    .eq('user_id', fromUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (holder) return { error: 'That step is still with someone who is on the site.' }

  const label = memberLabel((await userLabels([userId])).get(userId))
  const next = steps.map((st, i) => (i === nextIndex ? { userId, label } : st))
  const { data: updated, error } = await supabase
    .from('sops')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ approval_snapshot: next } as any)
    .eq('id', sopId)
    .eq('approval_state', 'pending')
    .select('id')
  if (error) {
    console.error('[reassignApprovalStep] update error', error)
    return { error: error.message }
  }
  if (!updated || updated.length === 0) return { error: 'SOP not found' }

  const rec = await recordDecision({
    kind: 'owner_change',
    subject: { kind: 'sop', id: sopId },
    sopId,
    summary: 'Handed an approval step to someone else',
    details: { target: 'approval_step', step_index: nextIndex, from_user_id: fromUserId, to_user_id: userId, version: sop.version },
  })
  return { success: true, logged: rec.ok }
}

// ---------------------------------------------------------------------------
// requestChanges — D29-02/Pattern 2
// ---------------------------------------------------------------------------

export async function requestChanges(
  sopId: string,
  comment: string,
): Promise<{ success: true; logged: boolean } | { error: string }> {
  if (!comment?.trim()) return { error: 'A comment is required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()
  const { data: sop } = await supabase
    .from('sops')
    .select('id, version, approval_state, approval_snapshot')
    .eq('id', sopId)
    .maybeSingle()

  if (!sop || sop.approval_state !== 'pending') return { error: 'No pending approval for this SOP' }
  const steps = (sop.approval_snapshot as unknown as ChainStep[]) ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvedRows } = await (supabase as any)
    .from('sop_approvals')
    .select('step_index')
    .eq('sop_id', sopId)
    .eq('version', sop.version)
    .eq('action', 'approved')

  const approvedIndexes = new Set(((approvedRows ?? []) as Array<{ step_index: number }>).map((r) => r.step_index))
  const nextIndex = resolveNextStepIndex(steps.length, approvedIndexes)
  if (nextIndex === -1) return { error: 'Chain already complete' }
  if (!stepMatchesCaller(steps[nextIndex], { userId: ctx.userId, role: ctx.role })) {
    return { error: 'Not your turn to approve' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any).from('sop_approvals').insert({
    sop_id: sopId,
    organisation_id: ctx.organisationId,
    version: sop.version,
    step_index: nextIndex,
    approver_user_id: ctx.userId,
    action: 'changes_requested',
    comment,
  })
  if (insertErr) return { error: insertErr.message }

  const rec = await recordDecision({
    kind: 'reject',
    subject: { kind: 'sop', id: sopId },
    sopId,
    summary: 'Sent back for changes',
    details: { version: sop.version, step_index: nextIndex, comment },
  })

  // approval_snapshot is INTENTIONALLY left in place (Pattern 2/A3) so version
  // history can still resolve step labels after this reject cycle.
  const { error: updateErr } = await supabase
    .from('sops')
    .update({ approval_state: null })
    .eq('id', sopId)
  if (updateErr) return { error: updateErr.message }

  return { success: true, logged: rec.ok }
}

// ---------------------------------------------------------------------------
// getApprovalStatus — used by the builder publish stage (29-04)
// ---------------------------------------------------------------------------

export async function getApprovalStatus(
  sopId: string,
): Promise<{ success: true; status: ApprovalStatus } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()
  const { data: sop, error: sopErr } = await supabase
    .from('sops')
    .select('id, version, approval_state, approval_snapshot')
    .eq('id', sopId)
    .maybeSingle()

  if (sopErr || !sop) return { error: 'SOP not found' }

  const steps = (sop.approval_snapshot as unknown as ChainStep[]) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvalRows } = await (supabase as any)
    .from('sop_approvals')
    .select('id, sop_id, version, step_index, approver_user_id, action, comment, created_at')
    .eq('sop_id', sopId)
    .eq('version', sop.version)
    .order('created_at', { ascending: true })

  const approvals: ApprovalRow[] = ((approvalRows ?? []) as Array<{
    id: string
    sop_id: string
    version: number
    step_index: number
    approver_user_id: string | null
    action: 'approved' | 'changes_requested'
    comment: string | null
    created_at: string
  }>).map((r) => ({
    id: r.id,
    sopId: r.sop_id,
    version: r.version,
    stepIndex: r.step_index,
    approverUserId: r.approver_user_id,
    action: r.action,
    comment: r.comment,
    createdAt: r.created_at,
  }))

  const approvedIndexes = new Set(approvals.filter((a) => a.action === 'approved').map((a) => a.stepIndex))
  const nextStepIndex = resolveNextStepIndex(steps.length, approvedIndexes)
  const isCallerNextApprover =
    nextStepIndex !== -1 && stepMatchesCaller(steps[nextStepIndex], { userId: ctx.userId, role: ctx.role })

  return {
    success: true,
    status: {
      state: (sop.approval_state as 'pending' | 'approved' | null) ?? null,
      steps,
      approvals,
      nextStepIndex,
      isCallerNextApprover,
      version: sop.version,
    },
  }
}

// ---------------------------------------------------------------------------
// getApprovalHistory — used by the versions page (29-05), D29-06
// ---------------------------------------------------------------------------

export async function getApprovalHistory(
  versionIds: string[],
): Promise<{ success: true; rows: ApprovalHistoryRow[] } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (versionIds.length === 0) return { success: true, rows: [] }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvalRows, error } = await (supabase as any)
    .from('sop_approvals')
    .select('id, sop_id, step_index, approver_user_id, action, comment, created_at')
    .in('sop_id', versionIds)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const { data: sopRows } = await supabase
    .from('sops')
    .select('id, approval_snapshot')
    .in('id', versionIds)

  const snapshotBySopId: Record<string, ChainStep[]> = {}
  for (const s of (sopRows ?? []) as Array<{ id: string; approval_snapshot: unknown }>) {
    snapshotBySopId[s.id] = (s.approval_snapshot as unknown as ChainStep[]) ?? []
  }

  // Reuse getOrgMembers() — third call site for "resolve org member labels",
  // exactly like listGovernanceQueue's ownerLabelById (Don't Hand-Roll).
  const membersResult = await getOrgMembers()
  const approverLabelById: Record<string, string> = {}
  if (membersResult.success) {
    for (const m of membersResult.members) {
      approverLabelById[m.user_id] = statusSuffix(m.email ?? m.full_name ?? `${m.role} (${m.user_id.slice(0, 8)})`, m.status)
    }
  }

  const rows: ApprovalHistoryRow[] = ((approvalRows ?? []) as Array<{
    id: string
    sop_id: string
    step_index: number
    approver_user_id: string | null
    action: 'approved' | 'changes_requested'
    comment: string | null
    created_at: string
  }>).map((r) => {
    const steps = snapshotBySopId[r.sop_id] ?? []
    return {
      id: r.id,
      sopId: r.sop_id,
      stepIndex: r.step_index,
      // Step label resolved from approval_snapshot by index — no redundant
      // `label` column on sop_approvals (RESEARCH Don't Hand-Roll).
      stepLabel: steps[r.step_index]?.label ?? `Step ${r.step_index + 1}`,
      approverUserId: r.approver_user_id,
      approverLabel: r.approver_user_id ? (approverLabelById[r.approver_user_id] ?? 'Unknown') : 'Unknown',
      action: r.action,
      comment: r.comment,
      createdAt: r.created_at,
    }
  })

  return { success: true, rows }
}
