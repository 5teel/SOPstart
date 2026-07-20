'use server'

/**
 * Supervisor observation server actions (Phase 34, OBS-01/02/03).
 *
 * `sop_observations` and `organisations.observation_labels` are not yet in
 * the auto-generated database.types.ts, so both are accessed via
 * `(supabase as any)` / `(admin as any)` casts, matching the departments.ts /
 * org-model.ts / approvals.ts precedent.
 *
 * recordObservation writes with the SESSION client only — RLS (migrations
 * 00052/00053) is the safety mechanism (D-12); no admin client is reached
 * for on the observation insert path.
 */
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecordObservationSchema } from '@/lib/validators/observations'

const DEFAULT_LABELS = {
  performed_to_sop: 'Performed to SOP',
  needs_support: 'Needs support',
}

// ---------------------------------------------------------------
// recordObservation
//
// Inserts an append-only observation row. Server-resolves sop_version
// from sops.version (D-10 — never trust a client-supplied version).
// Uses the SESSION client — RLS is the gate, no createAdminClient here.
// ---------------------------------------------------------------
export async function recordObservation(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = RecordObservationSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!role || !['supervisor', 'admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'Only supervisors, admins and safety managers can record observations.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const { workerId, sopId, verdict, note, completionId } = parsed.data

  const { data: sop, error: sopError } = await supabase
    .from('sops').select('version').eq('id', sopId).single()
  if (sopError || !sop) return { success: false, error: 'SOP not found.' }

  const { error } = await (supabase as any).from('sop_observations').insert({
    organisation_id: organisationId,
    sop_id: sopId,
    sop_version: sop.version,
    observed_worker_id: workerId,
    observed_by: userId,
    verdict,
    note: note ?? null,
    completion_id: completionId ?? null,
  })

  if (error) {
    console.error('recordObservation insert error:', error)
    return { success: false, error: 'Failed to record observation.' }
  }
  return { success: true as const }
}

// ---------------------------------------------------------------
// getObservationLabels / setObservationLabels (D-02)
//
// Per-org renamable display labels for the two canonical verdicts.
// Display-only — canonical values are always the schema keys, never
// derived from these labels.
// ---------------------------------------------------------------
export async function getObservationLabels(): Promise<typeof DEFAULT_LABELS> {
  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId || !organisationId) return DEFAULT_LABELS

  const { data } = await (supabase as any)
    .from('organisations')
    .select('observation_labels')
    .eq('id', organisationId)
    .single()

  return { ...DEFAULT_LABELS, ...(data?.observation_labels ?? {}) }
}

export async function setObservationLabels(input: {
  performed_to_sop?: string
  needs_support?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'Only admins and safety managers can rename observation labels.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const current = await getObservationLabels()
  const labels = {
    performed_to_sop: input.performed_to_sop ?? current.performed_to_sop,
    needs_support: input.needs_support ?? current.needs_support,
  }

  // organisations has no authenticated UPDATE policy (00002_rls_policies.sql
  // only grants SELECT) — use the admin client, self-enforcing org scope
  // (CLAUDE.md 2026-06-15 pattern). organisationId is session-derived, never
  // accepted from client input.
  const admin = createAdminClient()
  const { error } = await (admin as any)
    .from('organisations')
    .update({ observation_labels: labels })
    .eq('id', organisationId)

  if (error) {
    console.error('setObservationLabels update error:', error)
    return { success: false, error: 'Failed to update observation labels.' }
  }
  return { success: true }
}
