'use server'

/**
 * Competency server actions (Phase 35, CMP-01/MTX-02/MTX-03/TRN-01/TRN-02).
 *
 * Reads existing evidence (sop_completions, completion_sign_offs,
 * sop_observations) and existing materialized requirement junctions
 * (sop_departments, sop_access_people via member_departments) and maps them
 * through the Wave-1 pure functions (classifyCompetency/buildMatrix/
 * generateTrainingCsv) — never recomputing the ladder inline.
 *
 * `departments`, `member_departments`, `sop_departments`, `sop_access_people`
 * and `sop_observations` are not yet in the auto-generated database.types.ts,
 * so the admin client is used via an `any` cast, matching the
 * departments.ts/org-model.ts/grants.ts/observations.ts precedent.
 *
 * Auth posture (RESEARCH Pitfall 3/4, Assumption A3 — CONFIRMED against
 * migration 00046): sop_access_people's admin/safety_manager RLS branch
 * excludes 'supervisor', so a supervisor caller reading it via the SESSION
 * client would get zero rows (the Phase 34-10 dead-feature class). Every
 * matrix/record/CSV read therefore uses createAdminClient() and
 * self-enforces organisation_id on every path (CLAUDE.md 2026-06-15/26/
 * 2026-07-20 recurring bug class) — RECORDER_ROLES gates BEFORE any read.
 *
 * getMyCompetencyStates is the one exception: self-scoped to auth.uid() via
 * the SESSION client, no admin client, no role gate beyond authentication —
 * every table it touches has a self-read RLS branch (member_departments,
 * sop_access_people, sop_completions, completion_sign_offs, sop_observations
 * all carry a `= auth.uid()` self-read arm).
 */
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyCompetency, type CompetencyState } from '@/lib/competency/classify'
import {
  buildMatrix,
  type MatrixPerson,
  type MatrixSop,
  type MatrixCompletion,
  type MatrixSignOff,
  type MatrixObservation,
  type TrainingMatrix,
} from '@/lib/competency/matrix'
import { generateTrainingCsv, type TrainingCsvRow } from '@/lib/competency/csv'
import { MatrixFiltersSchema, CsvExportFiltersSchema } from '@/lib/validators/competency'

const RECORDER_ROLES = ['supervisor', 'admin', 'safety_manager']

/** Authoritative organisation for the caller, re-derived off organisation_members via the admin client — never the JWT claim alone (grants.ts callerOrgId pattern). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callerOrgId(admin: any, userId: string, sessionOrgId: string | null): Promise<string | null> {
  const { data } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.organisation_id as string | undefined) ?? sessionOrgId
}

/** No full-name field exists anywhere in this codebase — email is the display name everywhere (mirrors observations.ts resolveDisplayNames).
 * Pages through listUsers (the auth admin API pools ALL tenants) until every
 * requested id is resolved or pages are exhausted — a single perPage:1000
 * call silently renders users beyond page 1 as 'Unknown'/'unknown'. */
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

/** dateTo is a YYYY-MM-DD day — make the end bound inclusive of that whole
 * day by comparing `< midnight of the NEXT day` (a bare lte against the date
 * string would silently drop every completion submitted on the To-day). */
