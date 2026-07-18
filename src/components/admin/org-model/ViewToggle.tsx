'use client'

/**
 * Phase 32-06: shared segmented view switcher — org-model-views.md `.view-toggle`
 * CSS translated verbatim (blueprint-theme.css). Reused for ⊞ Chart / ▤ Columns
 * here and for the ⌇/▦/◉ wiring-view switcher in 32-08 — no view owns private
 * state, the toggle is a pure controlled component.
 */

export interface ViewToggleOption {
  value: string
  label: string
}

interface ViewToggleProps {
  options: ViewToggleOption[]
  value: string
  onChange: (value: string) => void
}

export function ViewToggle({ options, value, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle mono">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={opt.value === value ? 'on' : undefined}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
