/**
 * StatePill — the sketch-05 competency pill vocabulary (Phase 35, CMP-01/04).
 *
 * Purely informational: renders a CompetencyResult as a passive label, never
 * a control. No onClick, no disabled/lock affordance — competency state must
 * never gate worker access (CMP-04 locked north star, guarded mechanically
 * by tests/phase35/no-competency-gate.spec.ts). "Needs support" reads as
 * coaching, not discipline — amber (--accent-decision), never red.
 *
 * Maps CompetencyResult (src/lib/competency/classify.ts) to labels:
 *   competent_signed_off -> "Signed off"        (green,  --accent-signoff)
 *   supervised            -> "Observed ✓"   (blue,   --accent-step)
 *   read + awaitingSignOff -> "Awaiting sign-off" (amber, --accent-decision)
 *   read (not awaiting)   -> "Read only"          (muted, --ink-500)
 *   not_started           -> "Not started"        (muted, --ink-500)
 */
import type { CompetencyResult } from '@/lib/competency/classify'

interface StatePillProps {
  result: Pick<CompetencyResult, 'state' | 'needsSupportFlag' | 'awaitingSignOff'>
}

export function StatePill({ result }: StatePillProps) {
  const { state, needsSupportFlag, awaitingSignOff } = result

  let label: string
  let accentVar: string
  if (state === 'competent_signed_off') {
    label = 'Signed off'
    accentVar = '--accent-signoff'
  } else if (state === 'supervised') {
    label = 'Observed ✓'
    accentVar = '--accent-step'
  } else if (state === 'read' && awaitingSignOff) {
    label = 'Awaiting sign-off'
    accentVar = '--accent-decision'
  } else if (state === 'read') {
    label = 'Read only'
    accentVar = '--ink-500'
  } else {
    label = 'Not started'
    accentVar = '--ink-500'
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="pill" style={{ color: `var(${accentVar})`, borderColor: `var(${accentVar})` }}>
        {label}
      </span>
      {needsSupportFlag && (
        <span className="pill state-pill-support">Needs support</span>
      )}
    </span>
  )
}