function nextDayIso(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function latestOf(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null
  return timestamps.reduce((latest, ts) => (ts > latest ? ts : latest))
}

// ---------------------------------------------------------------
// getTrainingMatrix — department-first cut (D-06), one batched fetch.
// Gated to RECORDER_ROLES (supervisor is the primary matrix persona,
// D-06/MTX-01 — do NOT use requireAdminContext, which excludes supervisor).
// ---------------------------------------------------------------
export async function getTrainingMatrix(
  rawFilters: unknown
): Promise<{ matrix: TrainingMatrix; people: MatrixPerson[]; sops: MatrixSop[] } | { error: string }> {
  const parsed = MatrixFiltersSchema.safeParse(rawFilters)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid filters' }
  const { departmentId, workerId, sopId } = parsed.data

  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !RECORDER_ROLES.includes(role)) return { error: 'Not authorized' }
  if (!organisationId) return { error: 'No organisation' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, userId, organisationId)
  if (!orgId) return { error: 'No organisation' }

  // Verify the target department belongs to the caller's org BEFORE any read
  // (T-35-02-01 — never trust a client-supplied deptId).
  const { data: deptRow } = await admin
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (!deptRow) return { error: 'Department not found in this organisation' }

  const { data: memberRows } = await admin
    .from('member_departments')
    .select('member_id')
    .eq('department_id', departmentId)
  let personIds = ((memberRows ?? []) as Array<{ member_id: string }>).map(m => m.member_id)
  if (workerId) personIds = personIds.filter(id => id === workerId)

  const empty: { matrix: TrainingMatrix; people: MatrixPerson[]; sops: MatrixSop[] } = {
    matrix: { cells: [], rowRollups: [], colRollups: [] },
    people: [],
    sops: [],
  }
  if (personIds.length === 0) return empty

  // Required SOPs: union of dept-required (sop_departments) and
  // person-specific direct grants (sop_access_people) — the ALREADY
  // MATERIALIZED output from Phase 32, never re-derived from access_grants
  // (MTX-02). sop_access_people MUST go via the admin client — its
  // self-read RLS branch excludes 'supervisor' (confirmed 00046 §
  // sop_access_people_self_read).
  const [{ data: deptSopRows }, { data: personSopRows }] = await Promise.all([
    admin.from('sop_departments').select('sop_id').eq('department_id', departmentId),
    admin.from('sop_access_people').select('sop_id, member_id').in('member_id', personIds),
  ])
  const deptSopIdSet = new Set(((deptSopRows ?? []) as Array<{ sop_id: string }>).map(s => s.sop_id))
  const personSopMap = new Map<string, Set<string>>()
  for (const row of (personSopRows ?? []) as Array<{ sop_id: string; member_id: string }>) {
    if (!personSopMap.has(row.member_id)) personSopMap.set(row.member_id, new Set())
    personSopMap.get(row.member_id)!.add(row.sop_id)
  }

  let sopIds = Array.from(new Set([...deptSopIdSet, ...[...personSopMap.values()].flatMap(s => [...s])]))
  if (sopId) sopIds = sopIds.filter(id => id === sopId)
  if (sopIds.length === 0) return empty

  const requiredSopsByPerson: Record<string, string[]> = {}
  for (const personId of personIds) {
    const personSops = new Set<string>([...deptSopIdSet, ...(personSopMap.get(personId) ?? [])])
    requiredSopsByPerson[personId] = sopIds.filter(id => personSops.has(id))
  }

  const [{ data: sopRows }, { data: completionRows }] = await Promise.all([
    admin.from('sops').select('id, title, sop_number').eq('organisation_id', orgId).in('id', sopIds),
    admin
      .from('sop_completions')
      .select('id, worker_id, sop_id, sop_version, submitted_at')
      .eq('organisation_id', orgId)
      .in('worker_id', personIds)
      .in('sop_id', sopIds),
  ])

  const completionIds = ((completionRows ?? []) as Array<{ id: string }>).map(c => c.id)
  const [{ data: signOffRows }, { data: observationRows }] = await Promise.all([
    completionIds.length > 0
      ? admin.from('completion_sign_offs').select('completion_id, decision, created_at').in('completion_id', completionIds)
      : Promise.resolve({ data: [] }),
    admin
      .from('sop_observations')
      .select('observed_worker_id, sop_id, verdict, created_at')
      .eq('organisation_id', orgId)
      .in('observed_worker_id', personIds)
      .in('sop_id', sopIds),
  ])

  const names = await resolveDisplayNames(personIds)
  const people: MatrixPerson[] = personIds.map(id => ({ id, displayName: names[id] ?? 'Unknown' }))
  const sops: MatrixSop[] = ((sopRows ?? []) as Array<{ id: string; title: string; sop_number: string | null }>).map(s => ({
    id: s.id,
    title: s.title,
    sopNumber: s.sop_number,
  }))
  const completions: MatrixCompletion[] = ((completionRows ?? []) as Array<{ id: string; worker_id: string; sop_id: string; sop_version: number; submitted_at: string }>).map(c => ({
    id: c.id,
    workerId: c.worker_id,
    sopId: c.sop_id,
    sopVersion: c.sop_version,
    submittedAt: c.submitted_at,
  }))
  const signOffs: MatrixSignOff[] = ((signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string }>).map(s => ({
    completionId: s.completion_id,
    decision: s.decision,
    createdAt: s.created_at,
  }))
  const observations: MatrixObservation[] = ((observationRows ?? []) as Array<{ observed_worker_id: string; sop_id: string; verdict: string; created_at: string }>).map(o => ({
    observedWorkerId: o.observed_worker_id,
    sopId: o.sop_id,
    verdict: o.verdict,
    createdAt: o.created_at,
  }))

  const matrix = buildMatrix({ people, requiredSopsByPerson, sops, completions, signOffs, observations })
  return { matrix, people, sops }
}

