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
  /** In the worker's own list, vs a library row they have not taken on. */
  isAssigned: boolean
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
  if (!sop.isAssigned) return { label: 'Not yours', tone: 'info' }
  if (sop.isRefresherOverdue) return { label: 'Refresher overdue', tone: 'bad' }
  if (sop.hasNewerVersion) return { label: 'Updated since you read it', tone: 'warn' }
  if (sop.isRefresherDue) return { label: 'Refresher due', tone: 'warn' }
  if (!sop.lastCompletedAt) return { label: 'Not done yet', tone: 'info' }
  return null
}

const TONE: Record<'bad' | 'warn' | 'info', string> = {
  bad: 'bg-red-500/[0.14] text-[var(--accent-hazard)]',
  warn: 'bg-amber-600/[0.16] text-amber-700',
  info: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
}

/** Sketch 005: on a selected (ink-filled) row every chip inverts to one tone. */
const TONE_SELECTED = 'bg-white/20 text-white'

/** The detail pane states the signal in its own colour rather than in a box. */
const TONE_TEXT: Record<'bad' | 'warn' | 'info', string> = {
  bad: 'text-[var(--accent-hazard)]',
  warn: 'text-amber-700',
  info: 'text-[var(--ink-500)]',
}

/** Mirrors the scope column's header so the three columns share one baseline. */
function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mono sticky top-0 z-10 hidden border-b border-[var(--ink-200)] bg-[var(--paper-2)] px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-[var(--ink-500)] lg:block">
      {children}
    </h2>
  )
}

/** Sketch 005 `.kv`: 76px label, dotted rule, value right of it. */
function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-dotted border-[var(--ink-200)] py-1 text-xs">
      <dt className="w-[76px] flex-shrink-0 text-[11px] text-[var(--ink-500)]">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

