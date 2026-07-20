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
import { RecordObservationSchema, ObservationLabelsSchema } from '@/lib/validators/observations'

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

export async function setObservationLabels(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = ObservationLabelsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid label input' }
  }

  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'Only admins and safety managers can rename observation labels.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const current = await getObservationLabels()
  const labels = {
    performed_to_sop: parsed.data.performed_to_sop ?? current.performed_to_sop,
    needs_support: parsed.data.needs_support ?? current.needs_support,
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

// ---------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------

const RECORDER_ROLES = ['supervisor', 'admin', 'safety_manager']

export interface ObservationRow {
  id: string
  sopId: string
  sopTitle: string | null
  sopVersion: number
  verdict: string
  note: string | null
  observerName: string
  createdAt: string
}

async function resolveDisplayNames(userIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  const ids = Array.from(new Set(userIds))
  if (ids.length === 0) return names

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) {
    if (ids.includes(u.id) && u.email) names[u.id] = u.email
  }
  return names
}

async function mapObservationRows(rows: any[]): Promise<ObservationRow[]> {
  const observerNames = await resolveDisplayNames(rows.map((r) => r.observed_by).filter(Boolean))
  return rows.map((r) => ({
    id: r.id,
    sopId: r.sop_id,
    sopTitle: r.sops?.title ?? null,
    sopVersion: r.sop_version,
    verdict: r.verdict,
    note: r.note,
    observerName: (r.observed_by && observerNames[r.observed_by]) || 'Unknown',
    createdAt: r.created_at,
  }))
}

// Self-scoped: the worker's own observation history (OBS-02, /profile).
export async function listObservationsForWorker(): Promise<ObservationRow[]> {
  const { supabase, userId } = await getSessionContext()
  if (!userId) return []

  const { data, error } = await (supabase as any)
    .from('sop_observations')
    .select('id, sop_id, sop_version, verdict, note, observed_by, created_at, sops(title)')
    .eq('observed_worker_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return mapObservationRows(data)
}

// Org-scoped: observation history for an arbitrary worker (person panel).
// Gated to recorder roles — RLS already confines rows to the caller's org.
export async function listObservationsForPerson(workerId: string): Promise<ObservationRow[]> {
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) return []
  if (!role || !RECORDER_ROLES.includes(role)) return []

  const { data, error } = await (supabase as any)
    .from('sop_observations')
    .select('id, sop_id, sop_version, verdict, note, observed_by, created_at, sops(title)')
    .eq('observed_worker_id', workerId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return mapObservationRows(data)
}

export interface WorkerSopOption {
  id: string
  title: string | null
  code: string | null
  assigned: boolean
}

// Org's published SOPs, sorted assigned-first for the given worker (D-06).
// Sourced from sop_assignments (individual + role rows) — no new
// "required SOPs" data source (34-RESEARCH Open Question 1).
//
// Gated to recorder roles: the caller is always a supervisor/admin/safety_manager
// recording ON BEHALF OF the observed worker (workerId), never the worker
// themselves.
export async function listWorkerSopsForPicker(workerId: string): Promise<WorkerSopOption[]> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId || !organisationId) return []
  if (!role || !RECORDER_ROLES.includes(role)) return []

  const { data: sops, error: sopsError } = await supabase
    .from('sops')
    .select('id, title, sop_number')
    .eq('organisation_id', organisationId)
    .eq('status', 'published')

  if (sopsError || !sops) return []

  // org_members_can_view_own_org already permits any org member to read
  // this row — unlike sop_assignments below, this query is not the
  // defective policy and stays on the session client.
  const { data: workerMember } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', workerId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  // sop_assignments RLS (00007 workers_can_view_own_assignments) only
  // exposes rows matching the CALLER's own id/role, never the observed
  // worker's — so for a supervisor caller these reads are always empty via
  // the session client. Use the admin client, self-enforcing org scope on
  // both queries (CLAUDE.md 2026-06-15 pattern), keyed to the OBSERVED
  // worker's id/role, never the caller's.
  const admin = createAdminClient()

  const { data: individual } = await admin
    .from('sop_assignments')
    .select('sop_id')
    .eq('organisation_id', organisationId)
    .eq('user_id', workerId)
    .eq('assignment_type', 'individual')

  let roleAssigned: { sop_id: string }[] = []
  if (workerMember?.role) {
    const { data } = await admin
      .from('sop_assignments')
      .select('sop_id')
      .eq('organisation_id', organisationId)
      .eq('role', workerMember.role)
      .eq('assignment_type', 'role')
    roleAssigned = data ?? []
  }

  const assignedIds = new Set([
    ...(individual ?? []).map((a) => a.sop_id),
    ...roleAssigned.map((a) => a.sop_id),
  ])

  return sops
    .map((s) => ({
      id: s.id,
      title: s.title,
      code: s.sop_number,
      assigned: assignedIds.has(s.id),
    }))
    .sort((a, b) => Number(b.assigned) - Number(a.assigned))
}
