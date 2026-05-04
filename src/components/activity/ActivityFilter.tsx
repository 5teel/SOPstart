'use client'

import type { FilterState } from '@/hooks/useCompletions'

interface SopOption {
  id: string
  title: string
}

interface WorkerOption {
  id: string
  name: string
}

interface ActivityFilterProps {
  filter: FilterState
  onChange: (filter: FilterState) => void
  sopOptions: SopOption[]
  workerOptions: WorkerOption[]
  desktop?: boolean
}

export function ActivityFilter({
  filter,
  onChange,
  sopOptions,
  workerOptions,
  desktop = false,
}: ActivityFilterProps) {
  const activeBase =
    'h-[40px] px-4 rounded-xl text-sm font-semibold bg-[var(--ink-900)] text-[var(--paper)] cursor-pointer'
  const inactiveBase =
    'h-[40px] px-4 rounded-xl text-sm font-medium bg-white border border-[var(--ink-100)] text-[var(--ink-500)] hover:text-[var(--ink-900)] hover:border-[var(--ink-300)] transition-colors cursor-pointer'

  const pillRow = desktop ? 'flex flex-col gap-2' : 'flex flex-row gap-2 flex-wrap'

  return (
    <div className="flex flex-col gap-3">
      <div className={pillRow}>
        <button
          type="button"
          className={filter.type === 'all' ? activeBase : inactiveBase}
          onClick={() => onChange({ type: 'all' })}
        >
          All
        </button>
        <button
          type="button"
          className={filter.type === 'by_sop' ? activeBase : inactiveBase}
          onClick={() => onChange({ type: 'by_sop', value: sopOptions[0]?.id ?? '' })}
        >
          By SOP
        </button>
        <button
          type="button"
          className={filter.type === 'by_worker' ? activeBase : inactiveBase}
          onClick={() => onChange({ type: 'by_worker', value: workerOptions[0]?.id ?? '' })}
        >
          By Worker
        </button>
      </div>

      {filter.type === 'by_sop' && sopOptions.length > 0 && (
        <select
          className="h-[48px] w-full bg-white border border-[var(--ink-100)] rounded-xl text-sm text-[var(--ink-900)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--ink-300)]"
          value={'value' in filter ? filter.value : ''}
          onChange={(e) => onChange({ type: 'by_sop', value: e.target.value })}
        >
          {sopOptions.map((sop) => (
            <option key={sop.id} value={sop.id}>
              {sop.title}
            </option>
          ))}
        </select>
      )}

      {filter.type === 'by_worker' && workerOptions.length > 0 && (
        <select
          className="h-[48px] w-full bg-white border border-[var(--ink-100)] rounded-xl text-sm text-[var(--ink-900)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--ink-300)]"
          value={'value' in filter ? filter.value : ''}
          onChange={(e) => onChange({ type: 'by_worker', value: e.target.value })}
        >
          {workerOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      {filter.type === 'by_sop' && sopOptions.length === 0 && (
        <p className="text-xs text-[var(--ink-500)] px-1">No SOPs with completions yet.</p>
      )}
      {filter.type === 'by_worker' && workerOptions.length === 0 && (
        <p className="text-xs text-[var(--ink-500)] px-1">No workers with completions yet.</p>
      )}
    </div>
  )
}
