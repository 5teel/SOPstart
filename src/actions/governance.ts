'use server'

/**
 * Phase 28: Ownership + Review Lifecycle + Governance Queue — server actions.
 *
 * Exports:
 *  - setSopOwner()        — reassign SOP owner; PLAIN session client (sops rides
 *                            admins_can_update_sops RLS — no service-role needed,
 *                            RESEARCH Pitfall 1); target userId re-verified as an
 *                            organisation_members row in the caller's org (T-28-03-01,
 *                            mirrors setDepartmentOwner in departments.ts)
 *  - confirmSopCurrent()  — one-click "confirm current" (D28-04/REV-04): resets
 *                            last_reviewed_at/review_due_at/last_reviewed_by and
 *                            appends a sop_review_events 'confirmed_current' row
 *  - setReviewCadence()   — writes sop_review_cadences via the SERVICE-ROLE client
 *                            (no authenticated write policy by design, ai_model_settings
 *                            shape); organisation_id sourced ONLY from the caller's JWT,
 *                            never a parameter (T-28-03-02)
 *  - listGovernanceQueue()— composed governance-queue read (Task 2); Phase 29
 *                            Plan 02 additionally computes isCallerNextApprover
 *                            per row (pending rows only) via stepMatchesCaller
 *  - setRefresherInterval()— Phase 36 REF-01/REF-02: sets/clears the per-SOP
 *                            worker refresher interval; PLAIN session client
 *                            (admins_can_update_sops RLS is the real gate,
 *                            same posture as setSopOwner — never
 *                            createAdminClient() here, CLAUDE.md 2026-06-15/26)
 *  - requireAdmin()       — EXPORTED (Phase 29 Plan 02) so src/actions/approvals.ts
 *                            reuses the SAME auth/org/role resolution instead of
 *                            duplicating it
 *
 * All pure math (cadence resolution, due-date computation, flag classification)
 * is imported from src/lib/governance/* — never inlined here (a sync export in a
 * 'use server' file breaks `next build`, CLAUDE.md 2026-06-27).
 *
 * requireAdmin() resolves role + organisation_id via getSessionContext()
 * (local ES256 JWT verify + organisation_members read) — never from client input.
 *
 * sop_review_cadences / sop_review_events are not yet in the generated
 * database.types.ts — accessed via `(supabase as any)` casts, matching the
 * ai_model_settings/departments precedent (RESEARCH Pitfall 4).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionContext } from '@/lib/auth/session-context'
import { resolveCadenceMonths, computeReviewDueDate } from '@/lib/governance/cadences'
import { classifyGovernanceRow, type GovernanceFlag } from '@/lib/governance/classify'
import { resolveNextStepIndex, stepMatchesCaller, type ChainStep } from '@/lib/governance/approvals'
import { getOrgMembers } from '@/actions/assignments'
import { categoryLabel, isValidCategorySlug } from '@/lib/sop-categories'
import type { AppRole } from '@/types/auth'

// Phase 29 Plan 02: requireAdmin() is now EXPORTED (was private) and its ctx
// carries `role` so approvals.ts can reuse it instead of duplicating the
// auth/org/role resolution (ladder rung 2 — don't hand-roll a second
// requireAdmin). Additive change: existing `{ userId, organisationId }`
// destructures are unaffected.
export type AdminCtx = { userId: string; organisationId: string; role: AppRole }

export interface GovernanceRow {
  id: string
  title: string | null
  category_slug: string | null
  status: string
  ownerUserId: string | null
  ownerLabel: string
  reviewDueAt: string | null
  flags: GovernanceFlag[]
  /** Phase 29: true when the CURRENT viewer is the next approver for this
   * row's pending approval chain (stepMatchesCaller against approval_snapshot;
   * always false for non-pending rows). */
  isCallerNextApprover: boolean
}

export async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  if (!organisationId) return { error: 'No organisation found' }
  return { userId, organisationId, role: role as AppRole }
}

