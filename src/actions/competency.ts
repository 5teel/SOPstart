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
 *
 * Phase 36 (CMP-03/REF-01/REF-02): evidence is fetched LINEAGE-WIDE — every
 * sop_id across a required SOP's version lineage — via resolveLineage(),
 * then remapped onto the canonical (current) required sop id before it
 * reaches the pure layer (matrix.ts/classify.ts never learn about versions).
 * This closes the evidence-orphaning gap where a worker who trained on a
 * since-superseded version would otherwise read as `not_started` the
 * instant the SOP is republished (RESEARCH Pitfall 1).
 */
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyCompetency, type CompetencyState } from '@/lib/competency/classify'
import { resolveLineage } from '@/lib/competency/lineage'
import { isOutdatedVersion } from '@/lib/competency/version-currency'
import { refresherDueDate, isRefresherOverdue } from '@/lib/competency/refresher'
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

// Lineage resolver (CMP-03 — RESEARCH Pitfall 1) lives in
// '@/lib/competency/lineage' (imported above): a plain module, NOT this
// 'use server' file, because every async export here is a POST-invokable
// server-action endpoint for any authenticated client (Phase 36 review
// WR-07 — the 2026-07-05 parameter-trusting class one refactor away).
// tests/phase36/version-currency-lineage.spec.ts imports it from there.

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

  const { data: sopRows } = await admin
    .from('sops')
    .select('id, title, sop_number, version, parent_sop_id, refresher_interval_months')
    .eq('organisation_id', orgId)
    .in('id', sopIds)
  const requiredSopRows = (sopRows ?? []) as Array<{
    id: string
    title: string
    sop_number: string | null
    version: number | null
    parent_sop_id: string | null
    refresher_interval_months: number | null
  }>
  const lineage = await resolveLineage(requiredSopRows, admin, orgId)

  const { data: completionRows } = await admin
    .from('sop_completions')
    .select('id, worker_id, sop_id, sop_version, submitted_at')
    .eq('organisation_id', orgId)
    .in('worker_id', personIds)
    .in('sop_id', lineage.allSopIds)

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
      .in('sop_id', lineage.allSopIds),
  ])

  const names = await resolveDisplayNames(personIds)
  const people: MatrixPerson[] = personIds.map(id => ({ id, displayName: names[id] ?? 'Unknown' }))
  const sops: MatrixSop[] = requiredSopRows.map(s => ({
    id: s.id,
    title: s.title,
    sopNumber: s.sop_number,
    currentVersion: lineage.currentVersionBySopId.get(s.id) ?? null,
    refresherIntervalMonths: lineage.refresherIntervalBySopId.get(s.id) ?? null,
  }))
  const completions: MatrixCompletion[] = ((completionRows ?? []) as Array<{ id: string; worker_id: string; sop_id: string; sop_version: number; submitted_at: string }>)
    .map(c => {
      const canonicalSopId = lineage.canonicalBySopId.get(c.sop_id)
      if (!canonicalSopId) return null
      return {
        id: c.id,
        workerId: c.worker_id,
        sopId: canonicalSopId,
        sopVersion: c.sop_version,
        submittedAt: c.submitted_at,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
  const signOffs: MatrixSignOff[] = ((signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string }>).map(s => ({
    completionId: s.completion_id,
    decision: s.decision,
    createdAt: s.created_at,
  }))
  const observations: MatrixObservation[] = ((observationRows ?? []) as Array<{ observed_worker_id: string; sop_id: string; verdict: string; created_at: string }>)
    .map(o => {
      const canonicalSopId = lineage.canonicalBySopId.get(o.sop_id)
      if (!canonicalSopId) return null
      return {
        observedWorkerId: o.observed_worker_id,
        sopId: canonicalSopId,
        verdict: o.verdict,
        createdAt: o.created_at,
      }
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)

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
  isOutdatedVersion: boolean
  refresherDueAt: string | null
  isRefresherOverdue: boolean
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

  const { data: requiredSopRows } =
    requiredSopIds.length > 0
      ? await admin
          .from('sops')
          .select('id, title, sop_number, version, parent_sop_id, refresher_interval_months')
          .eq('organisation_id', orgId)
          .in('id', requiredSopIds)
      : { data: [] }
  const requiredSops_ = (requiredSopRows ?? []) as Array<{
    id: string
    title: string
    sop_number: string | null
    version: number | null
    parent_sop_id: string | null
    refresher_interval_months: number | null
  }>
  const lineage = await resolveLineage(requiredSops_, admin, orgId)

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

  // Pre-supersede evidence (a completion/observation against an old lineage
  // member) is remapped onto the canonical (current) required sop id here —
  // this is the fix for the orphaning bug (RESEARCH Pitfall 1): the row
  // itself was never missing, only mis-grouped under a dead sop_id.
  const canonicalSopId = (id: string): string => lineage.canonicalBySopId.get(id) ?? id

  const otherSopIds = Array.from(new Set(completions.map(c => canonicalSopId(c.sop_id)))).filter(id => !requiredSopIdSet.has(id))
  const { data: otherSopRows } =
    otherSopIds.length > 0
      ? await admin.from('sops').select('id, title, sop_number').eq('organisation_id', orgId).in('id', otherSopIds)
      : { data: [] }
  const sopById = new Map<string, { title: string; sop_number: string | null }>([
    ...requiredSops_.map(s => [s.id, { title: s.title, sop_number: s.sop_number }] as const),
    ...((otherSopRows ?? []) as Array<{ id: string; title: string; sop_number: string | null }>).map(
      s => [s.id, { title: s.title, sop_number: s.sop_number }] as const
    ),
  ])

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
    const key = canonicalSopId(c.sop_id)
    if (!completionsBySop.has(key)) completionsBySop.set(key, [])
    completionsBySop.get(key)!.push(c)
  }
  const observationsBySop = new Map<string, typeof observations>()
  for (const o of observations) {
    const key = canonicalSopId(o.sop_id)
    if (!observationsBySop.has(key)) observationsBySop.set(key, [])
    observationsBySop.get(key)!.push(o)
  }

  const nowIso = new Date().toISOString()

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

    // Refresher clock is the latest COMPLETION, not the latest sign-off or
    // positive observation (D-03).
    const latestCompletion = sopCompletions.reduce<(typeof sopCompletions)[number] | null>((latest, c) => {
      if (!latest || c.submitted_at > latest.submitted_at) return c
      return latest
    }, null)
    const dueAt = refresherDueDate(latestCompletion?.submitted_at ?? null, lineage.refresherIntervalBySopId.get(sopId) ?? null)

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
      isOutdatedVersion: isOutdatedVersion(latestCompletion?.sop_version ?? null, lineage.currentVersionBySopId.get(sopId) ?? null),
      refresherDueAt: dueAt,
      isRefresherOverdue: isRefresherOverdue(dueAt, nowIso),
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
  isOutdatedVersion: boolean
  refresherDueAt: string | null
  isRefresherOverdue: boolean
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

  // Widened to version/parent_sop_id/refresher_interval_months for the
  // Phase 36 lineage resolve below (org_members_can_view_sops grants every
  // org member SELECT on every sop row in their org, superseded versions
  // included — so the session client can see lineage members without an
  // admin client; this preserves the self-scoped/no-admin-client posture).
  const { data: sopRows } = await supabase
    .from('sops')
    .select('id, title, version, parent_sop_id, refresher_interval_months')
    .in('id', requiredSopIds)
  const sopById = new Map(
    ((sopRows ?? []) as Array<{ id: string; title: string; version: number | null; parent_sop_id: string | null; refresher_interval_months: number | null }>).map(
      s => [s.id, s]
    )
  )

  // The member_departments / sop_access_people self-read RLS branches span
  // ALL the caller's organisations; the sops read above IS org-RLS-scoped.
  // Intersecting confines the requirement set to the active org — otherwise
  // a multi-org user sees foreign-org requirements as phantom "Untitled SOP"
  // rows permanently stuck at not_started.
  const scopedSopIds = requiredSopIds.filter(id => sopById.has(id))
  if (scopedSopIds.length === 0) return []

  // RLS already org-scopes this read (session client, no admin client) —
  // orgId is null here on purpose (see resolveLineage's doc comment).
  const lineage = await resolveLineage(
    scopedSopIds.map(id => sopById.get(id)!),
    supabase,
    null
  )
  const canonicalSopId = (id: string): string => lineage.canonicalBySopId.get(id) ?? id

  const { data: completionRows } = await supabase
    .from('sop_completions')
    .select('id, sop_id, sop_version, submitted_at')
    .eq('worker_id', userId)
    .in('sop_id', lineage.allSopIds)
  const completions = ((completionRows ?? []) as Array<{ id: string; sop_id: string; sop_version: number; submitted_at: string }>).map(c => ({
    ...c,
    sop_id: canonicalSopId(c.sop_id),
  }))

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
    .in('sop_id', lineage.allSopIds)
  const observations = ((observationRows ?? []) as Array<{ sop_id: string; verdict: string; created_at: string }>).map(o => ({
    ...o,
    sop_id: canonicalSopId(o.sop_id),
  }))

  const signOffByCompletion = new Map(signOffs.map(s => [s.completion_id, s]))
  const nowIso = new Date().toISOString()

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

    // Refresher clock is the latest COMPLETION (D-03).
    const latestCompletion = sopCompletions.reduce<(typeof sopCompletions)[number] | null>((latest, c) => {
      if (!latest || c.submitted_at > latest.submitted_at) return c
      return latest
    }, null)
    const dueAt = refresherDueDate(latestCompletion?.submitted_at ?? null, lineage.refresherIntervalBySopId.get(sopId) ?? null)

    return {
      sopId,
      sopTitle: sopById.get(sopId)?.title ?? 'Untitled SOP',
      state: result.state,
      needsSupportFlag: result.needsSupportFlag,
      awaitingSignOff: result.awaitingSignOff,
      isOutdatedVersion: isOutdatedVersion(latestCompletion?.sop_version ?? null, lineage.currentVersionBySopId.get(sopId) ?? null),
      refresherDueAt: dueAt,
      isRefresherOverdue: isRefresherOverdue(dueAt, nowIso),
    }
  })
}

