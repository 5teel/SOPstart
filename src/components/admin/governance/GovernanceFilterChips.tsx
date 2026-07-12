import Link from 'next/link'

export type GovernanceFilter = 'all' | 'overdue' | 'due_soon' | 'unowned' | 'stale_role'

const CHIPS: { label: string; value: GovernanceFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due soon', value: 'due_soon' },
  { label: 'Unowned', value: 'unowned' },
  { label: 'Stale-role', value: 'stale_role' },
]

export function GovernanceFilterChips({
  active,
  counts,
}: {
  active: GovernanceFilter
  counts: Record<GovernanceFilter, number>
}) {
  return (
    <div className="flex gap-1 border-b border-[var(--ink-100)] mb-6 overflow-x-auto">
      {CHIPS.map((chip) => {
        const isActive = active === chip.value
        return (
          <Link
            key={chip.value}
            href={chip.value === 'all' ? '/admin/governance' : `/admin/governance?filter=${chip.value}`}
            className="tab"
            data-active={isActive ? 'true' : undefined}
          >
            {chip.label} <span className="mono text-[11px] text-[var(--ink-500)]">({counts[chip.value]})</span>
          </Link>
        )
      })}
    </div>
  )
}