/**
 * Reads the caller's org-scoped cadence settings into a category -> months map.
 *
 * Phase 40 DAT-01: `sop_review_cadences.category` keeps its column name and
 * text type (00043 schema unchanged) -- only the VALUES stored in it change,
 * from the old free-text `sops.category` string to a `SOP_CATEGORIES` slug.
 * Plan 40-06's backfill remaps existing rows with the same mapping applied
 * to `sops`. The map key below is therefore a slug, not free text.
 */
async function fetchOrgCadences(organisationId: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sop_review_cadences')
    .select('category, months')
    .eq('organisation_id', organisationId)

  if (error) {
    console.error('[fetchOrgCadences] read error', error)
    return {}
  }

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ category: string; months: number }>) {
    result[row.category] = row.months
  }
  return result
}

// ---------------------------------------------------------------------------
// setSopOwner — OWN-02, T-28-03-01
// ---------------------------------------------------------------------------

export async function setSopOwner(
  sopId: string,
  userId: string | null,
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // T-28-03-01: verify userId is an organisation_members row for the SAME org
  // (never trust a client-supplied userId to belong to this org — mirrors
  // setDepartmentOwner in src/actions/departments.ts).
  if (userId !== null) {
    const regularSupabase = await createClient()
    const { data: member } = await regularSupabase
      .from('organisation_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organisation_id', ctx.organisationId)
      .maybeSingle()

    if (!member) return { error: 'Owner must be a member of this organisation' }
  }

  // Plain session client — admins_can_update_sops RLS (org + admin/safety_manager
  // role) already gates this write. Do NOT use the service-role client here (Pitfall 1).
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('sops')
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', sopId)
    .select('id')

  if (error) {
    console.error('[setSopOwner] update error', error)
    return { error: error.message }
  }
  // 0 rows means RLS filtered it out (SOP in another org / missing id) — the
  // write was a no-op, so don't report success (LR-01).
  if (!updated || updated.length === 0) {
    return { error: 'SOP not found' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// setRefresherInterval — REF-01/REF-02, T-36-03-01/02/03
// ---------------------------------------------------------------------------

export async function setRefresherInterval(
  sopId: string,
  months: number | null,
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // null clears the interval (D-02 — turns the refresher OFF for this SOP:
  // no due-date, no chip, no rollup contribution). Otherwise range-validate.
  if (months !== null) {
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      return { error: 'months must be an integer between 1 and 120' }
    }
  }

  // Plain session client — admins_can_update_sops RLS (org + admin/safety_manager
  // role) already gates this write. Do NOT use the service-role client here
  // (T-36-03-01, mirrors setSopOwner).
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('sops')
    .update({ refresher_interval_months: months, updated_at: new Date().toISOString() })
    .eq('id', sopId)
    .select('id')

  if (error) {
    console.error('[setRefresherInterval] update error', error)
    return { error: error.message }
  }
  // 0 rows means RLS filtered it out (SOP in another org / missing id) — the
  // write was a no-op, so don't report success (LR-01, T-36-03-03).
  if (!updated || updated.length === 0) {
    return { error: 'SOP not found' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// confirmSopCurrent — D28-04/REV-04
// ---------------------------------------------------------------------------

export async function confirmSopCurrent(
  sopId: string,
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()
  const { data: sopRow, error: sopErr } = await supabase
    .from('sops')
    .select('category_slug')
    .eq('id', sopId)
    .maybeSingle()

  if (sopErr || !sopRow) {
    console.error('[confirmSopCurrent] load error', sopErr)
    return { error: 'SOP not found' }
  }

  const orgCadences = await fetchOrgCadences(ctx.organisationId)
  const months = resolveCadenceMonths(sopRow.category_slug, orgCadences)
  const now = new Date().toISOString()
  const reviewDue = computeReviewDueDate(now, months)

  const { error: updateErr } = await supabase
    .from('sops')
    .update({
      last_reviewed_at: now,
      review_due_at: reviewDue,
      last_reviewed_by: ctx.userId,
      updated_at: now,
    })
    .eq('id', sopId)

  if (updateErr) {
    console.error('[confirmSopCurrent] update error', updateErr)
    return { error: updateErr.message }
  }

  // Append-only audit event — rides sop_review_events_insert_admin RLS
  // (reviewed_by = auth.uid(), organisation_id = current org).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: eventErr } = await (supabase as any)
    .from('sop_review_events')
    .insert({
      sop_id: sopId,
      organisation_id: ctx.organisationId,
      reviewed_by: ctx.userId,
      action: 'confirmed_current',
    })

  if (eventErr) {
    console.error('[confirmSopCurrent] event insert error', eventErr)
    return { error: eventErr.message }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// setReviewCadence — D28-03/REV-01, T-28-03-02
// ---------------------------------------------------------------------------

export async function setReviewCadence(
  category: string,
  months: number,
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  if (!category || typeof category !== 'string') return { error: 'category required' }
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    return { error: 'months must be an integer between 1 and 120' }
  }
  // Phase 40 DAT-01: gate the incoming value against the fixed vocabulary so a
  // free-text cadence key can never be minted after the migration (T-40-05-04).
  if (!isValidCategorySlug(category)) return { error: 'unknown category' }

  // sop_review_cadences has NO authenticated write policy by design — writes
  // go through the service-role client, self-enforcing org scope from the
  // JWT-derived ctx.organisationId ONLY, never a function parameter (T-28-03-02,
  // mirrors setAiModelSetting in src/actions/ai-settings.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { error } = await admin.from('sop_review_cadences').upsert(
    {
      organisation_id: ctx.organisationId,
      category,
      months,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organisation_id,category' },
  )

  if (error) {
    console.error('[setReviewCadence] upsert error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// listGovernanceQueue — GQ-01/GQ-02/GQ-03, D28-02/D28-05/D28-06
// Single composed read: sops + organisation_members + sop_departments ->
// departments, each row mapped through the pure classifyGovernanceRow.
// Scoped to departments ONLY for stale-role detection — sub-trade tags have no
// admin rename path, nothing to detect there (RESEARCH Pitfall 3).
// ---------------------------------------------------------------------------

export async function listGovernanceQueue(): Promise<
  { success: true; rows: GovernanceRow[] } | { error: string }
> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()

  // RLS (org_members_can_view_sops) already scopes this to the caller's org.
  // Phase 29: approval_state/approval_snapshot/version added for the
  // awaiting_approval flag + per-row isCallerNextApprover computation.
  const { data: sops, error: sopsErr } = await supabase
    .from('sops')
    .select(
      'id, title, category_slug, status, owner_user_id, review_due_at, last_reviewed_at, approval_state, approval_snapshot, version',
    )
    .order('review_due_at', { ascending: true, nullsFirst: false })

  if (sopsErr) {
    console.error('[listGovernanceQueue] sops read error', sopsErr)
    return { error: sopsErr.message }
  }

  const sopRows = sops ?? []
  const sopIds = sopRows.map((s) => s.id)

  // Active-member lookup (OWN-03/D28-02) — absence means unowned; removeMember
  // hard-deletes the organisation_members row, so there is no other
  // "deactivated" state to model.
  const { data: memberRows } = await supabase
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', ctx.organisationId)
  const memberSet = new Set((memberRows ?? []).map((m) => m.user_id))

  // sop_departments / departments are not yet in database.types.ts — (as any)
  // casts match the departments.ts/ai-settings.ts precedent (Pitfall 4).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sopDeptRows } = sopIds.length > 0
    ? await (supabase as any)
        .from('sop_departments')
        .select('sop_id, department_id')
        .in('sop_id', sopIds)
    : { data: [] }
  const deptIdsBySop: Record<string, string[]> = {}
  for (const r of (sopDeptRows ?? []) as Array<{ sop_id: string; department_id: string }>) {
    ;(deptIdsBySop[r.sop_id] ??= []).push(r.department_id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deptRows } = await (supabase as any)
    .from('departments')
    .select('id, updated_at')
    .eq('organisation_id', ctx.organisationId)
  const deptMap = new Map(
    ((deptRows ?? []) as Array<{ id: string; updated_at: string }>).map((d) => [d.id, d.updated_at]),
  )

  // Phase 29: only pending-approval rows need the extra sop_approvals query —
  // skip it entirely for non-pending rows (plan-mandated optimisation).
  const pendingSopIds = sopRows.filter((s) => s.approval_state === 'pending').map((s) => s.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingApprovalRows } = pendingSopIds.length > 0
    ? await (supabase as any)
        .from('sop_approvals')
        .select('sop_id, step_index')
        .in('sop_id', pendingSopIds)
        .eq('action', 'approved')
    : { data: [] }
  const approvedIndexesBySop: Record<string, Set<number>> = {}
  for (const r of (pendingApprovalRows ?? []) as Array<{ sop_id: string; step_index: number }>) {
    ;(approvedIndexesBySop[r.sop_id] ??= new Set()).add(r.step_index)
  }

  // Reuse the existing member-list fetcher (assignments.ts) rather than
  // hand-rolling a second "list org members" query (RESEARCH Don't Hand-Roll).
  const membersResult = await getOrgMembers()
  const ownerLabelById: Record<string, string> = {}
  if (membersResult.success) {
    for (const m of membersResult.members) {
      ownerLabelById[m.user_id] = m.email ?? m.full_name ?? `${m.role} (${m.user_id.slice(0, 8)})`
    }
  }

  const rows: GovernanceRow[] = sopRows.map((sop) => {
    const taggedDeptIds = deptIdsBySop[sop.id] ?? []
    const danglingDepartmentRefs = taggedDeptIds.some((id) => !deptMap.has(id))
    // NULL-GUARD REQUIRED (plan-checker WARNING-1): last_reviewed_at is null
    // for every backfilled/never-confirmed SOP — an unguarded comparison would
    // spuriously flag nearly every department-tagged SOP as stale_role.
    const departmentRenamedSinceReview = sop.last_reviewed_at
      ? taggedDeptIds.some((id) => {
          const updatedAt = deptMap.get(id)
          return updatedAt ? new Date(updatedAt) > new Date(sop.last_reviewed_at as string) : false
        })
      : false

    const ownerIsActiveMember = sop.owner_user_id ? memberSet.has(sop.owner_user_id) : false

    // Phase 29: awaiting_approval flag (visible to every admin) + per-viewer
    // isCallerNextApprover (only meaningful for pending rows) — computed via
    // the SAME resolveNextStepIndex/stepMatchesCaller pure resolver used by
    // src/actions/approvals.ts, never a duplicated ad-hoc comparison.
    const hasPendingApproval = sop.approval_state === 'pending'
    let isCallerNextApprover = false
    if (hasPendingApproval) {
      const snapshot = (sop.approval_snapshot as unknown as ChainStep[]) ?? []
      const approvedIndexes = approvedIndexesBySop[sop.id] ?? new Set<number>()
      const nextIndex = resolveNextStepIndex(snapshot.length, approvedIndexes)
      isCallerNextApprover =
        nextIndex !== -1 && stepMatchesCaller(snapshot[nextIndex], { userId: ctx.userId, role: ctx.role })
    }

    const flags = classifyGovernanceRow({
      reviewDueAt: sop.review_due_at,
      ownerUserId: sop.owner_user_id,
      ownerIsActiveMember,
      danglingDepartmentRefs,
      departmentRenamedSinceReview,
      hasPendingApproval,
    })

    return {
      id: sop.id,
      title: sop.title,
      category_slug: categoryLabel(sop.category_slug),
      status: sop.status,
      ownerUserId: sop.owner_user_id,
      ownerLabel: sop.owner_user_id ? (ownerLabelById[sop.owner_user_id] ?? 'No owner') : 'No owner',
      reviewDueAt: sop.review_due_at,
      flags,
      isCallerNextApprover,
    }
  })

  return { success: true, rows }
}
