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

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/actions/governance'
import { getOrgMembers } from '@/actions/assignments'
import { resolveNextStepIndex, stepMatchesCaller, type ChainStep } from '@/lib/governance/approvals'
import { performPublish } from '@/lib/governance/publish-core'
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
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const parsed = approvalChainSchema.safeParse({ category, steps })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid approval chain' }
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
  return { success: true }
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
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

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
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// requestChanges — D29-02/Pattern 2
// ---------------------------------------------------------------------------

export async function requestChanges(
  sopId: string,
  comment: string,
): Promise<{ success: true } | { error: string }> {
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

  // approval_snapshot is INTENTIONALLY left in place (Pattern 2/A3) so version
  // history can still resolve step labels after this reject cycle.
  const { error: updateErr } = await supabase
    .from('sops')
    .update({ approval_state: null })
    .eq('id', sopId)
  if (updateErr) return { error: updateErr.message }

  return { success: true }
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
      approverLabelById[m.user_id] = m.email ?? m.full_name ?? `${m.role} (${m.user_id.slice(0, 8)})`
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
