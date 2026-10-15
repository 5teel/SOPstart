'use client'
/**
 * Phase 63 -- the home's SOP list (sketch 009 A), decluttered by ADR-0016: search, one shelf
 * switching Recent / Most used, then All SOPs as a short list of areas (or types) to step into;
 * a SOP list shows only once you pick one. A search that finds nothing offers Ask for one, and a
 * SOP admin also gets Write it. Built unmounted; the shell mounts it.
 */
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { SopRow } from '@/components/home/SopRow'
import type { LibraryRow } from '@/hooks/useLibrary'
import { useSopSearch } from '@/hooks/useSopSearch'
import { inArea, type LibraryArea } from '@/lib/library/areas'
import { matchesTitle } from '@/lib/library/search'
import { SOP_TYPES, type SopType } from '@/lib/library/sop-type'

// Ask is a lazy module: it never rides in the home download.
const RequestComposerTrigger = dynamic(
  () => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger),
  { ssr: false, loading: () => null },
)

const COUNT = 'font-label text-meta font-medium text-ink-600'
/** How many Recent or Most used rows the shelf shows. */
const SHELF = 5

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
  // ADR-0016: one shelf, not two stacked lists; and a type is stepped into like an area.
  const [shelf, setShelf] = useState<'recent' | 'most' | null>(null)
  const [type, setType] = useState<SopType | null>(null)
  const { ids: stepHits, pending } = useSopSearch(query, rows.map((r) => r.id))

  const q = query.trim()
  const filtered = !!q || !!area || !!type
  const openArea = area ? areas.find((a) => a.id === area) : undefined
  const parent = openArea?.parentId ? areas.find((a) => a.id === openArea.parentId) : undefined
  const shown = filtered
    ? rows.filter((r) => inArea(areas, r.areaId, area) && (!type || !!area || r.type === type) && (!q || matchesTitle(r, q) || stepHits.has(r.id)))
    : []
  // Sub-areas of the open area, stepped into like the top level (ADR-0010).
  const subAreas = area && !q ? areas.filter((a) => a.parentId === area) : []
  const shelfNow = shelf ?? (recent.length > 0 ? 'recent' : 'most')
  const drill = (key: string, label: ReactNode, count: number, onClick: () => void, testId: string, swatch?: string) => (
    <button key={key} type="button" data-testid={testId} data-area-id={testId === 'area-group' ? key : undefined} onClick={onClick} className="list-row">
      {swatch && <i aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: swatch }} />}
      <span className="min-w-0 flex-1 truncate text-reading font-semibold text-ink-900">{label}</span>
      <span className={COUNT}>
        {count} SOP{count === 1 ? '' : 's'}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="list-chev" />
    </button>
  )
  const open = (r: LibraryRow) => (
    <SopRow key={r.id} row={r} selected={r.id === selectedId} onOpen={onOpen} />
  )

  return (
    <div data-testid="sop-list">
      {/* Desktop: the column's header band, level with the menu's wordmark and the map header. */}
      <div className="flex items-center gap-1 lg:-mx-3.5 lg:h-16 lg:border-b lg:border-ink-200 lg:px-3.5">
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
        // Up one level, same as Esc; names where it goes.
        <div data-testid="area-filter" className="mt-3 flex flex-col items-start gap-2">
          <button type="button" data-testid="area-back" onClick={() => onArea(parent?.id ?? null)} className="back">
            <ChevronLeft size={18} aria-hidden="true" />
            {parent ? parent.name : 'All areas'}
          </button>
          <h2 className="flex items-center gap-2 px-2.5 text-reading font-bold text-ink-900">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: openArea?.colourVar }} />
            {openArea?.name}
          </h2>
        </div>
      )}

      {type && !area && (
        <div data-testid="type-filter" className="mt-3 flex flex-col items-start gap-2">
          <button type="button" data-testid="type-back" onClick={() => setType(null)} className="back">
            <ChevronLeft size={18} aria-hidden="true" />
            All types
          </button>
          <h2 className="px-2.5 text-reading font-bold text-ink-900">{type}</h2>
        </div>
      )}

      {filtered ? (
        <>
          {subAreas.length > 0 && (
            <>
              <div className="list-head section-heading">Areas inside</div>
              <div className="list">{subAreas.map((a) => drill(a.id, a.name, a.total, () => onArea(a.id), 'area-group', a.colourVar))}</div>
            </>
          )}
          <div className="list-head section-heading">
            {shown.length} SOP{shown.length === 1 ? '' : 's'}
          </div>
          {shown.length > 0 && <div className="list">{shown.map(open)}</div>}
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
          {(recent.length > 0 || mostUsed.length > 0) && (
            <>
              <div className="list-head">
                <span className="seg seg-quiet" data-testid="sop-shelf">
                  {recent.length > 0 && (
                    <button type="button" aria-pressed={shelfNow === 'recent'} onClick={() => setShelf('recent')}>
                      Recent
                    </button>
                  )}
                  {mostUsed.length > 0 && (
                    <button type="button" aria-pressed={shelfNow === 'most'} onClick={() => setShelf('most')}>
                      Most used
                    </button>
                  )}
                </span>
              </div>
              <div className="list">
                {shelfNow === 'recent'
                  ? recent.slice(0, SHELF).map(open)
                  : mostUsed.slice(0, SHELF).map(({ row, count }) => (
                      <SopRow key={row.id} row={row} selected={row.id === selectedId} extra={` · done ${count}×`} onOpen={onOpen} />
                    ))}
              </div>
            </>
          )}
          <div className="list-head">
            <span className="section-heading">
              All SOPs <span className={COUNT}>{rows.length}</span>
            </span>
            <span className="seg seg-quiet">
              {(['area', 'type'] as const).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {g === 'area' ? 'Area' : 'Type'}
                </button>
              ))}
            </span>
          </div>
          <div className="list">
            {group === 'area'
              ? // ADR-0010: the top level only; an area with sub-areas lists them when stepped into.
                areas.filter((a) => a.parentId === null).map((a) => drill(a.id, a.name, a.total, () => onArea(a.id), 'area-group', a.colourVar))
              : SOP_TYPES.map((t) => {
                  const n = rows.filter((r) => r.type === t).length
                  return n === 0 ? null : drill(t, t, n, () => setType(t), 'type-group')
                })}
          </div>
        </>
      )}
    </div>
  )
}
