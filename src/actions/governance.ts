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
 *  - listGovernanceQueue()— composed governance-queue read (Task 2)
 *
 * All pure math (cadence resolution, due-date computation, flag classification)
 * is imported from src/lib/governance/* — never inlined here (a sync export in a
 * 'use server' file breaks `next build`, CLAUDE.md 2026-06-27).
 *
 * requireAdmin() reads role + organisation_id from JWT claims via parseJwtPayload
 * (never raw atob, CLAUDE.md 2026-06-26) — never from client input.
 *
 * sop_review_cadences / sop_review_events are not yet in the generated
 * database.types.ts — accessed via `(supabase as any)` casts, matching the
 * ai_model_settings/departments precedent (RESEARCH Pitfall 4).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import { resolveCadenceMonths, computeReviewDueDate } from '@/lib/governance/cadences'

type AdminCtx = { userId: string; organisationId: string }

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const role = claims['user_role'] as string | undefined
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId = claims['organisation_id'] as string | undefined
  if (!organisationId) return { error: 'No organisation found' }
  return { userId: user.id, organisationId }
}

/** Reads the caller's org-scoped cadence settings into a category -> months map. */
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
  // role) already gates this write. Do NOT use createAdminClient here (Pitfall 1).
  const supabase = await createClient()
  const { error } = await supabase
    .from('sops')
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', sopId)

  if (error) {
    console.error('[setSopOwner] update error', error)
    return { error: error.message }
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
    .select('category')
    .eq('id', sopId)
    .maybeSingle()

  if (sopErr || !sopRow) {
    console.error('[confirmSopCurrent] load error', sopErr)
    return { error: 'SOP not found' }
  }

  const orgCadences = await fetchOrgCadences(ctx.organisationId)
  const months = resolveCadenceMonths(sopRow.category, orgCadences)
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
