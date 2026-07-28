'use client'

import type { Verdict } from '@/lib/validators/observations'

interface VerdictButtonsProps {
  value: Verdict | null
  onChange: (verdict: Verdict) => void
  labels: { performed_to_sop: string; needs_support: string }
  /** Phase 37 ASR-01 (D-08/D-09) — the single verdict to render disabled
   * (always 'performed_to_sop' in practice; needs_support is never gated). */
  blockedVerdict?: Verdict | null
  /** Short reason shown as the disabled button's title/tooltip. */
  blockedHint?: string
}

const OPTIONS: { verdict: Verdict; icon: string; accentVar: string; subtitle: string }[] = [
  {
    verdict: 'performed_to_sop',
    icon: '✓',
    accentVar: '--accent-ok',
    subtitle: 'Watched full task, consistent with procedure',
  },
  {
    verdict: 'needs_support',
    icon: '⚠',
    accentVar: '--accent-decision',
    subtitle: 'Coaching flag — not a disciplinary record',
  },
]

export function VerdictButtons({
  value,
  onChange,
  labels,
  blockedVerdict,
  blockedHint,
}: VerdictButtonsProps) {
  return (
    <div className="flex gap-3">
      {OPTIONS.map(({ verdict, icon, accentVar, subtitle }) => {
        const selected = value === verdict
        const isBlocked = blockedVerdict === verdict
        return (
          <button
            key={verdict}
            type="button"
            onClick={() => {
              if (isBlocked) return
              onChange(verdict)
            }}
            aria-pressed={selected}
            disabled={isBlocked}
            aria-disabled={isBlocked}
            title={isBlocked ? blockedHint : undefined}
            className="flex-1 flex flex-col items-center gap-1.5 rounded px-3.5 py-4 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              border: `1.5px solid var(${accentVar})`,
              color: `var(${accentVar})`,
              background: selected
                ? `color-mix(in srgb, var(${accentVar}) 8%, white)`
                : 'var(--paper)',
            }}
          >
            <span>
              {icon} {labels[verdict]}
            </span>
            <small className="text-[10px] font-normal normal-case tracking-normal text-[var(--ink-500)]">
              {subtitle}
            </small>
          </button>
        )
      })}
    </div>
  )
}