export function SopWorkerBrowser({
  sops,
  scopeLabel,
  onRemove,
  onAdd,
  actionPending,
}: {
  sops: WorkerSop[]
  scopeLabel: string
  onRemove: (sopId: string) => void
  onAdd: (sopId: string) => void
  actionPending: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = sops.find((s) => s.id === selectedId) ?? null

  const selectedSignal = selected ? topSignal(selected) : null

  // `contents` dissolves this wrapper so the two columns below become direct
  // grid items of the page's Miller frame — that is what makes the frame ONE
  // bordered surface with hairline dividers instead of three floating cards.
  // Below lg the frame is not a grid, so the columns just flow.
  return (
    <div className="contents">
      {/* ── Middle: the list ─────────────────────────────────────── */}
      <div className="min-w-0 lg:overflow-y-auto lg:border-r lg:border-[var(--ink-200)]">
        <ColumnHeader>
          {scopeLabel} <span className="text-[var(--ink-300)]">— {sops.length}</span>
        </ColumnHeader>

        {sops.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
            <p className="text-sm font-semibold text-[var(--ink-900)]">Nothing in {scopeLabel}</p>
            <p className="text-xs text-[var(--ink-500)]">Pick another view on the left.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 lg:gap-0">
            {sops.map((sop) => {
              const signal = topSignal(sop)
              const isSelected = sop.id === selectedId
              return (
                <li key={sop.id}>
                  {/* Desktop: a flush Miller row — hairline separator, no
                      per-row border, ink fill when selected. */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(sop.id)}
                    data-testid="worker-miller-row"
                    data-selected={isSelected ? 'true' : undefined}
                    className={`hidden w-full items-center gap-2.5 border-b border-[var(--ink-100)] px-3 py-2 text-left transition-colors lg:flex ${
                      isSelected ? 'bg-[var(--ink-900)]' : 'hover:bg-[var(--paper-2)]'
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-[12.5px] font-medium ${
                        isSelected ? 'text-white' : 'text-[var(--ink-900)]'
                      }`}
                      title={sop.title}
                    >
                      {sop.title}
                    </span>
                    {signal && (
                      <span
                        className={`mono flex-shrink-0 rounded px-1.5 py-0.5 text-[10.5px] ${
                          isSelected ? TONE_SELECTED : TONE[signal.tone]
                        }`}
                      >
                        {signal.label}
                      </span>
                    )}
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
                      isCached={sop.isAssigned}
                      isAssigned={sop.isAssigned}
                      hasNewerVersion={sop.hasNewerVersion}
                      isRefresherDue={sop.isRefresherDue}
                      isRefresherOverdue={sop.isRefresherOverdue}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Right: detail ────────────────────────────────────────── */}
      <aside className="hidden overflow-y-auto bg-[var(--paper-2)] lg:block">
        <ColumnHeader>Detail</ColumnHeader>
        <div className="p-3.5">
          {!selected ? (
            <p className="py-10 text-center text-xs text-[var(--ink-500)]">
              Pick a procedure to see when you last did it.
            </p>
          ) : (
            <>
              <p className="text-sm font-bold leading-snug text-[var(--ink-900)]">
                {selected.title}
              </p>
              <p className="mono mb-2.5 mt-1 text-[10px] uppercase tracking-[0.06em] text-[var(--ink-500)]">
                {selected.categoryLabel ?? 'No category'}
              </p>

              {/* Sketch 005 states the problem as a keyed row in its own
                  colour. Three stacked tinted banners said the same thing in
                  three times the space, and two of them could show at once. */}
              <dl className="mb-3.5">
                {selectedSignal && selectedSignal.tone !== 'info' && (
                  <Kv label="Attention">
                    <span className={`flex items-center gap-1.5 font-medium ${TONE_TEXT[selectedSignal.tone]}`}>
                      {selectedSignal.tone === 'bad' ? (
                        <AlertTriangle size={12} aria-hidden="true" />
                      ) : selected.hasNewerVersion ? (
                        <RefreshCw size={12} aria-hidden="true" />
                      ) : (
                        <Clock size={12} aria-hidden="true" />
                      )}
                      {selectedSignal.label}
                    </span>
                  </Kv>
                )}
                <Kv label="Last done">
                  <span className={selected.lastCompletedAt ? 'text-[var(--ink-900)]' : 'text-[var(--ink-300)]'}>
                    {formatDay(selected.lastCompletedAt) ?? 'Never'}
                  </span>
                </Kv>
                <Kv label="Added by">
                  <span className="text-[var(--ink-900)]">
                    {!selected.isAssigned ? 'Not yours yet' : selected.isSelfAssigned ? 'You' : 'Your manager'}
                  </span>
                </Kv>
              </dl>

              {/* Short labels, side by side — they mirror the detail page's own
                  Read / Walk it tabs, which is where both links land. */}
              <div className="flex gap-1.5">
                <Link
                  // Phase 30 deleted the /walkthrough route — Walk it is a tab
                  // on the detail page now (tests/phase30/dead-weight.spec.ts).
                  href={`/sops/${selected.id}?tab=walk`}
                  className="flex-1 rounded-md bg-[var(--ink-900)] px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-90"
                >
                  Walk it
                </Link>
                <Link
                  href={`/sops/${selected.id}`}
                  className="flex-1 rounded-md border border-[var(--ink-300)] bg-[var(--paper-1)] px-3 py-2 text-center text-xs text-[var(--ink-700)] hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
                >
                  Read
                </Link>
              </div>

              {/* Add/remove moved off every row and into the pane — one
                  button for the SOP you are actually looking at, instead of
                  a column of +/− controls down the side of the list. This is
                  what replaced the old "SOP Library" tab's per-row buttons. */}
              {selected.isAssigned ? (
                <button
                  type="button"
                  onClick={() => onRemove(selected.id)}
                  disabled={actionPending || selected.removalRequested}
                  className="mt-2 w-full rounded-md px-3 py-1.5 text-[11px] text-[var(--ink-500)] hover:text-[var(--accent-hazard)] disabled:cursor-default disabled:text-[var(--ink-300)]"
                >
                  {selected.removalRequested
                    ? 'Removal requested'
                    : selected.isSelfAssigned
                      ? 'Remove from your SOPs'
                      : 'Ask to be taken off this'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(selected.id)}
                  disabled={actionPending}
                  className="mt-2 w-full rounded-md border border-[var(--ink-900)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-900)] hover:bg-[var(--paper-1)] disabled:cursor-default disabled:border-[var(--ink-300)] disabled:text-[var(--ink-300)]"
                >
                  + Add to your SOPs
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
