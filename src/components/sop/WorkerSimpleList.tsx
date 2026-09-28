'use client'

/**
 * Phase 54 (D-10) — the stacked worker list: the fallback for workers
 * without the plant (no drawn site, or below 1024px without Phase 53's
 * phone home). No Miller frame, no detail pane. Add / remove now live on
 * each row because the retired desktop detail pane (SopWorkerBrowser) was
 * their only home — capability matrix "Self-add SOP" (CLAUDE.md 2026-06-05:
 * wire the real action, not a stub).
 *
 * The scope chip strip + department-sheet button below are the same markup
 * that used to sit above the Miller frame in sops/page.tsx (`lg:hidden`
 * dropped — this component is the only rendering path now, at every width).
 */

import { ClipboardList, BookOpen, ChevronDown } from 'lucide-react'
import { SopLibraryCard } from '@/components/sop/SopLibraryCard'
import type { WorkerSop, WorkerScope } from '@/lib/sop/worker-signal'

export interface WorkerSimpleListProps {
  sops: WorkerSop[]
  scopes: ReadonlyArray<{ key: WorkerScope; label: string; count: number }>
  scope: WorkerScope
  onScopeChange: (s: WorkerScope) => void
  scopeLabel: string
  activeDeptLabel: string
  onOpenDeptSheet: () => void
  query: string
  emptyAction?: { label: string; onClick: () => void }
  loading: boolean
  noSops: boolean
  onAdd: (sopId: string) => void
  onRemove: (sopId: string) => void
  actionPending: boolean
}

export function WorkerSimpleList({
  sops,
  scopes,
  scope,
  onScopeChange,
  scopeLabel,
  activeDeptLabel,
  onOpenDeptSheet,
  query,
  emptyAction,
  loading,
  noSops,
  onAdd,
  onRemove,
  actionPending,
}: WorkerSimpleListProps) {
  const allUnassigned = sops.length > 0 && sops.every((s) => !s.isAssigned)

  return (
    <div data-testid="worker-list" className="mx-auto max-w-3xl">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {scopes.map((sc) => (
          <button
            key={sc.key}
            type="button"
            onClick={() => onScopeChange(sc.key)}
            className={`flex-shrink-0 min-h-11 rounded-lg border px-3 text-sm font-medium ${
              scope === sc.key
                ? 'border-[var(--ink-900)] bg-[var(--ink-900)] text-white'
                : 'border-[var(--ink-100)] bg-white text-[var(--ink-700)]'
            }`}
          >
            {sc.label}
            <span className="mono ml-1 text-meta opacity-70">{sc.count}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenDeptSheet}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 min-h-11 bg-white border border-[var(--ink-100)] rounded-lg text-sm font-medium text-[var(--ink-900)]"
        >
          <span>{activeDeptLabel}</span>
          <ChevronDown size={16} className="text-[var(--ink-500)]" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-tap-row animate-pulse rounded-lg bg-[var(--paper-2)]" />
          ))}
        </div>
      ) : noSops ? (
        <div className="flex flex-col items-center justify-center gap-4 px-8 py-24 text-center">
          <ClipboardList size={48} className="text-[var(--ink-300)]" />
          <div>
            <p className="text-xl font-semibold text-[var(--ink-900)]">No SOPs yet</p>
            <p className="text-sm text-[var(--ink-500)] max-w-xs mx-auto mt-2">
              Your admin hasn&apos;t published any SOPs yet.
            </p>
          </div>
        </div>
      ) : sops.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-[var(--ink-900)]">
            {query ? `Nothing matches “${query}”` : `Nothing in ${scopeLabel}`}
          </p>
          {emptyAction ? (
            <button
              type="button"
              onClick={emptyAction.onClick}
              className="mt-2 inline-flex min-h-tap items-center gap-2 rounded-lg bg-[var(--ink-900)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              <BookOpen size={16} aria-hidden="true" />
              {emptyAction.label}
            </button>
          ) : (
            <p className="text-xs text-[var(--ink-500)]">
              {query ? 'Try a shorter word, or the SOP number.' : 'Pick another view.'}
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sops.map((sop) => (
            <li key={sop.id} data-testid="worker-list-row">
              <SopLibraryCard
                sop={sop.raw}
                isAssigned={sop.isAssigned || allUnassigned}
                hasNewerVersion={sop.hasNewerVersion}
                isRefresherDue={sop.isRefresherDue}
                isRefresherOverdue={sop.isRefresherOverdue}
                neverDone={sop.isAssigned && !sop.lastCompletedAt}
              />
              <div className="flex justify-end px-1 pt-1">
                {sop.isAssigned ? (
                  <button
                    type="button"
                    onClick={() => onRemove(sop.id)}
                    disabled={actionPending || sop.removalRequested}
                    className="min-h-tap rounded-lg px-3 text-meta text-[var(--ink-500)] hover:text-[var(--accent-hazard)] disabled:cursor-default disabled:text-[var(--ink-300)]"
                  >
                    {sop.removalRequested
                      ? 'Removal requested'
                      : sop.isSelfAssigned
                        ? 'Remove from your SOPs'
                        : 'Ask to be taken off this'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAdd(sop.id)}
                    disabled={actionPending}
                    className="min-h-tap rounded-lg px-3 text-meta font-semibold text-[var(--ink-900)] hover:bg-[var(--paper-1)] disabled:cursor-default disabled:text-[var(--ink-300)]"
                  >
                    + Add to your SOPs
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
