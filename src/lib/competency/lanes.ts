/**
 * ADR-0019 -- which training lane a person sits in for one SOP. Plain module so the rule is
 * testable and one copy only. Signed off wins; an open assessment request comes next; then the
 * competency ladder. Refresher and version flags never move anyone (Phase 36 D-04).
 */
import type { CompetencyState } from './classify'

export type LaneKey = 'none' | 'read' | 'obs' | 'wait' | 'signed'

export const LANES: ReadonlyArray<{ key: LaneKey; name: string; sub: string }> = [
  { key: 'none', name: 'Not started', sub: 'hasn’t run it yet' },
  { key: 'read', name: 'Read it', sub: 'ran it on their own' },
  { key: 'obs', name: 'Observed', sub: 'watched doing it' },
  { key: 'wait', name: 'Waiting for you', sub: 'asked to be signed off' },
  { key: 'signed', name: 'Signed off', sub: 'competent' },
]

export const LANE_INDEX: Record<LaneKey, number> = { none: 0, read: 1, obs: 2, wait: 3, signed: 4 }

export function laneFor(state: CompetencyState, hasOpenRequest: boolean): LaneKey {
  if (state === 'competent_signed_off') return 'signed'
  if (hasOpenRequest) return 'wait'
  if (state === 'supervised') return 'obs'
  if (state === 'read') return 'read'
  return 'none'
}
