'use server'

/**
 * Supervisor observation server actions (Phase 34, OBS-01/02/03).
 *
 * `sop_observations` and `organisations.observation_labels` are not yet in
 * the auto-generated database.types.ts, so both are accessed via
 * `(supabase as any)` / `(admin as any)` casts, matching the departments.ts /
 * org-model.ts / approvals.ts precedent.
 *
 * recordObservation writes with the SESSION client — RLS (migrations
 * 00052/00053/00056) is the safety mechanism (D-12). Phase 37 ASR-01 adds
 * one admin-client read on the observation path: the advancing
 * ('performed_to_sop') branch calls isSignedOffAssessor with an admin
 * client for the PREDICATE READ ONLY (see comment at the call site); the
 * insert itself stays on the session client exactly as before.
 */
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { RecordObservationSchema, ObservationLabelsSchema } from '@/lib/validators/observations'
import { isSignedOffAssessor } from '@/lib/competency/assessor'

const DEFAULT_LABELS = {
  performed_to_sop: 'Performed to SOP',
  needs_support: 'Needs support',
}

// ---------------------------------------------------------------
// recordObservation
//
// Inserts an append-only observation row. Server-resolves sop_version
// from sops.version (D-10 — never trust a client-supplied version).
// The INSERT uses the SESSION client — RLS is the write gate. Phase 37
// adds one admin-client PREDICATE READ (isSignedOffAssessor) on the
// performed_to_sop branch only; see the gate comment below for why.
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

  // Phase 37-07 WR-05: sop_observations is append-only, so a foreign or
  // unrelated completionId is unfixable once written — the insert policy's
  // sop_observation_refs_in_org (00057) deliberately covers sop_id and
  // observed_worker_id but NOT completion_id, so this is the only place the
  // gap can be closed. Runs before the ASR-01 predicate read below so an
  // invalid reference is rejected without spending a predicate read. Admin
  // client, not session: sop_completions RLS only returns a supervisor their
  // OWN assigned workers' rows, so a session read would falsely reject
  // legitimate recorders (2026-07-20 "RLS silently EMPTIES a same-org read"
  // class). organisationId and workerId are already session-derived /
  // schema-validated, so the admin client self-enforces its own scope.
  if (completionId) {
    const { data: completionRow } = await createAdminClient()
      .from('sop_completions')
      .select('id')
      .eq('id', completionId)
      .eq('organisation_id', organisationId)
      .eq('worker_id', workerId)
      .eq('sop_id', sopId)
      .maybeSingle()
    if (!completionRow) return { success: false, error: 'Completion not found.' }
  }

  // ASR-01 gate — only the advancing verdict is gated (D-03/D-04
  // branch-before-gate). needs_support is the coaching-not-discipline
  // default (Phase 34 D-01, this phase's D-04) and the higher-frequency
  // write; the predicate is never called for it.
  let isOverride = false
  let overrideReasonToStamp: string | null = null
  if (verdict === 'performed_to_sop') {
    // Admin client for the PREDICATE READ ONLY: isSignedOffAssessor reads
    // sop_completions/completion_sign_offs/sop_observations on the CALLER's
    // own behalf, and RLS on those tables does not reliably return a
    // supervisor's own sign-off rows for other workers — a session-client
    // read would return empty and falsely report a legitimate assessor as
    // blocked (2026-07-20 "RLS silently EMPTIES a same-org read" class,
    // inverted into a false deny). The predicate self-enforces org scope on
    // every query; organisationId here is session-derived, never accepted
    // from client input. The INSERT below stays on the session client — RLS
    // remains the write gate (Phase 34 D-12).
    const assessor = await isSignedOffAssessor(userId, sopId, createAdminClient(), organisationId)
    if (!assessor) {
      if (role === 'admin' || role === 'safety_manager') {
        if (!parsed.data.overrideReason) {
          return { success: false, error: 'ASSESSOR_OVERRIDE_REQUIRED' }
        }
        isOverride = true
        overrideReasonToStamp = parsed.data.overrideReason
      } else {
        return { success: false, error: 'NOT_SIGNED_OFF_ASSESSOR' }
      }
    }
  }

  const { error } = await (supabase as any).from('sop_observations').insert({
    organisation_id: organisationId,
    sop_id: sopId,
    sop_version: sop.version,
    observed_worker_id: workerId,
    observed_by: userId,
    verdict,
    note: note ?? null,
    completion_id: completionId ?? null,
    is_assessor_override: isOverride,
    override_reason: overrideReasonToStamp,
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

/** Pages through listUsers (the auth admin API pools ALL tenants) until every
 * requested id is resolved or pages are exhausted — a single perPage:1000
 * call silently renders users beyond page 1 as 'Unknown'. */
async function resolveDisplayNames(userIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  const remaining = new Set(userIds.filter(Boolean))
  if (remaining.size === 0) return names

  const admin = createAdminClient()
  for (let page = 1; remaining.size > 0; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of data.users) {
      if (remaining.has(u.id) && u.email) {
        names[u.id] = u.email
        remaining.delete(u.id)
      }
    }
    if (data.users.length < 1000) break
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

// ---------------------------------------------------------------
// Phase 37 ASR-01 — assessor status read, request-assessment write,
// request list (D-08).
// ---------------------------------------------------------------

export interface AssessorStatus {
  isAssessor: boolean
  canOverride: boolean
}

// UX-only up-front read so the UI can disable the advancing control before
// a failed save — Task 2's server-side recomputation in recordObservation
// remains the authority and is never skipped. Fail-closed on any auth/role/
// org failure.
export async function getAssessorStatusForSop(sopId: string): Promise<AssessorStatus> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId || !organisationId || !role || !RECORDER_ROLES.includes(role)) {
    return { isAssessor: false, canOverride: false }
  }
  return {
    isAssessor: await isSignedOffAssessor(userId, sopId, createAdminClient(), organisationId),
    canOverride: role === 'admin' || role === 'safety_manager',
  }
}

// D-08 — a blocked supervisor requests someone assess THEM on this SOP.
// Recipients are the org's admin/safety_manager members (Assumption A1 —
// not a fan-out to every currently-signed-off peer, which would need a
// per-member predicate evaluation).
//
// admins_can_insert_notifications (00009_worker_notifications.sql) only
// permits admin/safety_manager inserts, and the caller here is typically a
// plain SUPERVISOR — a session-client write would be denied with 42501
// (the exact Phase 25 bug, CLAUDE.md 2026-06-15). Use the admin client for
// BOTH the recipient lookup and the insert, self-enforcing org scope by
// deriving organisationId from the session (never from client input) and
// filtering every query on it.
export async function requestAssessorReview(
  sopId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  // Phase 37-07 WR-02: gate before any admin-client work — every sibling
  // action in this file gates on RECORDER_ROLES; this one previously did
  // not, so any authenticated worker could POST-invoke it and spam every
  // admin's notification badge (T-37-07-04).
  if (!role || !RECORDER_ROLES.includes(role)) {
    return { success: false, error: 'Only supervisors, admins and safety managers can request assessment.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()

  // Verify the SOP belongs to this org before inserting — a foreign sopId
  // must not create rows referencing another org's SOP (T-37-03-04).
  const { data: sopRow } = await admin
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!sopRow) return { success: false, error: 'SOP not found.' }

  const { data: recipients } = await admin
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', organisationId)
    .in('role', ['admin', 'safety_manager'])
  if (!recipients || recipients.length === 0) {
    return { success: false, error: 'No admin or safety manager available to request assessment from.' }
  }

  // Dedupe: repeat taps must not spam the list (T-37-03-05).
  const { data: existing } = await (admin as any)
    .from('worker_notifications')
    .select('id')
    .eq('organisation_id', organisationId)
    .eq('sop_id', sopId)
    .eq('subject_user_id', userId)
    .eq('type', 'assessment_requested')
    .eq('read', false)
    .limit(1)
  if (existing && existing.length > 0) return { success: true }

  const rows = recipients.map((r) => ({
    organisation_id: organisationId,
    user_id: r.user_id,
    sop_id: sopId,
    subject_user_id: userId,
    type: 'assessment_requested',
    read: false,
  }))

  const { error } = await (admin as any).from('worker_notifications').insert(rows)
  if (error) {
    console.error('requestAssessorReview insert error:', error)
    return { success: false, error: 'Failed to request assessment.' }
  }
  return { success: true }
}

export interface AssessmentRequest {
  id: string
  sopId: string
  sopTitle: string | null
  subjectUserId: string
  subjectName: string
  createdAt: string
}

// Role-gated to admin/safety_manager — a plain supervisor has no
// assess-others queue. Reads the CALLER's own unread requests with the
// SESSION client: users_see_own_notifications (00009) already scopes to
// user_id = auth.uid() + org — the correct gate, no admin client needed.
export async function listAssessmentRequests(): Promise<AssessmentRequest[]> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId || !organisationId) return []
  if (!role || !['admin', 'safety_manager'].includes(role)) return []

  const { data, error } = await (supabase as any)
    .from('worker_notifications')
    .select('id, sop_id, subject_user_id, created_at, sops(title)')
    .eq('type', 'assessment_requested')
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  const subjectNames = await resolveDisplayNames(data.map((r: any) => r.subject_user_id).filter(Boolean))
  return data.map((r: any) => ({
    id: r.id,
    sopId: r.sop_id,
    sopTitle: r.sops?.title ?? null,
    subjectUserId: r.subject_user_id,
    subjectName: (r.subject_user_id && subjectNames[r.subject_user_id]) || 'Unknown',
    createdAt: r.created_at,
  }))
}
