'use client'
/**
 * Phase 63 -- one row of the SOP list (sketch 009 `row`). The area colour is the swatch
 * only (ADR-0004 rule 8); the status line is information about the person's own history
 * with the SOP, never a to-do (rule 2).
 */
import type { LibraryRow } from '@/hooks/useLibrary'
import type { RowStatus } from '@/lib/library/status'

export const DOT: Record<RowStatus['kind'], string> = {
  signed: 'bg-accent-signoff',
  waiting: 'bg-accent-decision',
  updated: 'bg-accent-step',
  stopped: 'bg-ink-900',
}

export function SopRow({
  row,
  selected = false,
  extra = '',
  onOpen,
}: {
  row: LibraryRow
  selected?: boolean
  /** Appended to the meta line, e.g. " · done 3×". */
  extra?: string
  onOpen(id: string): void
}) {
  const { status } = row
  return (
    <button
      type="button"
      data-testid="sop-row"
      data-sop-id={row.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(row.id)}
      className={`flex min-h-tap-row w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-paper-2 ${selected ? 'bg-paper-2' : ''}`}
    >
      <i aria-hidden="true" className="w-1 self-stretch rounded-full" style={{ background: row.colourVar }} />
      <span className="min-w-0 flex-1">
        <span className="block text-reading font-semibold text-ink-900">{row.title}</span>
        <span className="block font-mono text-meta text-ink-500">
          {row.areaName} · {row.type}
          {row.minutes ? ` · ~${row.minutes} min` : ''}
          {extra}
        </span>
        {status && (
          <span data-testid="sop-row-status" className="mt-1 flex items-center gap-1.5 text-ui text-ink-600">
            <i aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[status.kind]}`} />
            {status.text}
          </span>
        )}
      </span>
    </button>
  )
}
