'use client'

/**
 * Phase 25: Department chip component — three variants.
 *
 * Variant 'department': renders a colour swatch + department name.
 *   - bg: var(--paper-2), border: var(--ink-300)
 *   - 7px×7px swatch (border-radius: 2px) coloured with dept.colour
 *   - Optional showOwnerStar appends ' ★' (team surface, D-03)
 *
 * Variant 'all-departments': org-wide marker. Cyan accent (var(--accent-mcu)).
 *   - bg: rgba(6,182,212,0.06), border: var(--accent-mcu)
 *   - '◇ All departments' text — NO colour swatch
 *
 * Variant 'add': dashed blue '＋' button for opening the dept picker popover.
 *   - bg: rgba(59,130,246,0.04), border: dashed var(--accent-step)
 *   - min-width/height 44px for glove-friendly touch targets (PWA requirement)
 *   - Requires onClick prop
 *
 * UI-SPEC contract: 25-UI-SPEC.md §"Cross-Surface: Department Chip Component Contract"
 */

interface DChipProps {
  variant: 'department' | 'all-departments' | 'add'
  /** Required when variant = 'department' */
  department?: { name: string; colour: string }
  /** When true, appends ' ★' to department name (team surface, D-03) */
  showOwnerStar?: boolean
  /** Required when variant = 'add'; called on click */
  onClick?: () => void
}

export function DChip({ variant, department, showOwnerStar, onClick }: DChipProps) {
  if (variant === 'all-departments') {
    return (
      <span
        className="inline-flex items-center gap-1 px-[7px] py-[2px] rounded text-[10px] font-semibold"
        style={{
          color: 'var(--accent-mcu)',
          border: '1px solid var(--accent-mcu)',
          borderRadius: '3px',
          background: 'rgba(6,182,212,0.06)',
        }}
      >
        ◇ All departments
      </span>
    )
  }

  if (variant === 'add') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Add department"
        className="inline-flex items-center justify-center rounded cursor-pointer"
        style={{
          minWidth: '44px',
          minHeight: '44px',
          padding: '2px 7px',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--accent-step)',
          border: '1px dashed var(--accent-step)',
          borderRadius: '3px',
          background: 'rgba(59,130,246,0.04)',
        }}
      >
        ＋
      </button>
    )
  }

  // variant === 'department'
  if (!department) return null

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        padding: '2px 7px',
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--ink-700)',
        border: '1px solid var(--ink-300)',
        borderRadius: '3px',
        background: 'var(--paper-2)',
      }}
    >
      {/* 7×7px colour swatch */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '2px',
          flexShrink: 0,
          background: department.colour,
        }}
      />
      {department.name}{showOwnerStar ? ' ★' : ''}
    </span>
  )
}
