'use client'

/**
 * Client lens wrapping the unmodified `WiringPatchBayShell` (org tree x
 * collections x grants), fed by `listAdminAccessData`. Phase 57 mounts it on
 * the admin-gated Access bridge page (`/admin/access`); the layout's Back to
 * the site bar is the way out, so the lens carries no back button of its own.
 * `tests/lint/no-static-admin-lens-import.spec.ts` allowlists this file for the
 * static import of `WiringPatchBayShell` below.
 */

import { useQuery } from '@tanstack/react-query'
import { listAdminAccessData } from '@/actions/admin-access-view'
import { WiringPatchBayShell } from '@/components/admin/wiring/WiringPatchBayShell'

export interface AdminAccessLensProps {
  pinnedSopId?: string
}

export function AdminAccessLens({ pinnedSopId }: AdminAccessLensProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-access-view', pinnedSopId ?? null],
    queryFn: () => listAdminAccessData({ sop: pinnedSopId }),
    staleTime: 0,
  })

  if (isLoading || !data) {
    return (
      <div>
        <div className="flex flex-col gap-2 p-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-tap-row animate-pulse rounded-lg bg-[var(--paper-2)] lg:h-9 lg:rounded" />
          ))}
        </div>
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div>
        <div className="blueprint-frame text-center py-12">
          <p className="mono text-meta text-accent-escalate uppercase tracking-wider mb-2">ERROR</p>
          <p className="text-sm text-[var(--ink-500)]">{data.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <WiringPatchBayShell
        tree={data.tree}
        collections={data.collections}
        sopsByCollection={data.sopsByCollection}
        grants={data.grants}
        newSop={data.newSop}
        deptMembers={data.deptMembers}
      />
    </div>
  )
}