// ---------------------------------------------------------------
// getVersionCompletionBreakdown (TRN-03) — per-version completion counts +
// worker lists for the versions page (D-09). Gated to the STRICTER
// ['admin', 'safety_manager'] boundary the versions page already enforces
// (uploadNewVersion/cloneSopAsDraft in versioning.ts) — deliberately NOT
// RECORDER_ROLES, which also grants 'supervisor': widening who can see
// version/approval history is a product decision CONTEXT does not make
// (RESEARCH Open Question 1). Read-only: never writes, never gates
// anything, not referenced from any worker-facing file.
// ---------------------------------------------------------------
export interface VersionCompletionBreakdown {
  sopId: string
  versions: Array<{
    sopId: string
    version: number
    isCurrent: boolean
    completionCount: number
    workers: Array<{ userId: string; displayName: string; completedAt: string }>
  }>
}

export async function getVersionCompletionBreakdown(
  sopId: string
): Promise<{ breakdown: VersionCompletionBreakdown } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) return { error: 'Not authorized' }
  if (!organisationId) return { error: 'No organisation' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, userId, organisationId)
  if (!orgId) return { error: 'No organisation' }

  // Never trust a client-supplied sopId — verify it belongs to the caller's
  // org BEFORE any further read (T-36-06-01).
  const { data: sopRow } = await admin
    .from('sops')
    .select('id, version, parent_sop_id, refresher_interval_months')
    .eq('id', sopId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (!sopRow) return { error: 'SOP not found in this organisation' }

  const lineage = await resolveLineage([sopRow], admin, orgId)

  const { data: lineageSopRows } = await admin
    .from('sops')
    .select('id, version')
    .eq('organisation_id', orgId)
    .in('id', lineage.allSopIds)
  const versionBySopId = new Map(((lineageSopRows ?? []) as Array<{ id: string; version: number }>).map(s => [s.id, s.version]))

  const { data: completionRows } = await admin
    .from('sop_completions')
    .select('worker_id, sop_id, submitted_at')
    .eq('organisation_id', orgId)
    .in('sop_id', lineage.allSopIds)
  const completions = (completionRows ?? []) as Array<{ worker_id: string; sop_id: string; submitted_at: string }>

  // Grouped by the ACTUAL sop_id (per-version reporting) — NOT remapped
  // through canonicalBySopId, which the matrix/record reads use instead.
  const completionsBySop = new Map<string, typeof completions>()
  for (const c of completions) {
    if (!completionsBySop.has(c.sop_id)) completionsBySop.set(c.sop_id, [])
    completionsBySop.get(c.sop_id)!.push(c)
  }

  const names = await resolveDisplayNames(completions.map(c => c.worker_id))

  const versions = lineage.allSopIds
    .map(id => {
      const version = versionBySopId.get(id)
      if (version === undefined) return null
      const rows = completionsBySop.get(id) ?? []
      // One worker entry per distinct worker (dedupe multiple completion
      // events against the same version), keeping the latest completion.
      const latestByWorker = new Map<string, string>()
      for (const r of rows) {
        const existing = latestByWorker.get(r.worker_id)
        if (!existing || r.submitted_at > existing) latestByWorker.set(r.worker_id, r.submitted_at)
      }
      const workers = Array.from(latestByWorker.entries()).map(([workerId, completedAt]) => ({
        userId: workerId,
        displayName: names[workerId] ?? 'Unknown',
        completedAt,
      }))
      return {
        sopId: id,
        version,
        isCurrent: version === sopRow.version,
        completionCount: workers.length,
        workers,
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.version - a.version)

  return { breakdown: { sopId, versions } }
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
  if (sopId) {
    // WR-05: widen the SOP filter across the whole version lineage — the
    // matrix cut is lineage-widened, so a per-SOP export must include the
    // same pre-supersede completions the matrix shows (D-16: both entry
    // points export the same evidence the UI renders).
    const { data: filterSop } = await admin
      .from('sops')
      .select('id, version, parent_sop_id, refresher_interval_months')
      .eq('id', sopId)
      .eq('organisation_id', orgId)
      .maybeSingle()
    if (!filterSop) return { error: 'SOP not found in this organisation' }
    const filterLineage = await resolveLineage(
      [filterSop as { id: string; version: number | null; parent_sop_id: string | null; refresher_interval_months: number | null }],
      admin,
      orgId
    )
    query = query.in('sop_id', filterLineage.allSopIds)
  }
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
    admin
      .from('sops')
      .select('id, title, sop_number, version, parent_sop_id, refresher_interval_months')
      .eq('organisation_id', orgId)
      .in('id', sopIds),
  ])
  const signOffs = (signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string; supervisor_id: string }>
  const sopRowsTyped = (sopRows ?? []) as Array<{
    id: string
    title: string
    sop_number: string | null
    version: number | null
    parent_sop_id: string | null
    refresher_interval_months: number | null
  }>
  const sopById = new Map(sopRowsTyped.map(s => [s.id, s]))
  const signOffByCompletion = new Map(signOffs.map(s => [s.completion_id, s]))
  // sopIds here is keyed on the DISTINCT sop_ids present in the completion
  // result, which after a supersede includes superseded rows — resolve each
  // completion's lineage context through the SAME resolveLineage() helper
  // (no second lineage query) rather than re-deriving version currency here.
  const lineage = await resolveLineage(sopRowsTyped, admin, orgId)

  const names = await resolveDisplayNames([...workerIdsInResult, ...signOffs.map(s => s.supervisor_id)])

  const rows: TrainingCsvRow[] = completions.map(c => {
    const sop = sopById.get(c.sop_id)
    const signOff = signOffByCompletion.get(c.id)
    // The completion's own sop row can itself be superseded — resolve its
    // canonical (current) lineage entry first, falling back to the
    // completion's own sop row when no canonical mapping exists.
    const canonicalSopId = lineage.canonicalBySopId.get(c.sop_id) ?? c.sop_id
    const currentVersionForThisLineage = lineage.currentVersionBySopId.get(canonicalSopId) ?? sop?.version ?? null
    const intervalForThisLineage = lineage.refresherIntervalBySopId.get(canonicalSopId) ?? sop?.refresher_interval_months ?? null
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
      onCurrentVersion: !isOutdatedVersion(c.sop_version, currentVersionForThisLineage),
      refresherDueDate: refresherDueDate(c.submitted_at, intervalForThisLineage),
    }
  })

  return { csv: generateTrainingCsv(rows), filename }
}
