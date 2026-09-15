'use client'

/**
 * Phase 41 Plan 04 — client lens wrapping the unmodified `SopMillerBrowser`
 * (draft/published/failed status list), fed by `listAdminSopRows`. This file
 * IS the dynamic chunk `sops/page.tsx` loads via `next/dynamic({ ssr: false })`
 * — `tests/lint/no-static-admin-lens-import.spec.ts` allowlists this file for
 * exactly that reason, so the static import of `SopMillerBrowser` below is
 * correct and required, not a violation of the worker-bundle isolation rule.
 *
 * `SopMillerBrowser`'s below-lg row link and its detail-pane `Open` button are
 * the single permitted direct list→builder chain (SUR-04) — this lens adds no
 * builder affordance of its own and does not modify that component.
 *
 * Scope/filter changes on the merged page are client state, not URL pushes —
 * `onClearFilter` is a callback, never a `<Link>`, so clearing a filter does
 * not trigger an RSC fetch through the service worker (CLAUDE.md 2026-05-13).
 *
 * `onResult` exists so the merged page can render the admin scope-column
 * counts (`railCounts`, `scopeDepartments`, `noAudienceCount`, `flaggedCount`)
 * from this same single fetch instead of issuing a second one. It is invoked
 * from an effect keyed on the query data, never during render.
 */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAdminSopRows } from '@/actions/admin-sop-list'
import type { AdminSopListResult } from '@/lib/sop-list/admin-rows'
import { SopMillerBrowser } from '@/components/admin/SopMillerBrowser'

export interface AdminStatusLensProps {
  status: 'all' | 'draft' | 'published' | 'failed'
  ownerOnly: boolean
  departments?: string
  collection?: string
  onResult?: (r: AdminSopListResult) => void
  onClearFilter: () => void
}

export function AdminStatusLens({
  status,
  ownerOnly,
  departments,
  collection,
  onResult,
  onClearFilter,
}: AdminStatusLensProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sop-rows', status, ownerOnly, departments ?? null, collection ?? null],
    queryFn: () =>
      listAdminSopRows({
        status,
        owner: ownerOnly ? 'me' : undefined,
        departments,
        collection,
      }),
    staleTime: 1000 * 60,
  })

  useEffect(() => {
    if (data && !('error' in data)) {
      onResult?.(data)
    }
  }, [data, onResult])

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-2 p-3 lg:col-span-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-lg bg-[var(--paper-2)] lg:h-9 lg:rounded" />
        ))}
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div className="blueprint-frame py-12 text-center lg:col-span-2">
        <p className="mono mb-2 text-[11px] uppercase tracking-wider text-red-600">ERROR</p>
        <p className="text-sm text-[var(--ink-500)]">{data.error}</p>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2">
      {/* SC-4 viz-as-library-filter: server-filtered result banner, with a
          count and a way back to the unfiltered list. Only shown for a
          collection deep link — a department scope carries its own label. */}
      {data.filtered && !departments && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--accent-step)]/40 bg-[var(--accent-step)]/10 px-4 py-3">
          <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-700)]">
            Open in library ({data.sops.length})
          </span>
          <button
            type="button"
            onClick={onClearFilter}
            className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] underline"
          >
            Clear filter
          </button>
        </div>
      )}

      <SopMillerBrowser sops={data.sops} scopeLabel={data.scopeLabel} departments={data.departments} hideStatus={status === 'all' || status === 'failed' ? undefined : status} />
    </div>
  )
}
