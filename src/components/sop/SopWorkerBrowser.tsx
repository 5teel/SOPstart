'use client'

/**
 * Sketch 005 variant C, worker side — the list and detail columns of the Miller
 * layout on /sops.
 *
 * Deliberately NOT a reuse of SopMillerBrowser. That component imports
 * DepartmentPicker and the setSopCategory server action, neither of which
 * belongs anywhere near a worker route: /sops sits behind SB-LINE-06's bundle
 * gate and an admin write path has no business in a worker's bundle. What is
 * shared is the LAYOUT LANGUAGE — scope | list | detail — not the code.
 *
 * The other difference is intent. The admin detail pane exists to FIX things
 * (assign a category, assign a department). A worker's cannot change anything
 * about a SOP; it exists to answer "should I do this one next, and why", so it
 * carries the training clock and one action: start the walkthrough.
 *
 * All derivation (refresher state, newer-version detection, assignment origin)
 * stays in the page, which already owns the lineage-root and completion-clock
 * logic. This component renders what it is handed.
 */

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { SopLibraryCard } from '@/components/sop/SopLibraryCard'
import type { CachedSop } from '@/lib/offline/db'

export type WorkerSop = {
  id: string
  title: string
  /** Resolved in the page — this component must not pull the category module
   *  into the worker bundle (SB-LINE-06). */
  categoryLabel: string | null
  /** Worker's most recent completion for this SOP's lineage, ISO. */
  lastCompletedAt: string | null
  isRefresherDue: boolean
  isRefresherOverdue: boolean
  hasNewerVersion: boolean
  /** Self-added vs assigned by a manager — decides which removal path applies. */
  isSelfAssigned: boolean
  removalRequested: boolean
  /** The cached row itself, for the mobile card renderer. */
  raw: CachedSop
}

function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The one signal that most deserves the worker's attention, worst first. */
function topSignal(sop: WorkerSop): { label: string; tone: 'bad' | 'warn' | 'info' } | null {
  if (sop.isRefresherOverdue) return { label: 'Refresher overdue', tone: 'bad' }
  if (sop.hasNewerVersion) return { label: 'Updated since you read it', tone: 'warn' }
  if (sop.isRefresherDue) return { label: 'Refresher due', tone: 'warn' }
  if (!sop.lastCompletedAt) return { label: 'Not done yet', tone: 'info' }
  return null
}

const TONE: Record<'bad' | 'warn' | 'info', string> = {
  bad: 'bg-red-500/20 text-red-600',
  warn: 'bg-amber-500/20 text-amber-700',
  info: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
}

