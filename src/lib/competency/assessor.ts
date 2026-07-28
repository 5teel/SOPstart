// ------------------------------------------------------------
// isSignedOffAssessor — the one derived assessor predicate (ASR-01, D-01).
//
// Plain module, deliberately NOT inside src/actions/ and carries no
// server-action directive: every async export of a server-action module is
// registered as a POST-invokable endpoint for any authenticated client.
// This function takes a caller-supplied DB client plus an orgId, so
// exposing it directly would be exactly the parameter-trusting
// service-role hole CLAUDE.md's 2026-07-05 `match_sop_agent_metadata`
// learning warns about. Callers (server actions under src/actions/) import
// it and stay thin async wrappers.
//
// D-01: this predicate IS the assessor registry. There is no designation
// table and there never will be one — "is this person signed off on this
// exact SOP" is derived entirely from the Phase 35 classifier
// (classifyCompetency) plus the Phase 36 lineage resolver (resolveLineage).
// Never fork or re-implement the ladder/reset/lineage logic here; the only
// competency decision this file makes is the final state comparison.
// ------------------------------------------------------------

import { classifyCompetency } from '@/lib/competency/classify'
import { resolveLineage } from '@/lib/competency/lineage'

function latestOf(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null
  return timestamps.reduce((latest, ts) => (ts > latest ? ts : latest))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSignedOffAssessor(personId: string, sopId: string, client: any, orgId: string | null): Promise<boolean> {
  if (!orgId || !personId || !sopId) return false

  const { data: sopRow, error: sopError } = await client
    .from('sops')
    .select('id, version, parent_sop_id, refresher_interval_months')
    .eq('id', sopId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (sopError || !sopRow) return false

  const lineage = await resolveLineage([sopRow], client, orgId)

  const { data: completionRows, error: completionError } = await client
    .from('sop_completions')
    .select('id, sop_id, submitted_at')
    .eq('organisation_id', orgId)
    .eq('worker_id', personId)
    .in('sop_id', lineage.allSopIds)
  if (completionError) return false
  const completions = (completionRows ?? []) as Array<{ id: string; sop_id: string; submitted_at: string }>
  const completionIds = completions.map(c => c.id)

  const [{ data: signOffRows, error: signOffError }, { data: observationRows, error: observationError }] = await Promise.all([
    completionIds.length > 0
      ? client.from('completion_sign_offs').select('completion_id, decision, created_at').in('completion_id', completionIds)
      : Promise.resolve({ data: [], error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from('sop_observations')
      .select('sop_id, verdict, created_at')
      .eq('organisation_id', orgId)
      .eq('observed_worker_id', personId)
      .in('sop_id', lineage.allSopIds),
  ])
  if (signOffError || observationError) return false
  const signOffs = (signOffRows ?? []) as Array<{ completion_id: string; decision: string; created_at: string }>
  const observations = (observationRows ?? []) as Array<{ sop_id: string; verdict: string; created_at: string }>

  // WR-01: no per-completion Map here. completion_sign_offs is append-only
  // and signOffCompletion never checks for an existing row (the
  // `alreadySigned` guard is client-side only), so a completion can carry
  // more than one row — a Map keyed by completion_id keeps only the LAST row
  // in unordered query results, which can shadow an earlier `approved` row
  // with a later `rejected` one and falsely deny a legitimately signed-off
  // assessor. `.some()`/`.filter()` over ALL rows is order-independent and
  // correct. Note: the Map was never providing org/person scoping either —
  // `signOffs` is already restricted by `.in('completion_id', completionIds)`
  // where completionIds come from the org-scoped, person-scoped completions
  // query above — so do not reintroduce a Map as a "missing scope" fix.
  const hasCompletion = completions.length > 0
  const hasSignOff = signOffs.some(s => s.decision === 'approved')
  const hasPerformedToSopObservation = observations.some(o => o.verdict === 'performed_to_sop')
  const latestPositiveEvidenceAt = latestOf([
    ...observations.filter(o => o.verdict === 'performed_to_sop').map(o => o.created_at),
    ...signOffs.filter(s => s.decision === 'approved').map(s => s.created_at),
  ])
  const latestNeedsSupportAt = latestOf(observations.filter(o => o.verdict === 'needs_support').map(o => o.created_at))

  const result = classifyCompetency({
    hasCompletion,
    hasPerformedToSopObservation,
    hasSignOff,
    latestNeedsSupportAt,
    latestPositiveEvidenceAt,
  })

  return result.state === 'competent_signed_off'
}
