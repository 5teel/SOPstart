'use client'

import { useState } from 'react'
import { nextEnumValue } from './field-map'

/**
 * Pattern B — inline enum chip (UI-SPEC §Field-Editor Contract).
 *
 * Renders the current enum value as a small pill in the block's semantic accent.
 *   - ≤3 options → click cycles to the next value (sketch `cycleSev`).
 *   - >3 options → click opens a tiny anchored menu of the enum values.
 * Selecting commits the chosen value via `onSelect` (the shell routes it through
 * the Zod-validated `commitFieldToContent`). Non-string option values (e.g. the
 * Measurement `voiceEnabled` boolean) are supported — the label is displayed,
 * the raw value is committed.
 *
 * SSR-safe: no window/document/navigator at module load or render (#418).
 */
interface EnumChipProps {
  value: unknown
  options: readonly { value: unknown; label: string }[]
  onSelect: (value: unknown) => void
  accent?: string
  ariaLabel?: string
}

export function EnumChip({ value, options, onSelect, accent, ariaLabel }: EnumChipProps) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  const label = current?.label ?? String(value ?? '—')
  const color = accent ?? 'var(--accent-step, #3b82f6)'
  const cycles = options.length <= 3

  function handleClick() {
    if (cycles) {
      onSelect(nextEnumValue(value, options))
    } else {
      setOpen((o) => !o)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-enum-chip
        aria-label={ariaLabel}
        onClick={handleClick}
        className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium"
        style={{ borderColor: color, color }}
      >
        {label}
      </button>
      {open && !cycles && (
        <span
          role="menu"
          data-enum-menu
          className="absolute left-0 top-full z-20 mt-1 min-w-[8rem] rounded-md border border-[var(--ink-900,#09090b)] bg-[var(--paper,#fafafa)] py-1 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
        >
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(o.value)
                setOpen(false)
              }}
              className="block w-full px-3 py-1 text-left font-mono text-[11px] hover:bg-[var(--paper-2,#f4f4f5)]"
            >
              {o.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