// ---------------------------------------------------------------
// getTrainingRecordForPerson — per-SOP evidence trails (TRN-01, D-12/D-13).
// Same RECORDER_ROLES gate + admin-client + org self-enforce.
// ---------------------------------------------------------------
export interface CompletionEvidence {
  completionId: string
  sopVersion: number
  submittedAt: string
  signOff: { decision: string; createdAt: string; supervisorName: string } | null
}

export interface ObservationEvidence {
  verdict: string
  createdAt: string
  observerName: string
  note: string | null
}

export interface RequiredSopRecord {
  sopId: string
  sopTitle: string
  sopNumber: string | null
  state: CompetencyState
  needsSupportFlag: boolean
  awaitingSignOff: boolean
  completions: CompletionEvidence[]
  observations: ObservationEvidence[]
}

export interface OtherCompletedSop {
  sopId: string
  sopTitle: string
  completions: CompletionEvidence[]
}

export interface TrainingRecord {
  personId: string
  requiredSops: RequiredSopRecord[]
  otherCompletedSops: OtherCompletedSop[]
}

export async function getTrainingRecordForPerson(personId: string): Promise<{ record: TrainingRecord } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !RECORDER_ROLES.includes(role)) return { error: 'Not authorized' }
  if (!organisationId) return { error: 'No organisation' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, userId, organisationId)
  if (!orgId) return { error: 'No organisation' }

  const { data: memberRow } = await admin
    .from('organisation_members')
    .select('user_id')
    .eq('user_id', personId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (!memberRow) return { error: 'Person not found in this organisation' }

  const { data: memberDeptRows } = await admin.from('member_departments').select('department_id').eq('member_id', personId)
  const deptIds = ((memberDeptRows ?? []) as Array<{ department_id: string }>).map(d => d.department_id)

  const [{ data: deptSopRows }, { data: personSopRows }] = await Promise.all([
    deptIds.length > 0
      ? admin.from('sop_departments').select('sop_id').in('department_id', deptIds)
      : Promise.resolve({ data: [] }),
    admin.from('sop_access_people').select('sop_id').eq('member_id', personId),
  ])
  const requiredSopIds = Array.from(
    new Set([
      ...((deptSopRows ?? []) as Array<{ sop_id: string }>).map(s => s.sop_id),
      ...((personSopRows ?? []) as Array<{ sop_id: string }>).map(s => s.sop_id),
    ])
  )
  const requiredSopIdSet = new Set(requiredSopIds)

  const { data: completionRows } = await admin
    .from('sop_completions')
    .select('id, sop_id, sop_version, submitted_at')
    .eq('organisation_id', orgId)
    .eq('worker_id', personId)
    .order('submitted_at', { ascending: false })
  const completions = (completionRows ?? []) as Array<{ id: string; sop_id: string; sop_version: number; submitted_at: string }>

  const completionIds = completions.map(c => c.id)
  const [{ data: signOffRows }, { data: observationRows }] = await Promise.all([
    completionIds.length > 0
      ? admin.from('completion_sign_offs').select('completion_id, decision, created_at, supervisor_id').in('completion_id', completionIds)
      : Promise.resolve({ data: [] }),
    admin
      .from('sop_observations')
      .select('sop_id, verdict, created_at, note, observed_by')
      .eq('organisation_id', orgId)
      .eq('observed_worker_id', personId)
      .order('created_at', { ascending: false }),
  ])
  const signOffs = (signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string; supervisor_id: string }>
  const observations = (observationRows ?? []) as Array<{ sop_id: string; verdict: string; created_at: string; note: string | null; observed_by: string }>

  const allSopIds = Array.from(new Set([...requiredSopIds, ...completions.map(c => c.sop_id)]))
  const { data: sopRows } =
    allSopIds.length > 0
      ? await admin.from('sops').select('id, title, sop_number').eq('organisation_id', orgId).in('id', allSopIds)
      : { data: [] }
  const sopById = new Map(((sopRows ?? []) as Array<{ id: string; title: string; sop_number: string | null }>).map(s => [s.id, s]))

  const names = await resolveDisplayNames([...observations.map(o => o.observed_by), ...signOffs.map(s => s.supervisor_id)])

  const signOffByCompletion = new Map(signOffs.map(s => [s.completion_id, s]))
  function buildCompletionEvidence(rows: typeof completions): CompletionEvidence[] {
    return rows.map(c => {
      const signOff = signOffByCompletion.get(c.id)
      return {
        completionId: c.id,
        sopVersion: c.sop_version,
        submittedAt: c.submitted_at,
        signOff: signOff
          ? { decision: signOff.decision, createdAt: signOff.created_at, supervisorName: names[signOff.supervisor_id] ?? 'Unknown' }
          : null,
      }
    })
  }

  const completionsBySop = new Map<string, typeof completions>()
  for (const c of completions) {
    if (!completionsBySop.has(c.sop_id)) completionsBySop.set(c.sop_id, [])
    completionsBySop.get(c.sop_id)!.push(c)
  }
  const observationsBySop = new Map<string, typeof observations>()
  for (const o of observations) {
    if (!observationsBySop.has(o.sop_id)) observationsBySop.set(o.sop_id, [])
    observationsBySop.get(o.sop_id)!.push(o)
  }

  const requiredSops: RequiredSopRecord[] = requiredSopIds.map(sopId => {
    const sopRow = sopById.get(sopId)
    const sopCompletions = completionsBySop.get(sopId) ?? []
    const sopObservations = observationsBySop.get(sopId) ?? []

    const hasCompletion = sopCompletions.length > 0
    const hasSignOff = sopCompletions.some(c => signOffByCompletion.get(c.id)?.decision === 'approved')
    const hasPerformedToSopObservation = sopObservations.some(o => o.verdict === 'performed_to_sop')
    const latestPositiveEvidenceAt = latestOf([
      ...sopObservations.filter(o => o.verdict === 'performed_to_sop').map(o => o.created_at),
      ...sopCompletions
        .map(c => signOffByCompletion.get(c.id))
        .filter((s): s is NonNullable<typeof s> => !!s && s.decision === 'approved')
        .map(s => s.created_at),
    ])
    const latestNeedsSupportAt = latestOf(sopObservations.filter(o => o.verdict === 'needs_support').map(o => o.created_at))

    const result = classifyCompetency({
      hasCompletion,
      hasPerformedToSopObservation,
      hasSignOff,
      latestNeedsSupportAt,
      latestPositiveEvidenceAt,
    })

    return {
      sopId,
      sopTitle: sopRow?.title ?? 'Untitled SOP',
      sopNumber: sopRow?.sop_number ?? null,
      state: result.state,
      needsSupportFlag: result.needsSupportFlag,
      awaitingSignOff: result.awaitingSignOff,
      completions: buildCompletionEvidence(sopCompletions),
      observations: sopObservations.map(o => ({
        verdict: o.verdict,
        createdAt: o.created_at,
        observerName: names[o.observed_by] ?? 'Unknown',
        note: o.note,
      })),
    }
  })

  // D-13: completions of SOPs outside the required set — still training
  // evidence, excluded from the matrix/rollups.
  const otherCompletedSops: OtherCompletedSop[] = Array.from(completionsBySop.entries())
    .filter(([sopId]) => !requiredSopIdSet.has(sopId))
    .map(([sopId, rows]) => ({
      sopId,
      sopTitle: sopById.get(sopId)?.title ?? 'Untitled SOP',
      completions: buildCompletionEvidence(rows),
    }))

  return { record: { personId, requiredSops, otherCompletedSops } }
}

