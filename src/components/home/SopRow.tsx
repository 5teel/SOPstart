'use client'
/**
 * Phase 63 -- one row of the SOP list (sketch 009 `row`), a .list-row band (ADR-0016). The area colour is the swatch
 * only (ADR-0004 rule 8); the status is information about the person's own history
 * with the SOP, never a to-do (rule 2). Two lines: the title, then one meta line carrying the
 * area (left out under its own area heading), type, minutes and status.
 */
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import type { LibraryRow } from '@/hooks/useLibrary'
import type { RowStatus } from '@/lib/library/status'

/**
 * The status mark, sized and shaped here (ADR-0013): only "waiting" carries a colour (caution amber);
 * the rest are ink, told apart by shape. Green and blue belong to the AS 1319 signs.
 * The map draws the same marks from STATUS_GLYPH (`@/lib/library/status`).
 */
export const DOT: Record<RowStatus['kind'], string> = {
  signed: 'size-2 shrink-0 bg-ink-900',
  waiting: 'size-2 shrink-0 rotate-45 bg-accent-decision',
  updated: 'size-2 shrink-0 rounded-full border border-ink-900',
  stopped: 'size-2 shrink-0 rounded-full bg-ink-900',
}

export function SopRow({
  row,
  selected = false,
  extra = '',
  hideArea = false,
  onOpen,
}: {
  row: LibraryRow
  selected?: boolean
  /** Appended to the meta line, e.g. " · done 3×". */
  extra?: string
  /** The row sits under its own area's heading, so the area is not repeated. */
  hideArea?: boolean
  onOpen(id: string): void
}) {
  const { status } = row
  const qc = useQueryClient()
  // Pointing at a row starts reading its SOP, so Read opens on cached steps (lazy: no bundle cost).
  const warm = () => void import('@/hooks/useReadSop').then((m) => qc.prefetchQuery(m.readSopQuery(row.id))).catch(() => undefined)
  return (
    <button
      type="button"
      data-testid="sop-row"
      data-sop-id={row.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(row.id)}
      onPointerEnter={warm}
      onPointerDown={warm}
      onFocus={warm}
      className="list-row min-h-tap-row"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-reading font-semibold leading-snug text-ink-900">{row.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-label text-meta text-ink-600">
          {!hideArea && <i aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: row.colourVar }} />}
          <span>
            {!hideArea && `${row.areaName} · `}
            {row.type}
            {row.minutes ? ` · ~${row.minutes} min` : ''}
            {extra}
          </span>
          {status && (
            <span data-testid="sop-row-status" className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">·</span>
              <i aria-hidden="true" className={DOT[status.kind]} />
              {status.text}
            </span>
          )}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="list-chev" />
    </button>
  )
}


