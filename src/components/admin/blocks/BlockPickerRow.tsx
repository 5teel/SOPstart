'use client'

import type { Block } from '@/types/sop'

export type BlockPickerRowProps = {
  block: Block
  matchReason: 'exact-tag' | 'prefix-tag' | 'kind-only'
  selected: boolean
  onSelect: () => void
  usageCount?: number
  /** Optional pre-fetched category-slug → display_name lookup (rendered as chip text). */
  categoryDisplayMap?: Record<string, string>
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor(diffMs / day)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function BlockPickerRow({
  block,
  matchReason,
  selected,
  onSelect,
  usageCount = 0,
  categoryDisplayMap,
}: BlockPickerRowProps) {
  const tags = block.category_tags ?? []
  const updatedLabel = formatRelative(block.updated_at)
  const isGlobal = block.organisation_id === null

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`block-picker-row-${block.id}`}
      data-match-reason={matchReason}
      aria-current={selected ? 'true' : undefined}
      className={[
        'w-full text-left px-3 py-2 border rounded-md transition-colors',
        selected
          ? 'bg-steel-700 border-l-4 border-l-brand-yellow border-steel-600'
          : 'bg-steel-900 border-steel-700 hover:bg-steel-800',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-sm text-steel-100 truncate">
          {block.name}
        </span>
        {isGlobal && (
          <span className="text-[10px] uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
            global
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 mb-1">
        {tags.slice(0, 3).map((slug) => (
          <span
            key={slug}
            className="text-[10px] px-1.5 py-0.5 rounded bg-steel-800 text-steel-300 border border-steel-700"
          >
            {categoryDisplayMap?.[slug] ?? slug}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="text-[10px] text-steel-500">+{tags.length - 3}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-steel-500">
        {updatedLabel && <span>Updated {updatedLabel}</span>}
        {usageCount > 0 && <span>used in {usageCount} SOPs</span>}
      </div>
    </button>
  )
}