// ---------------------------------------------------------------
// getMyCompetencyStates — SELF-SCOPED (D-04). Session client only, no
// admin client, no role gate beyond authentication. Every table read here
// has a self-read RLS branch keyed to auth.uid().
// ---------------------------------------------------------------
export interface MyCompetencyState {
  sopId: string
  sopTitle: string
  state: CompetencyState
  needsSupportFlag: boolean
  awaitingSignOff: boolean
}

export async function getMyCompetencyStates(): Promise<MyCompetencyState[]> {
  const { supabase, userId } = await getSessionContext()
  if (!userId) return []

  const { data: memberDeptRows } = await (supabase as any)
    .from('member_departments')
    .select('department_id')
    .eq('member_id', userId)
  const deptIds = ((memberDeptRows ?? []) as Array<{ department_id: string }>).map(d => d.department_id)

  const [{ data: deptSopRows }, { data: personSopRows }] = await Promise.all([
    deptIds.length > 0
      ? (supabase as any).from('sop_departments').select('sop_id').in('department_id', deptIds)
      : Promise.resolve({ data: [] }),
    (supabase as any).from('sop_access_people').select('sop_id').eq('member_id', userId),
  ])
  const requiredSopIds = Array.from(
    new Set([
      ...((deptSopRows ?? []) as Array<{ sop_id: string }>).map(s => s.sop_id),
      ...((personSopRows ?? []) as Array<{ sop_id: string }>).map(s => s.sop_id),
    ])
  )
  if (requiredSopIds.length === 0) return []

  const { data: sopRows } = await supabase.from('sops').select('id, title').in('id', requiredSopIds)
  const sopById = new Map(((sopRows ?? []) as Array<{ id: string; title: string }>).map(s => [s.id, s]))

  // The member_departments / sop_access_people self-read RLS branches span
  // ALL the caller's organisations; the sops read above IS org-RLS-scoped.
  // Intersecting confines the requirement set to the active org — otherwise
  // a multi-org user sees foreign-org requirements as phantom "Untitled SOP"
  // rows permanently stuck at not_started.
  const scopedSopIds = requiredSopIds.filter(id => sopById.has(id))
  if (scopedSopIds.length === 0) return []

  const { data: completionRows } = await supabase
    .from('sop_completions')
    .select('id, sop_id')
    .eq('worker_id', userId)
    .in('sop_id', scopedSopIds)
  const completions = (completionRows ?? []) as Array<{ id: string; sop_id: string }>

  const completionIds = completions.map(c => c.id)
  const { data: signOffRows } =
    completionIds.length > 0
      ? await supabase.from('completion_sign_offs').select('completion_id, decision, created_at').in('completion_id', completionIds)
      : { data: [] }
  const signOffs = (signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string }>

  const { data: observationRows } = await (supabase as any)
    .from('sop_observations')
    .select('sop_id, verdict, created_at')
    .eq('observed_worker_id', userId)
    .in('sop_id', scopedSopIds)
  const observations = (observationRows ?? []) as Array<{ sop_id: string; verdict: string; created_at: string }>

  const signOffByCompletion = new Map(signOffs.map(s => [s.completion_id, s]))

  return scopedSopIds.map(sopId => {
    const sopCompletions = completions.filter(c => c.sop_id === sopId)
    const sopObservations = observations.filter(o => o.sop_id === sopId)

    const hasCompletion = sopCompletions.length > 0
    const hasSignOff = sopCompletions.some(c => signOffByCompletion.get(c.id)?.decision === 'approved')
    const hasPerformedToSopObservation = sopObservations.some(o => o.verdict === 'performed_to_sop')
    const latestPositiveEvidenceAt = latestOf([
      ...sopObservations.filter(o => o.verdict === 'performed_to_sop').map(o => o.created_at),
      ...sopCompletions
        .map(c => signOffByCompletion.get(c.id))
        .filter((s): s is NonNullable<typeof s> => !!s && s.decision === 'approved')
        .map(s => s.created_at),
    ])
    const latestNeedsSupportAt = latestOf(sopObservations.filter(o => o.verdict === 'needs_support').map(o => o.created_at))

    const result = classifyCompetency({
      hasCompletion,
      hasPerformedToSopObservation,
      hasSignOff,
      latestNeedsSupportAt,
      latestPositiveEvidenceAt,
    })

    return {
      sopId,
      sopTitle: sopById.get(sopId)?.title ?? 'Untitled SOP',
      state: result.state,
      needsSupportFlag: result.needsSupportFlag,
      awaitingSignOff: result.awaitingSignOff,
    }
  })
}

