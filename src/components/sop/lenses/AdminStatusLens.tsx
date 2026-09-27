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
 *
 * The browser renders as `contents`, so its list + detail columns become
 * direct children of the page's Miller frame — same flush surface as the
 * worker list, not a card floating inside it.
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
  /** Live search term from the toolbar; narrows rows client-side. */
  filter?: string
  onResult?: (r: AdminSopListResult) => void
  onClearFilter: () => void
}

export function AdminStatusLens({
  status,
  ownerOnly,
  departments,
  collection,
  filter = '',
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
          <div key={i} className="h-tap-row animate-pulse rounded-lg bg-[var(--paper-2)] lg:h-9 lg:rounded" />
        ))}
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div className="py-12 text-center lg:col-span-2">
        <p className="mono mb-2 text-meta uppercase tracking-wider text-accent-escalate">ERROR</p>
        <p className="text-sm text-[var(--ink-500)]">{data.error}</p>
      </div>
    )
  }

  const q = filter.trim().toLowerCase()
  const sops = q
    ? data.sops.filter((s) =>
        [s.displayTitle, s.categoryLabel, s.ownerLabel, ...s.departments].some((v) => v?.toLowerCase().includes(q))
      )
    : data.sops

  return (
    <SopMillerBrowser
      sops={sops}
      scopeLabel={data.scopeLabel}
      departments={data.departments}
      hideStatus={status === 'all' || status === 'failed' ? undefined : status}
      query={q}
      // SC-4 viz-as-library-filter: a collection deep link is server-filtered;
      // the list header says so and offers the way back to the unfiltered
      // list. A department scope carries its own label, so no banner there.
      onClearFilter={data.filtered && !departments ? onClearFilter : undefined}
    />
  )
}
