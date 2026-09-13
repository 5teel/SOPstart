'use client'

/**
 * Phase 41 Plan 03 — client lens wrapping the unmodified `WiringPatchBayShell`
 * (org tree x collections x grants), fed by `listAdminAccessData`. This file
 * IS the dynamic chunk `sops/page.tsx` loads via `next/dynamic({ ssr: false })`
 * — `tests/lint/no-static-admin-lens-import.spec.ts` allowlists this file for
 * exactly that reason, so the static import of `WiringPatchBayShell` below is
 * correct and required, not a violation of the worker-bundle isolation rule.
 *
 * The wiring surface is wide: this lens renders FULL WIDTH, replacing the
 * Miller frame — it does not sit inside the frame's third column. That
 * matches today's `admin/sops/page.tsx` access-view branch exactly, and is
 * why the "Back" affordance below exists (there is no Miller scope column to
 * fall back into).
 *
 * Exiting the lens is a callback (`onBack`), never a navigation — a scope
 * change on the merged client page must not trigger an RSC fetch through the
 * service worker (CLAUDE.md 2026-05-13).
 */

import { useQuery } from '@tanstack/react-query'
import { listAdminAccessData } from '@/actions/admin-access-view'
import { WiringPatchBayShell } from '@/components/admin/wiring/WiringPatchBayShell'

export interface AdminAccessLensProps {
  pinnedSopId?: string
  onBack: () => void
}

export function AdminAccessLens({ pinnedSopId, onBack }: AdminAccessLensProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-access-view', pinnedSopId ?? null],
    queryFn: () => listAdminAccessData({ sop: pinnedSopId }),
    staleTime: 0,
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
        <div className="blueprint-frame text-center py-12">
          <p className="mono text-[11px] text-red-600 uppercase tracking-wider mb-2">ERROR</p>
          <p className="text-sm text-[var(--ink-500)]">{data.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {backLink}
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
