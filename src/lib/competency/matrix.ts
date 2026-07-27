// ------------------------------------------------------------
// buildMatrix
// Pure assembler — takes pre-fetched arrays (people, required-SOP map,
// completions, sign-offs, observations) and maps classifyCompetency() over
// every (person, requiredSop) pair. No I/O, no server-action directive, no
// Supabase client import, and CRITICALLY no import of the grants action
// module or the raw grants table name (MTX-02: requirements come from the
// already-materialized sop_departments/sop_access_people output only — this
// module must never re-derive the inheritance chain a second time). Mirrors
// the pure-assembler discipline of src/lib/org-model/resolve-sop-access.ts.
//
// Phase 36 (CMP-03/REF-01/REF-02): version-currency and refresher-due
// derivations are layered ADDITIVELY on top of the classifyCompetency()
// ladder above — that ladder is untouched (classify.ts is not modified by
// this plan). isOutdatedVersion/refresherDueAt/isRefresherOverdue never
// change `state`, `competentCount`, or `signedOffCount`; they are appended
// tallies, never a demotion or reset (D-04/D-05). `nowIso` is injected via
// BuildMatrixInput (resolved once, not per-cell) so the module stays pure
// and deterministic for tests.
// ------------------------------------------------------------

import { classifyCompetency, type CompetencyState } from './classify'
import { isOutdatedVersion } from './version-currency'
import { refresherDueDate, isRefresherOverdue } from './refresher'

export interface MatrixPerson {
  id: string
  displayName: string
}

export interface MatrixSop {
  id: string
  title: string
  sopNumber: string | null
  currentVersion: number | null
  refresherIntervalMonths: number | null
}

export interface MatrixCompletion {
  id: string
  workerId: string
  sopId: string
  sopVersion: number | null
  submittedAt: string
}

export interface MatrixSignOff {
  completionId: string
  decision: string
  createdAt: string
}

export interface MatrixObservation {
  observedWorkerId: string
  sopId: string
  verdict: string
  createdAt: string
}

export interface BuildMatrixInput {
  people: MatrixPerson[]
  /** personId -> required sop ids (D-10: required SOPs only). */
  requiredSopsByPerson: Record<string, string[]>
  sops: MatrixSop[]
  completions: MatrixCompletion[]
  signOffs: MatrixSignOff[]
  observations: MatrixObservation[]
  /** Phase 36: injected clock for refresher-overdue math; defaults to now. */
  nowIso?: string
}

export interface MatrixCell {
  personId: string
  sopId: string
  state: CompetencyState
  needsSupportFlag: boolean
  awaitingSignOff: boolean
  /** Phase 36 forward-compat (D-05): expose latest completion per pair. */
  latestCompletionAt: string | null
  latestCompletionVersion: number | null
  isOutdatedVersion: boolean
  refresherDueAt: string | null
  isRefresherOverdue: boolean
}

export interface RowRollup {
  personId: string
  total: number
  competentCount: number
  needsSupportCount: number
  outdatedCount: number
  refresherOverdueCount: number
}

export interface ColRollup {
  sopId: string
  total: number
  signedOffCount: number
  needsSupportCount: number
  outdatedCount: number
  refresherOverdueCount: number
}

export interface TrainingMatrix {
  cells: MatrixCell[]
  rowRollups: RowRollup[]
  colRollups: ColRollup[]
}

const POSITIVE_VERDICT = 'performed_to_sop'
const NEEDS_SUPPORT_VERDICT = 'needs_support'
const APPROVED_DECISION = 'approved'

