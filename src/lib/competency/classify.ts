// ------------------------------------------------------------
// classifyCompetency
// Pure helper — derives a person's competency state for one required SOP
// from already-fetched evidence (completions, observations, sign-offs). No
// server-action directive, no I/O, no supabase import — sync export so it
// stays directly unit-testable (2026-06-27 learning: a sync export inside a
// server-action module breaks `next build`). Mirrors the extraction
// discipline of src/lib/governance/classify.ts.
//
// D-01 (highest-evidence-wins ladder, no prerequisite ordering): a sign-off
// alone still yields competent_signed_off — existing signed-off workers are
// never demoted on day one just because no observation row exists yet.
//
// D-02 (needs_support reset): a needs_support observation NEWER than the
// latest positive evidence (sign-off OR performed_to_sop observation) resets
// the state and flags it — the complacency-reset mechanism. The reset floor
// is the highest state the remaining evidence supports: 'read' when a
// completion exists, otherwise 'not_started' (supervised is reachable via
// observation alone — never fabricate a read that never happened). Never
// advances not_started.
// ------------------------------------------------------------

export type CompetencyState = 'not_started' | 'read' | 'supervised' | 'competent_signed_off'

export interface CompetencyEvidence {
  hasCompletion: boolean
  hasPerformedToSopObservation: boolean
  hasSignOff: boolean
  /** Timestamp (ISO) of the latest needs_support observation, if any. */
  latestNeedsSupportAt: string | null
  /** Timestamp (ISO) of the latest positive evidence (sign-off OR performed_to_sop observation). */
  latestPositiveEvidenceAt: string | null
}

export interface CompetencyResult {
  state: CompetencyState
  needsSupportFlag: boolean
  /** Presentation-only: state === 'read' from a completion, no needs_support flag yet — Open Question 1. Not a 5th canonical state. */
  awaitingSignOff: boolean
}

export function classifyCompetency(ev: CompetencyEvidence): CompetencyResult {
  // D-01: highest-evidence-wins ladder, no prerequisite ordering.
  let state: CompetencyState = 'not_started'
  if (ev.hasCompletion) state = 'read'
  if (ev.hasPerformedToSopObservation) state = 'supervised'
  if (ev.hasSignOff) state = 'competent_signed_off'

  // D-02: a needs_support observation newer than the latest positive evidence
  // resets state to the floor the remaining evidence supports — 'read' only
  // if a completion actually happened, else 'not_started' (a worker observed
  // but never completed must not be shown as having read the SOP). Never
  // applies to not_started (nothing to reset).
  let needsSupportFlag = false
  if (
    ev.latestNeedsSupportAt &&
    state !== 'not_started' &&
    (!ev.latestPositiveEvidenceAt || ev.latestNeedsSupportAt > ev.latestPositiveEvidenceAt)
  ) {
    state = ev.hasCompletion ? 'read' : 'not_started'
    needsSupportFlag = true
  }

  const awaitingSignOff = state === 'read' && ev.hasCompletion && !needsSupportFlag

  return { state, needsSupportFlag, awaitingSignOff }
}
