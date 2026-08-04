'use client'

/**
 * Sketch 005 variant C — the middle and right columns of the Miller layout.
 *
 * Scope (the left column) stays server-rendered: changing scope SHOULD refetch,
 * so it is plain Links and the URL carries it. Selecting a SOP must not — it is
 * the hot path, and a search-param push would fire an RSC request through the
 * service worker for every click (CLAUDE.md [2026-05-13]). So selection lives
 * in client state here, and the detail pane renders from data the list already
 * carries. No query runs when you click a row.
 *
 * Below `lg` there is no room for three columns: the detail pane is dropped and
 * a row becomes a direct link to the builder, which is the pre-Miller
 * behaviour. Admin work is desktop-first (Visy interview), but the page must
 * still work on a phone rather than merely not crash on one.
 */

import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { SopStatus } from '@/types/sop'

/** Everything the list and detail panes need, resolved server-side. */
export type MillerSop = {
  id: string
  title: string | null
  /** Filename fallback, already stripped of its extension. */
  displayTitle: string
  untitled: boolean
  status: string
  categoryLabel: string | null
  departments: string[]
  allDepartments: boolean
  ownerLabel: string | null
  age: string
  updatedAt: string | null
  flagLabel: string | null
  flagStyle: string | null
  stuck: boolean
  confidence: number | null
}

export function SopMillerBrowser({
  sops,
  scopeLabel,
}: {
  sops: MillerSop[]
  scopeLabel: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = sops.find((s) => s.id === selectedId) ?? null

  if (sops.length === 0) {
    return (
      <div className="blueprint-frame py-12 text-center">
        <p className="mono mb-2 text-[11px] uppercase tracking-wider text-[var(--ink-500)]">EMPTY</p>
        <p className="mb-1 text-lg font-semibold text-[var(--ink-900)]">Nothing in {scopeLabel}</p>
        <p className="text-sm text-[var(--ink-500)]">Pick another scope on the left.</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 gap-4">
      {/* ── Middle column: the list ─────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <div className="mono mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
          <span>{scopeLabel}</span>
          <span className="text-[var(--ink-300)]">{sops.length}</span>
          <span className="h-px flex-1 bg-[var(--ink-100)]" />
        </div>

        <ul className="space-y-1">
          {sops.map((sop) => {
            const isSelected = sop.id === selectedId
            return (
              <li key={sop.id}>
                {/* Desktop: select into the detail pane, no navigation. */}
                <button
                  type="button"
                  onClick={() => setSelectedId(sop.id)}
                  data-testid="miller-row"
                  data-selected={isSelected ? 'true' : undefined}
                  className={`hidden w-full items-center gap-2.5 rounded border px-3 py-2 text-left transition-colors lg:flex ${
                    isSelected
                      ? 'border-[var(--ink-900)] bg-[var(--paper-2)]'
                      : 'border-[var(--ink-100)] bg-white hover:border-[var(--ink-300)]'
                  }`}
                >
                  <RowBody sop={sop} />
                </button>

                {/* Below lg there is no detail column, so the row is the link. */}
                <Link
                  href={`/admin/sops/builder/${sop.id}`}
                  className="flex w-full items-center gap-2.5 rounded border border-[var(--ink-100)] bg-white px-3 py-2 lg:hidden"
                >
                  <RowBody sop={sop} />
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Right column: detail ────────────────────────────────── */}
      <aside className="hidden w-[260px] flex-shrink-0 lg:block">
        <div className="sticky top-4 rounded border border-[var(--ink-100)] bg-[var(--paper-2)] p-3">
          {!selected ? (
            <p className="py-8 text-center text-sm text-[var(--ink-500)]">
              Pick a SOP to see its detail here.
            </p>
          ) : (
            <>
              <p className="mb-0.5 text-sm font-semibold leading-snug text-[var(--ink-900)]">
                {selected.displayTitle}
              </p>
              <p className="mono mb-3 text-[10px] uppercase tracking-wider text-[var(--ink-500)]">
                {selected.status}
              </p>

              {selected.flagLabel && (
                <p
                  className={`mono mb-3 inline-block rounded px-1.5 py-0.5 text-[11px] ${selected.flagStyle ?? ''}`}
                >
                  {selected.flagLabel}
                </p>
              )}

              <dl className="mb-3">
                <Field label="Category" value={selected.categoryLabel} />
                <Field
                  label="Department"
                  value={
                    selected.allDepartments
                      ? 'Everyone'
                      : selected.departments.length > 0
                        ? selected.departments.join(', ')
                        : null
                  }
                />
                <Field label="Owner" value={selected.ownerLabel} />
                <Field label="Updated" value={selected.age === 'today' ? 'today' : `${selected.age} ago`} />
                {selected.confidence !== null && (
                  <Field label="Parse" value={`${Math.round(selected.confidence * 100)}% confident`} />
                )}
              </dl>

              <div className="flex flex-col gap-1.5">
                <Link
                  href={`/admin/sops/builder/${selected.id}`}
                  className="block rounded bg-[var(--ink-900)] px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Open
                </Link>
                <Link
                  href={`/admin/sops/${selected.id}/versions`}
                  className="block rounded border border-[var(--ink-300)] px-3 py-2 text-center text-sm text-[var(--ink-700)] hover:border-[var(--ink-900)]"
                >
                  Versions
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function RowBody({ sop }: { sop: MillerSop }) {
  return (
    <>
      <span
        className={`min-w-0 flex-1 truncate text-sm font-semibold ${
          sop.untitled ? 'italic text-[var(--ink-500)]' : 'text-[var(--ink-900)]'
        }`}
        title={sop.displayTitle}
      >
        {sop.displayTitle}
      </span>
      {sop.stuck && (
        <span className="mono flex-shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] text-red-600">
          Stuck
        </span>
      )}
      {sop.flagLabel && !sop.stuck && (
        <span className={`mono flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] ${sop.flagStyle ?? ''}`}>
          {sop.flagLabel}
        </span>
      )}
      <StatusBadge status={sop.status as SopStatus} />
      <span className="mono w-10 flex-shrink-0 text-right text-[11px] text-[var(--ink-300)]">
        {sop.age}
      </span>
    </>
  )
}

/** A detail row. Renders "Not set" muted rather than hiding — an absent
 *  department is the thing an admin most needs to notice. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2 border-b border-dotted border-[var(--ink-200)] py-1 text-xs last:border-b-0">
      <dt className="w-[68px] flex-shrink-0 text-[11px] text-[var(--ink-500)]">{label}</dt>
      <dd className={`min-w-0 flex-1 ${value ? 'text-[var(--ink-900)]' : 'text-[var(--ink-300)]'}`}>
        {value ?? 'Not set'}
      </dd>
    </div>
  )
}