export function buildMatrix(input: BuildMatrixInput): TrainingMatrix {
  const { people, requiredSopsByPerson, sops, completions, signOffs, observations } = input
  const nowIso = input.nowIso ?? new Date().toISOString()

  const sopsById = new Map(sops.map(sop => [sop.id, sop]))
  const approvedCompletionIds = new Set(signOffs.filter(s => s.decision === APPROVED_DECISION).map(s => s.completionId))

  const cells: MatrixCell[] = []
  const rowRollups: RowRollup[] = []
  const colRollupsBySop = new Map<string, ColRollup>()

  for (const person of people) {
    const requiredSopIds = requiredSopsByPerson[person.id] ?? []
    let competentCount = 0
    let needsSupportCount = 0
    let rowOutdatedCount = 0
    let rowRefresherOverdueCount = 0

    for (const sopId of requiredSopIds) {
      const sop = sopsById.get(sopId)
      const personCompletions = completions.filter(c => c.workerId === person.id && c.sopId === sopId)
      const hasCompletion = personCompletions.length > 0
      const hasSignOff = personCompletions.some(c => approvedCompletionIds.has(c.id))

      const personObservations = observations.filter(o => o.observedWorkerId === person.id && o.sopId === sopId)
      const hasPerformedToSopObservation = personObservations.some(o => o.verdict === POSITIVE_VERDICT)

      const latestPositiveObservationAt = latestTimestamp(
        personObservations.filter(o => o.verdict === POSITIVE_VERDICT).map(o => o.createdAt),
      )
      const latestSignOffAt = latestTimestamp(
        signOffs.filter(s => approvedCompletionIds.has(s.completionId) && personCompletions.some(c => c.id === s.completionId)).map(s => s.createdAt),
      )
      const latestPositiveEvidenceAt = latestTimestamp([latestPositiveObservationAt, latestSignOffAt].filter((v): v is string => v !== null))

      const latestNeedsSupportAt = latestTimestamp(
        personObservations.filter(o => o.verdict === NEEDS_SUPPORT_VERDICT).map(o => o.createdAt),
      )

      const result = classifyCompetency({
        hasCompletion,
        hasPerformedToSopObservation,
        hasSignOff,
        latestNeedsSupportAt,
        latestPositiveEvidenceAt,
      })

      const latestCompletion = personCompletions.reduce<MatrixCompletion | null>((latest, c) => {
        if (!latest || c.submittedAt > latest.submittedAt) return c
        return latest
      }, null)

      const cellIsOutdated = isOutdatedVersion(latestCompletion?.sopVersion ?? null, sop?.currentVersion ?? null)
      const cellRefresherDueAt = refresherDueDate(latestCompletion?.submittedAt ?? null, sop?.refresherIntervalMonths ?? null)
      const cellIsRefresherOverdue = isRefresherOverdue(cellRefresherDueAt, nowIso)

      cells.push({
        personId: person.id,
        sopId,
        state: result.state,
        needsSupportFlag: result.needsSupportFlag,
        awaitingSignOff: result.awaitingSignOff,
        latestCompletionAt: latestCompletion?.submittedAt ?? null,
        latestCompletionVersion: latestCompletion?.sopVersion ?? null,
        isOutdatedVersion: cellIsOutdated,
        refresherDueAt: cellRefresherDueAt,
        isRefresherOverdue: cellIsRefresherOverdue,
      })

      if (result.state === 'competent_signed_off') competentCount++
      if (result.needsSupportFlag) needsSupportCount++
      if (cellIsOutdated) rowOutdatedCount++
      if (cellIsRefresherOverdue) rowRefresherOverdueCount++

      const colRollup = colRollupsBySop.get(sopId) ?? { sopId, total: 0, signedOffCount: 0, needsSupportCount: 0, outdatedCount: 0, refresherOverdueCount: 0 }
      colRollup.total++
      if (result.state === 'competent_signed_off') colRollup.signedOffCount++
      if (result.needsSupportFlag) colRollup.needsSupportCount++
      if (cellIsOutdated) colRollup.outdatedCount++
      if (cellIsRefresherOverdue) colRollup.refresherOverdueCount++
      colRollupsBySop.set(sopId, colRollup)
    }

    rowRollups.push({
      personId: person.id,
      total: requiredSopIds.length,
      competentCount,
      needsSupportCount,
      outdatedCount: rowOutdatedCount,
      refresherOverdueCount: rowRefresherOverdueCount,
    })
  }

  return { cells, rowRollups, colRollups: Array.from(colRollupsBySop.values()) }
}

function latestTimestamp(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null
  return timestamps.reduce((latest, ts) => (ts > latest ? ts : latest))
}
