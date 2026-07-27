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
 *
 * Phase 36 (CMP-03/REF-01) — two ADDITIONAL sibling chips, both optional and
 * purely informational: "Outdated version" (orange, --accent-voice) when the
 * worker's latest completion predates the SOP's current version, and a
 * refresher chip (amber, --accent-decision — coaching, never
 * --accent-escalate/red) when a refresher interval is set. Neither chip ever
 * changes the primary pill's label/colour/state (D-04) — they are appended,
 * never a demotion (D-05), and never a gate (CMP-04, tests/phase36/
 * no-refresher-gate.spec.ts + this plan's own matrix-chips-and-axis-swap.spec.ts).
 */
import type { CompetencyResult } from '@/lib/competency/classify'

interface StatePillProps {
  result: Pick<CompetencyResult, 'state' | 'needsSupportFlag' | 'awaitingSignOff'> &
    Partial<{ isOutdatedVersion: boolean; refresherDueAt: string | null; isRefresherOverdue: boolean }>
}

function formatNZDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function StatePill({ result }: StatePillProps) {
  const { state, needsSupportFlag, awaitingSignOff, isOutdatedVersion, refresherDueAt, isRefresherOverdue } = result

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
      {isOutdatedVersion && (
        <span
          className="pill"
          style={{
            color: 'var(--accent-voice)',
            borderColor: 'var(--accent-voice)',
            background: 'color-mix(in srgb, var(--accent-voice) 12%, transparent)',
          }}
          title="Trained on a prior version of this SOP — their training record is unchanged"
        >
          Outdated version
        </span>
      )}
      {refresherDueAt && (
        <span
          className="pill"
          style={{
            color: 'var(--accent-decision)',
            borderColor: 'var(--accent-decision)',
            background: 'color-mix(in srgb, var(--accent-decision) 12%, transparent)',
          }}
        >
          {isRefresherOverdue ? 'Refresher overdue' : `Refresher due ${formatNZDate(refresherDueAt)}`}
        </span>
      )}
    </span>
  )
}
