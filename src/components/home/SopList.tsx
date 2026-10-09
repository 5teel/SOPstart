'use client'
/**
 * Phase 63 -- the home's SOP list (sketch 009 A): search, Recent, Most used, and every
 * SOP grouped by Area or Type. A search that finds nothing offers Ask for one, and a SOP
 * admin also gets Write it. Built unmounted; the shell mounts it.
 */
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search, X } from 'lucide-react'
import { SopRow } from '@/components/home/SopRow'
import type { LibraryRow } from '@/hooks/useLibrary'
import { useSopSearch } from '@/hooks/useSopSearch'
import type { LibraryArea } from '@/lib/library/areas'
import { matchesTitle } from '@/lib/library/search'
import { SOP_TYPES } from '@/lib/library/sop-type'

// Ask is a lazy module: it never rides in the home download.
const RequestComposerTrigger = dynamic(
  () => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger),
  { ssr: false, loading: () => null },
)

const LABEL = 'mt-5 mb-1.5 font-label text-micro uppercase tracking-widest text-ink-500'
const GROUP = 'flex w-full items-center justify-between px-2.5 pt-3 pb-0.5 font-label text-meta text-ink-600'

export function SopList({
  rows,
  areas,
  recent,
  mostUsed,
  area,
  selectedId,
  canWrite,
  onOpen,
  onArea,
  trailing,
}: {
  rows: readonly LibraryRow[]
  areas: readonly LibraryArea[]
  recent: readonly LibraryRow[]
  mostUsed: ReadonlyArray<{ row: LibraryRow; count: number }>
  area: string | null
  selectedId: string | null
  canWrite: boolean
  onOpen(id: string): void
  onArea(id: string | null): void
  /** Beside the search box (the bell). */
  trailing?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<'area' | 'type'>('area')
  const { ids: stepHits, pending } = useSopSearch(query, rows.map((r) => r.id))

  const q = query.trim()
  const filtered = !!q || !!area
  const areaName = area ? (areas.find((a) => a.id === area)?.name ?? '') : ''
  const shown = filtered
    ? rows.filter((r) => (!area || r.areaId === area) && (!q || matchesTitle(r, q) || stepHits.has(r.id)))
    : []
  const open = (r: LibraryRow) => (
    <SopRow key={r.id} row={r} selected={r.id === selectedId} onOpen={onOpen} />
  )

  return (
    <div data-testid="sop-list">
      <div className="flex items-center gap-1">
        <div className="flex h-tap min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-300 bg-paper-1 px-3">
          <Search size={16} aria-hidden="true" className="shrink-0 text-ink-500" />
          <input
            data-testid="sop-search"
            aria-label="Search all SOPs, steps and tools"
            placeholder="Search SOPs, steps and tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-reading outline-none"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="grid size-8 place-items-center text-ink-500">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {trailing}
      </div>

      {area && (
        <div data-testid="area-filter" className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper-2 px-3 py-1 text-ui text-ink-900">
          In {areaName}
          <button type="button" aria-label="Show every area" onClick={() => onArea(null)} className="text-ink-500">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {filtered ? (
        <>
          <div className={LABEL}>
            {shown.length} SOP{shown.length === 1 ? '' : 's'}
          </div>
          {shown.map(open)}
          {shown.length === 0 && q && (
            <div data-testid="search-empty" className="px-5 py-12 text-center text-reading text-ink-500">
              {pending ? (
                'Searching…'
              ) : (
                <>
                  <p>No SOP for “{q}”.</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    {/* The trigger's button has no side padding of its own and its wrapper shrinks to the text. */}
                    <div className="[&_button]:px-4">
                      <RequestComposerTrigger
                        kinds={['new_sop']}
                        about={{ site: true }}
                        triggerLabel="Ask for one"
                        triggerStyle="button"
                        title="Ask for a SOP"
                        initialNote={q}
                      />
                    </div>
                    {canWrite && (
                      <Link
                        data-testid="write-it"
                        href={`/admin/sops/new/blank?title=${encodeURIComponent(q)}`}
                        className="mt-2 flex min-h-tap items-center rounded-lg border border-ink-300 px-4 text-ui font-semibold text-ink-900"
                      >
                        Write it
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <div className={LABEL}>Recent</div>
              {recent.map(open)}
            </>
          )}
          {mostUsed.length > 0 && (
            <>
              <div className={LABEL}>Most used</div>
              {mostUsed.map(({ row, count }) => (
                <SopRow key={row.id} row={row} selected={row.id === selectedId} extra={` · done ${count}×`} onOpen={onOpen} />
              ))}
            </>
          )}
          <div className={`${LABEL} flex items-center justify-between`}>
            <span>All SOPs · {rows.length}</span>
            <span className="inline-flex overflow-hidden rounded-lg border border-ink-300 normal-case tracking-normal">
              {(['area', 'type'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={`min-h-8 px-3 text-ui ${group === g ? 'bg-ink-900 text-white' : 'bg-paper-1 text-ink-900'}`}
                >
                  {g === 'area' ? 'Area' : 'Type'}
                </button>
              ))}
            </span>
          </div>
          {group === 'area'
            ? areas.map((a) => {
                const own = rows.filter((r) => r.areaId === a.id)
                return (
                  <div key={a.id}>
                    <button type="button" data-testid="area-group" data-area-id={a.id} title={`Open ${a.name} on the map`} onClick={() => onArea(a.id)} className={GROUP}>
                      <span className="flex items-center gap-2">
                        <i aria-hidden="true" className="size-2 rounded" style={{ background: a.colourVar }} />
                        {a.name}
                      </span>
                      <span>{own.length} ›</span>
                    </button>
                    {own.map(open)}
                  </div>
                )
              })
            : SOP_TYPES.map((t) => {
                const own = rows.filter((r) => r.type === t)
                return own.length === 0 ? null : (
                  <div key={t}>
                    <h3 className={GROUP}>
                      <span>{t}</span>
                      <span>{own.length}</span>
                    </h3>
                    {own.map(open)}
                  </div>
                )
              })}
        </>
      )}
    </div>
  )
}
