'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { BlockType } from '@/lib/builder/block-registry'
import type { SectionRenderFamily } from '@/types/sop'
import { GROUPS, homeRows, filterRows, moveHighlight, type InserterRow } from './inserter-model'

/**
 * The paged, context-aware inserter (R3) — a thin React shell over the pure
 * `inserter-model` functions (ported from the sketch's `renderPicker`).
 *
 * HOME = search + smart row + "Fits here" (LANE by `ctx` render-family) + drill
 * rows. ALL = the full grouped catalog. Keyboard: ↑↓ move `.hi`, ↵ insert-or-
 * drill, esc close (or ‹ back from ALL); typing narrows the list. Every label
 * comes from `humanizeBlockType` (never raw PascalCase — P16). Local state only,
 * no route writes on this hot path (CLAUDE.md 2026-05-13).
 *
 * Reuse is delegated OUT to the existing Phase 13 `BlockPicker` via `onOpenReuse`
 * (the picker is a full-screen modal, not a sub-page of this 320px popover).
 */
interface InserterMenuProps {
  /** Section render-family — selects the "Fits here" LANE. */
  ctx: SectionRenderFamily
  /** The block immediately above the cursor — drives the smart row. */
  prevType: BlockType | null
  /** Insert the chosen block type at the cursor. */
  onInsert: (type: BlockType) => void
  onClose: () => void
  /** Opens the dept-scoped Reuse tier (BlockPicker). Row hidden if omitted. */
  onOpenReuse?: () => void
  /** Opens AI-drafting (26.x). Row hidden if omitted — no dead button. */
  onDescribeAI?: () => void
}

export function InserterMenu({
  ctx,
  prevType,
  onInsert,
  onClose,
  onOpenReuse,
  onDescribeAI,
}: InserterMenuProps) {
  const [page, setPage] = useState<'home' | 'all'>('home')
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const rows = useMemo<InserterRow[]>(() => {
    const base =
      page === 'home'
        ? homeRows(ctx, prevType, { hasReuse: !!onOpenReuse, hasAI: !!onDescribeAI })
        : GROUPS.flatMap(([, types]) =>
            types.map((t): InserterRow => ({ kind: 'insert', type: t, label: humanizeBlockType(t) }))
          )
    return filterRows(base, query)
  }, [page, ctx, prevType, query, onOpenReuse, onDescribeAI])

  // Reset highlight when the visible list changes; focus the search each page.
  useEffect(() => {
    setHi(0)
  }, [page, query])
  useEffect(() => {
    inputRef.current?.focus()
  }, [page])

  // Outside-click closes (matches the sketch's document click handler).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  function activate(row: InserterRow) {
    if (row.kind === 'insert') {
      onInsert(row.type)
      onClose()
      return
    }
    if (row.page === 'all') setPage('all')
    else if (row.page === 'reuse') {
      onOpenReuse?.()
      onClose()
    } else if (row.page === 'ai') {
      onDescribeAI?.()
      onClose()
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => moveHighlight(rows.length, h, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => moveHighlight(rows.length, h, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = rows[hi]
      if (r) activate(r)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (page === 'all') setPage('home')
      else onClose()
    }
  }

  // Boundary indices for the calm HOME layout (Fits-here header + nav separator).
  const firstLaneIdx = rows.findIndex((r) => r.kind === 'insert' && !r.smart)
  const firstNavIdx = rows.findIndex((r) => r.kind === 'nav')

  return (
    <div
      ref={rootRef}
      data-inserter-menu
      role="menu"
      onKeyDown={onKeyDown}
      className="w-[320px] overflow-hidden rounded-[10px] border-[1.5px] border-[var(--ink-900,#18181b)] bg-[var(--paper,#fff)] text-[var(--ink-900,#18181b)] shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
    >
      {/* Header — ‹ back appears on the ALL page. */}
      <div className="flex items-center gap-2 border-b border-[var(--ink-100,#e4e4e7)] px-2.5 py-2">
        {page === 'all' && (
          <button
            type="button"
            data-inserter-back
            aria-label="Back"
            onClick={() => setPage('home')}
            className="grid h-6 w-6 place-items-center rounded text-[var(--ink-500,#71717a)] hover:text-[var(--ink-900,#18181b)]"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
          {page === 'all' ? 'All block types' : 'Add a block'}
        </span>
      </div>

      {/* Search / type-to-filter. */}
      <div className="border-b border-[var(--ink-100,#e4e4e7)] px-2.5 py-2">
        <input
          ref={inputRef}
          data-inserter-search
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={page === 'all' ? 'Filter blocks…' : 'Type to filter…'}
          className="w-full rounded border border-[var(--ink-300,#d4d4d8)] px-2 py-1 text-[13px] outline-none focus:border-[var(--accent-step,#3b82f6)]"
        />
      </div>

      {/* Rows. */}
      <div data-inserter-list className="max-h-[360px] overflow-y-auto py-1">
        {rows.length === 0 && (
          <div className="px-3 py-4 text-center text-[12px] text-[var(--ink-500,#71717a)]">
            No matching blocks
          </div>
        )}
        {rows.map((row, i) => (
          <div key={row.kind === 'insert' ? `ins-${row.type}-${i}` : `nav-${row.page}`}>
            {page === 'home' && i === firstLaneIdx && (
              <div className="px-3 pb-1 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500,#71717a)]">
                Fits here
              </div>
            )}
            {page === 'home' && i === firstNavIdx && (
              <div className="my-1 h-px bg-[var(--ink-100,#e4e4e7)]" />
            )}
            <button
              type="button"
              role="menuitem"
              data-inserter-row
              data-row-kind={row.kind}
              onMouseEnter={() => setHi(i)}
              onClick={() => activate(row)}
              className={[
                'flex w-full items-center gap-2 px-3 py-1.5 text-left',
                i === hi ? 'bg-[var(--paper-2,#f4f4f5)]' : '',
                row.kind === 'insert' && row.smart ? 'text-[var(--ai,#7c3aed)]' : '',
                row.kind === 'nav' && row.page === 'ai' ? 'text-[var(--ai,#7c3aed)]' : '',
              ].join(' ')}
            >
              <span className="flex-1 truncate text-[13px]">{row.label}</span>
              {row.kind === 'insert' && row.smart && (
                <span className="shrink-0 font-mono text-[10px] text-[var(--ink-500,#71717a)]">
                  {row.why ? `${row.why} · ` : ''}↵ or Tab
                </span>
              )}
              {row.kind === 'nav' && row.page !== 'ai' && (
                <span className="shrink-0 text-[var(--ink-500,#71717a)]">›</span>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Keyboard hint. */}
      <div className="border-t border-[var(--ink-100,#e4e4e7)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500,#71717a)]">
        ↑↓ move · ↵ insert · esc close
      </div>
    </div>
  )
}