export function SopWorkerBrowser({
  sops,
  scopeLabel,
  onRemove,
  removePending,
}: {
  sops: WorkerSop[]
  scopeLabel: string
  onRemove: (sopId: string) => void
  removePending: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = sops.find((s) => s.id === selectedId) ?? null

  if (sops.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--ink-900)]">Nothing in {scopeLabel}</p>
        <p className="text-sm text-[var(--ink-500)]">Pick another view on the left.</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 gap-4">
      {/* ── Middle: the list ─────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <div className="mono mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
          <span>{scopeLabel}</span>
          <span className="text-[var(--ink-300)]">{sops.length}</span>
          <span className="h-px flex-1 bg-[var(--ink-100)]" />
        </div>

        <ul className="flex flex-col gap-1">
          {sops.map((sop) => {
            const signal = topSignal(sop)
            const isSelected = sop.id === selectedId
            const body = (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink-900)]" title={sop.title}>
                  {sop.title}
                </span>
                {signal && (
                  <span className={`mono flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] ${TONE[signal.tone]}`}>
                    {signal.label}
                  </span>
                )}
              </>
            )
            return (
              <li key={sop.id}>
                {/* Desktop: select into the detail pane. Tap targets stay
                    glove-friendly (min-h-11) — this is still a worker surface. */}
                <button
                  type="button"
                  onClick={() => setSelectedId(sop.id)}
                  data-testid="worker-miller-row"
                  data-selected={isSelected ? 'true' : undefined}
                  className={`hidden min-h-11 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors lg:flex ${
                    isSelected
                      ? 'border-[var(--ink-900)] bg-[var(--paper-2)]'
                      : 'border-[var(--ink-100)] bg-white hover:border-[var(--ink-300)]'
                  }`}
                >
                  {body}
                </button>

                {/* Below lg there is no detail column, so the compact row would
                    hide everything the pane was going to show. Keep the full
                    SopLibraryCard on phones — it already carries the cached,
                    updated and refresher badges, and a glove-sized tap target.
                    The Miller row is a DESKTOP affordance; the phone keeps the
                    card it always had. */}
                <div className="lg:hidden">
                  <SopLibraryCard
                    sop={sop.raw}
                    isCached
                    hasNewerVersion={sop.hasNewerVersion}
                    isRefresherDue={sop.isRefresherDue}
                    isRefresherOverdue={sop.isRefresherOverdue}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Right: detail ────────────────────────────────────────── */}
      <aside className="hidden w-[260px] flex-shrink-0 lg:block">
        <div className="sticky top-4 rounded-lg border border-[var(--ink-100)] bg-[var(--paper-2)] p-3">
          {!selected ? (
            <p className="py-8 text-center text-sm text-[var(--ink-500)]">
              Pick a procedure to see when you last did it.
            </p>
          ) : (
            <>
              <p className="mb-1 text-sm font-semibold leading-snug text-[var(--ink-900)]">
                {selected.title}
              </p>
              {selected.categoryLabel && (
                <p className="mono mb-2 text-[10px] uppercase tracking-wider text-[var(--ink-500)]">
                  {selected.categoryLabel}
                </p>
              )}

              {selected.isRefresherOverdue && (
                <p className="mb-2 flex items-center gap-1.5 rounded bg-red-500/15 px-2 py-1.5 text-xs text-red-700">
                  <AlertTriangle size={13} aria-hidden="true" /> Refresher overdue
                </p>
              )}
              {!selected.isRefresherOverdue && selected.isRefresherDue && (
                <p className="mb-2 flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1.5 text-xs text-amber-800">
                  <Clock size={13} aria-hidden="true" /> Refresher due
                </p>
              )}
              {selected.hasNewerVersion && (
                <p className="mb-2 flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1.5 text-xs text-amber-800">
                  <RefreshCw size={13} aria-hidden="true" /> Updated since you last did it
                </p>
              )}

              <dl className="mb-3 text-xs">
                <div className="flex gap-2 border-b border-dotted border-[var(--ink-200)] py-1">
                  <dt className="w-[74px] flex-shrink-0 text-[11px] text-[var(--ink-500)]">Last done</dt>
                  <dd className={selected.lastCompletedAt ? 'text-[var(--ink-900)]' : 'text-[var(--ink-300)]'}>
                    {formatDay(selected.lastCompletedAt) ?? 'Never'}
                  </dd>
                </div>
                <div className="flex gap-2 py-1">
                  <dt className="w-[74px] flex-shrink-0 text-[11px] text-[var(--ink-500)]">Added by</dt>
                  <dd className="text-[var(--ink-900)]">
                    {selected.isSelfAssigned ? 'You' : 'Your manager'}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col gap-1.5">
                <Link
                  href={`/sops/${selected.id}/walkthrough`}
                  className="block min-h-11 rounded-lg bg-[var(--ink-900)] px-3 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Start walkthrough
                </Link>
                <Link
                  href={`/sops/${selected.id}`}
                  className="block min-h-11 rounded-lg border border-[var(--ink-300)] px-3 py-2.5 text-center text-sm text-[var(--ink-700)] hover:border-[var(--ink-900)]"
                >
                  Read it
                </Link>
                {/* Removal moved off every row and into the pane — one button
                    for the SOP you are actually looking at, instead of 20
                    destructive-ish controls down the side of the list. */}
                <button
                  type="button"
                  onClick={() => onRemove(selected.id)}
                  disabled={removePending || selected.removalRequested}
                  className="min-h-11 rounded-lg px-3 py-2 text-xs text-[var(--ink-500)] hover:text-red-600 disabled:cursor-default disabled:text-[var(--ink-300)]"
                >
                  {selected.removalRequested
                    ? 'Removal requested'
                    : selected.isSelfAssigned
                      ? 'Remove from your SOPs'
                      : 'Ask to be taken off this'}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