// ---------------------------------------------------------------
// exportTrainingCsv — role-gated 'use server' action, NEVER a cookie-less
// route (T-35-02-04). One row per completion event (D-14). Two entry
// points (matrix header cut + PersonPanel single-worker export) call this
// SAME generator (D-16).
// ---------------------------------------------------------------
export async function exportTrainingCsv(rawFilters: unknown): Promise<{ csv: string; filename: string } | { error: string }> {
  const parsed = CsvExportFiltersSchema.safeParse(rawFilters)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid filters' }
  const { departmentId, workerId, sopId, dateFrom, dateTo } = parsed.data

  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !RECORDER_ROLES.includes(role)) return { error: 'Not authorized' }
  if (!organisationId) return { error: 'No organisation' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, userId, organisationId)
  if (!orgId) return { error: 'No organisation' }

  let workerIds: string[] | null = null
  if (workerId) {
    workerIds = [workerId]
  } else if (departmentId) {
    const { data: deptRow } = await admin.from('departments').select('id').eq('id', departmentId).eq('organisation_id', orgId).maybeSingle()
    if (!deptRow) return { error: 'Department not found in this organisation' }
    const { data: memberRows } = await admin.from('member_departments').select('member_id').eq('department_id', departmentId)
    workerIds = ((memberRows ?? []) as Array<{ member_id: string }>).map(m => m.member_id)
  }

  let query = admin
    .from('sop_completions')
    .select('id, worker_id, sop_id, sop_version, submitted_at')
    .eq('organisation_id', orgId)
    .order('submitted_at', { ascending: false })
  if (workerIds) query = query.in('worker_id', workerIds)
  if (sopId) query = query.eq('sop_id', sopId)
  if (dateFrom) query = query.gte('submitted_at', dateFrom)
  if (dateTo) query = query.lt('submitted_at', nextDayIso(dateTo))

  const { data: completionRows, error: completionsErr } = await query
  if (completionsErr) return { error: 'Failed to fetch completions.' }
  const completions = (completionRows ?? []) as Array<{ id: string; worker_id: string; sop_id: string; sop_version: number; submitted_at: string }>

  const filename = `training-records-${new Date().toISOString().slice(0, 10)}.csv`
  if (completions.length === 0) return { csv: generateTrainingCsv([]), filename }

  const completionIds = completions.map(c => c.id)
  const sopIds = Array.from(new Set(completions.map(c => c.sop_id)))
  const workerIdsInResult = Array.from(new Set(completions.map(c => c.worker_id)))

  const [{ data: signOffRows }, { data: sopRows }] = await Promise.all([
    admin.from('completion_sign_offs').select('completion_id, decision, created_at, supervisor_id').in('completion_id', completionIds),
    admin.from('sops').select('id, title, sop_number').eq('organisation_id', orgId).in('id', sopIds),
  ])
  const signOffs = (signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string; supervisor_id: string }>
  const sopById = new Map(((sopRows ?? []) as Array<{ id: string; title: string; sop_number: string | null }>).map(s => [s.id, s]))
  const signOffByCompletion = new Map(signOffs.map(s => [s.completion_id, s]))

  const names = await resolveDisplayNames([...workerIdsInResult, ...signOffs.map(s => s.supervisor_id)])

  const rows: TrainingCsvRow[] = completions.map(c => {
    const sop = sopById.get(c.sop_id)
    const signOff = signOffByCompletion.get(c.id)
    return {
      workerEmail: names[c.worker_id] ?? 'unknown',
      workerName: names[c.worker_id] ?? null,
      sopIdentifier: sop?.sop_number ?? c.sop_id,
      sopTitle: sop?.title ?? 'Untitled SOP',
      sopVersion: c.sop_version,
      completionDate: c.submitted_at,
      signoffStatus: signOff?.decision ?? null,
      signoffBy: signOff ? names[signOff.supervisor_id] ?? 'Unknown' : null,
      signoffDate: signOff?.created_at ?? null,
    }
  })

  return { csv: generateTrainingCsv(rows), filename }
}
