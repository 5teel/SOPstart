'use client'

import type { Verdict } from '@/lib/validators/observations'

interface VerdictButtonsProps {
  value: Verdict | null
  onChange: (verdict: Verdict) => void
  labels: { performed_to_sop: string; needs_support: string }
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

export function VerdictButtons({ value, onChange, labels }: VerdictButtonsProps) {
  return (
    <div className="flex gap-3">
      {OPTIONS.map(({ verdict, icon, accentVar, subtitle }) => {
        const selected = value === verdict
        return (
          <button
            key={verdict}
            type="button"
            onClick={() => onChange(verdict)}
            aria-pressed={selected}
            className="flex-1 flex flex-col items-center gap-1.5 rounded px-3.5 py-4 text-xs font-bold uppercase tracking-wide transition-colors"
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
