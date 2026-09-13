'use client'

/**
 * Phase 41 Plan 04 — client lens rendering the grouped worst-flag-first
 * governance queue, fed by `listGovernanceQueue`. `GovernanceQueueRow` is
 * rendered unchanged (it owns its own `approveStep` / `isCallerNextApprover`
 * gating) — do not modify it, and do not refactor it to import
 * `flag-display.ts`; `tests/phase30/list-rows.spec.ts` is the sync contract
 * for its private FLAG maps.
 *
 * Like `AdminAccessLens`, this lens renders FULL WIDTH replacing the Miller
 * frame — that is exactly what `admin/sops/page.tsx` does today for
 * `?view=attention`, so the wide grouped queue keeps its width.
 *
 * Exiting the lens is a callback (`onBack`), never a navigation — a scope
 * change on the merged client page must not trigger an RSC fetch through the
 * service worker (CLAUDE.md 2026-05-13).
 */

import { useQuery } from '@tanstack/react-query'
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import type { GovernanceFlag } from '@/lib/governance/classify'
import { GovernanceQueueRow } from '@/components/admin/governance/GovernanceQueueRow'
import { FLAG_PRIORITY, FLAG_STYLE, FLAG_LABEL, FLAG_DESC } from '@/lib/governance/flag-display'

export interface AdminAttentionLensProps {
  onBack: () => void
}

export function AdminAttentionLens({ onBack }: AdminAttentionLensProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['governance-queue'],
    queryFn: listGovernanceQueue,
    staleTime: 1000 * 60,
  })

  const backLink = (
    <button
      type="button"
      onClick={onBack}
      className="mono mb-4 inline-block text-[11px] uppercase tracking-wider text-[var(--ink-500)] hover:text-[var(--ink-900)]"
    >
      ← Back to your SOPs
    </button>
  )

  if (isLoading || !data) {
    return (
      <div>
        {backLink}
        <div className="flex flex-col gap-2 p-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-lg bg-[var(--paper-2)] lg:h-9 lg:rounded" />
          ))}
        </div>
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div>
        {backLink}
        <div className="blueprint-frame py-12 text-center">
          <p className="mono mb-2 text-[11px] uppercase tracking-wider text-red-600">ERROR</p>
          <p className="text-sm text-[var(--ink-500)]">{data.error}</p>
        </div>
      </div>
    )
  }

  const govRows: GovernanceRow[] = data.rows
  const flaggedRows = govRows.filter((r) => r.flags.length > 0)

  // UX-06: ONE flag chip per library row, worst flag first.
  const rowFlag: Record<string, GovernanceFlag | undefined> = {}
  for (const r of flaggedRows) {
    rowFlag[r.id] = FLAG_PRIORITY.find((f) => r.flags.includes(f))
  }

  // Attention view groups: each flagged SOP appears once, under its WORST
  // flag, in priority order (sketch 004: grouped queue replaces the chip row).
  const attentionGroups = FLAG_PRIORITY
    .map((flag) => ({ flag, rows: flaggedRows.filter((r) => rowFlag[r.id] === flag) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div>
      {backLink}

      {attentionGroups.length === 0 && (
        <div className="blueprint-frame py-12 text-center">
          <p className="mono mb-2 text-[11px] uppercase tracking-wider text-[var(--ink-500)]">CLEAR</p>
          <p className="mb-1 text-lg font-semibold text-[var(--ink-900)]">Nothing needs attention</p>
          <p className="text-sm text-[var(--ink-500)]">Every SOP is owned, current, and correctly assigned.</p>
        </div>
      )}

      {attentionGroups.map(({ flag, rows }) => (
        <section key={flag} className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <span className={`mono rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${FLAG_STYLE[flag]}`}>
              {FLAG_LABEL[flag]} · {rows.length}
            </span>
            <span className="h-px flex-1 bg-[var(--ink-100)]" />
            <span className="text-xs text-[var(--ink-500)]">{FLAG_DESC[flag]}</span>
          </div>
          <ul className="space-y-2">
            {rows.map((row) => (
              <GovernanceQueueRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
