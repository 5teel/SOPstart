'use client'

/**
 * Phase 41 bundle-regression fix (deviation from 41-05). Everything that is
 * ONLY needed for an admin/safety_manager session on `/sops` lives here:
 * the AdminScope model, the legacy /admin/sops deep-link resolution, the
 * admin Miller scope-group rows (desktop + mobile), and the three lens
 * `next/dynamic({ ssr: false })` bindings. `src/app/(protected)/sops/page.tsx`
 * loads this whole module via ONE `dynamic({ ssr: false })` call gated on
 * `useIsAdmin()` — a worker session never fetches this chunk at all, and the
 * ~4-5KB this content used to cost the always-loaded worker bundle (recorded
 * as a "bundle baseline recapture" deviation in 41-05-SUMMARY.md) is gone
 * from `/sops/page`'s and `/sops/[sopId]/page`'s First Load JS entirely
 * (SB-LINE-06 / D-08 / ROADMAP SC-5).
 *
 * Trade-off: `resolveAdminScope` used to run synchronously on `/sops/page`'s
 * first client render (before this code-split existed) so a bookmarked
 * `?status=draft` link never flashed the wrong scope. Now it only runs once
 * this chunk has loaded, so `SopsPage` seeds admins straight to `admin-all`
 * (matching today's plain-`/sops` landing experience with zero flash) and
 * this component corrects `nav` via `onNavChange` the moment it resolves the
 * real URL — a deep link with query params can show `admin-all` for one
 * chunk-load tick before flipping to the linked scope. This is the same
 * class of trade-off the three lenses below already accept (they are
 * `ssr:false` and render nothing until their own chunk arrives); it is not a
 * new pattern, only a bigger dose of the existing one.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { AdminSopListResult } from '@/lib/sop-list/admin-rows'
import type { SopScope, SopNav, WorkerScope } from './sops-nav-types'
import { MillerColumnHeader, MillerItem } from './MillerPrimitives'

/** Shown while a lens chunk is in flight (~400 ms on prod) — without it the
 *  takeover lenses replace the Miller frame with nothing until they arrive
 *  (blank flash caught by the 2026-09-15 deployed-site eval). Same bars the
 *  lenses themselves show while their data loads, so the swap is seamless. */
function LensSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3 lg:col-span-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-lg bg-[var(--paper-2)] lg:h-9 lg:rounded" />
      ))}
    </div>
  )
}

const AdminStatusLens = dynamic(
  () => import('./lenses/AdminStatusLens').then((m) => m.AdminStatusLens),
  { ssr: false, loading: LensSkeleton }
)
const AdminAttentionLens = dynamic(
  () => import('./lenses/AdminAttentionLens').then((m) => m.AdminAttentionLens),
  { ssr: false, loading: LensSkeleton }
)
const AdminAccessLens = dynamic(
  () => import('./lenses/AdminAccessLens').then((m) => m.AdminAccessLens),
  { ssr: false, loading: LensSkeleton }
)

export type AdminScope =
  | 'admin-all'
  | 'admin-draft'
  | 'admin-published'
  | 'admin-failed'
  | 'admin-attention'
  | 'admin-access'

const ADMIN_SCOPES: { key: AdminScope; label: string }[] = [
  { key: 'admin-all', label: 'All SOPs' },
  { key: 'admin-draft', label: 'Drafts' },
  { key: 'admin-published', label: 'Published' },
  { key: 'admin-failed', label: 'Still working' },
  { key: 'admin-attention', label: 'Needs attention' },
  { key: 'admin-access', label: 'Access' },
]

// Single map doubles as the isAdminStatusScope() membership test (`in`) and
// the scope->status lookup navToUrl() needs (SB-LINE-06 byte-budget idiom
// carried over from 41-05, now paid for only by admin sessions).
const ADMIN_STATUS: Record<'admin-all' | 'admin-draft' | 'admin-published' | 'admin-failed', 'all' | 'draft' | 'published' | 'failed'> = {
  'admin-all': 'all',
  'admin-draft': 'draft',
  'admin-published': 'published',
  'admin-failed': 'failed',
}
function isAdminStatusScope(scope: SopScope): scope is keyof typeof ADMIN_STATUS {
  return scope in ADMIN_STATUS
}

/**
 * Resolves every legacy /admin/sops deep link onto an admin scope, mirroring
 * the precedence in admin/sops/page.tsx:137-154. Only ever invoked for an
 * admin session — this module is never even fetched for a non-admin one
 * (T-41-05: the mount gate in page.tsx is a stronger guarantee than the
 * runtime `if (!isAdmin)` branch this function used to open with).
 */
function resolveAdminScope(params: URLSearchParams): SopNav {
  const view = params.get('view')
  if (view === 'attention') return { scope: 'admin-attention', ownerOnly: false }
  if (view === 'access') {
    // SC-4 (RESEARCH Pitfall 5): departments/collection are inert under the
    // access lens — dropped here entirely, not merely ignored downstream.
    return { scope: 'admin-access', ownerOnly: false, sop: params.get('sop') ?? undefined }
  }

  const status = params.get('status')
  if (status === 'draft' || status === 'published' || status === 'failed') {
    return { scope: (`admin-${status}`) as AdminScope, ownerOnly: false }
  }

  if (params.get('owner') === 'me') return { scope: 'admin-all', ownerOnly: true }

  const departments = params.get('departments')
  const collection = params.get('collection')
  if (departments || collection) {
    return {
      scope: 'admin-all',
      ownerOnly: false,
      departments: departments ?? undefined,
      collection: collection ?? undefined,
    }
  }

  return { scope: 'admin-all', ownerOnly: false }
}

/** Builds the /sops URL for a given admin nav state. */
function navToUrl(nav: SopNav): string {
  const qp = new URLSearchParams()
  if (nav.scope === 'admin-attention') {
    qp.set('view', 'attention')
  } else if (nav.scope === 'admin-access') {
    qp.set('view', 'access')
    if (nav.sop) qp.set('sop', nav.sop)
  } else if (isAdminStatusScope(nav.scope)) {
    const status = ADMIN_STATUS[nav.scope]
    if (status !== 'all') qp.set('status', status)
    if (nav.ownerOnly) qp.set('owner', 'me')
    if (nav.departments) qp.set('departments', nav.departments)
    if (nav.collection) qp.set('collection', nav.collection)
  }
  const qs = qp.toString()
  return qs ? `/sops?${qs}` : '/sops'
}

function navsEqual(a: SopNav, b: SopNav): boolean {
  return (
    a.scope === b.scope &&
    a.ownerOnly === b.ownerOnly &&
    a.departments === b.departments &&
    a.collection === b.collection &&
    a.sop === b.sop
  )
}

export interface AdminRenderProps {
  desktopRows: ReactNode
  mobileRows: ReactNode
  inFrameElement: ReactNode | null
  takeoverElement: ReactNode | null
  hideWorkerSummary: boolean
}

export const EMPTY_ADMIN: AdminRenderProps = {
  desktopRows: null,
  mobileRows: null,
  inFrameElement: null,
  takeoverElement: null,
  hideWorkerSummary: false,
}

interface AdminSopSurfaceProps {
  nav: SopNav
  onNavChange: (nav: SopNav) => void
  children: (admin: AdminRenderProps) => ReactNode
}

/**
 * Headless controller + Miller-row renderer for the admin scopes. Returns
 * `children(admin)` every render — no imperative "report state up" callback,
 * so there is no risk of a render-phase setState loop between this component
 * and `SopsPage`'s own `nav` state (`onNavChange` is only ever called from an
 * effect or an event handler, never during render).
 */
export function AdminSopSurface({ nav, onNavChange, children }: AdminSopSurfaceProps) {
  const searchParams = useSearchParams()
  const [counts, setCounts] = useState<AdminSopListResult | null>(null)

  // Resolve the full URL once this chunk has loaded, and again on back/
  // forward or a same-route deep link arriving while mounted. Never fires
  // from our own history.replaceState writes below — useSearchParams() only
  // observes next/navigation's own push/replace, not raw window.history
  // (CLAUDE.md 2026-05-13), so this cannot loop against applyScope.
  useEffect(() => {
    const resolved = resolveAdminScope(new URLSearchParams(searchParams.toString()))
    onNavChange(resolved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  function applyScope(
    next: AdminScope,
    patch?: { ownerOnly?: boolean; departments?: string; collection?: string }
  ) {
    const nextNav: SopNav = {
      scope: next,
      ownerOnly: patch?.ownerOnly ?? false,
      departments: patch?.departments,
      collection: patch?.collection,
      // Leaving the access scope drops the pinned ?sop= — it only means
      // anything inside that lens.
      sop: next === 'admin-access' ? nav.sop : undefined,
    }
    onNavChange(nextNav)
    window.history.replaceState(null, '', navToUrl(nextNav))
  }

  // Back from a takeover lens returns to the WORKER 'all' scope, not
  // 'admin-all' — the lens's only affordance back is "Back to your SOPs".
  function backToWorkerAll() {
    const nextNav: SopNav = { scope: 'all' as WorkerScope, ownerOnly: false }
    onNavChange(nextNav)
    window.history.replaceState(null, '', '/sops')
  }

  const scope = nav.scope
  const visibleAdminScopes = ADMIN_SCOPES.filter(
    (sc) => sc.key !== 'admin-failed' || !counts || counts.railCounts.failed > 0
  )

  function scopeCount(key: AdminScope): number | undefined {
    if (!counts) return undefined
    if (key === 'admin-attention') return counts.flaggedCount
    if (key === 'admin-access') return undefined
    return counts.railCounts[ADMIN_STATUS[key as keyof typeof ADMIN_STATUS]]
  }

  const desktopRows = (
    <>
      <MillerColumnHeader>Admin</MillerColumnHeader>
      {visibleAdminScopes.map((sc) => (
        <MillerItem
          key={sc.key}
          selected={scope === sc.key}
          onClick={() => applyScope(sc.key)}
          count={scopeCount(sc.key)}
        >
          {sc.label}
        </MillerItem>
      ))}
      <MillerItem
        selected={nav.ownerOnly}
        onClick={() => applyScope('admin-all', { ownerOnly: !nav.ownerOnly })}
      >
        Owned by me
      </MillerItem>

      {/* By-department scope rows + "No department" (the reachable scope for
          SOPs nobody can be assigned — the fix is inline in the detail pane,
          so a row leaves this scope the moment you fix it). Rule 1 fix
          (CLAUDE.md 2026-07-13 "hook fetched the data then threw it away"):
          listAdminSopRows has always computed scopeDepartments/noAudienceCount
          into `counts` via onResult below, but the 41-05 bundle-budget
          extraction into this file dropped the render of it — restored here,
          verbatim from admin/sops/page.tsx's original scope column. */}
      {isAdminStatusScope(scope) && counts && counts.scopeDepartments.length > 0 && (
        <>
          <MillerColumnHeader>By department</MillerColumnHeader>
          {counts.scopeDepartments.map((d) => (
            <MillerItem
              key={d.id}
              selected={scope === 'admin-all' && nav.departments === d.id}
              onClick={() => applyScope('admin-all', { departments: d.id })}
              count={d.count}
            >
              {d.name}
            </MillerItem>
          ))}
          {counts.noAudienceCount > 0 && (
            <MillerItem
              selected={scope === 'admin-all' && nav.departments === 'none'}
              onClick={() => applyScope('admin-all', { departments: 'none' })}
              count={counts.noAudienceCount}
            >
              No department
            </MillerItem>
          )}
        </>
      )}
    </>
  )

  const mobileRows = (
    <>
      {visibleAdminScopes.map((sc) => (
        <button
          key={sc.key}
          type="button"
          onClick={() => applyScope(sc.key)}
          className={`flex-shrink-0 min-h-11 rounded-xl border px-3 text-sm font-medium ${
            scope === sc.key
              ? 'border-[var(--ink-900)] bg-[var(--ink-900)] text-white'
              : 'border-[var(--ink-100)] bg-white text-[var(--ink-700)]'
          }`}
        >
          {sc.label}
          <span className="mono ml-1 text-[11px] opacity-70">{scopeCount(sc.key) ?? ''}</span>
        </button>
      ))}
    </>
  )

  const inFrameElement = isAdminStatusScope(scope) ? (
    <AdminStatusLens
      status={ADMIN_STATUS[scope]}
      ownerOnly={nav.ownerOnly}
      departments={nav.departments}
      collection={nav.collection}
      onResult={setCounts}
      onClearFilter={() => applyScope('admin-all')}
    />
  ) : null

  const takeoverElement =
    scope === 'admin-attention' ? (
      <AdminAttentionLens onBack={backToWorkerAll} />
    ) : scope === 'admin-access' ? (
      <AdminAccessLens pinnedSopId={nav.sop} onBack={backToWorkerAll} />
    ) : null

  return (
    <>
      {children({
        desktopRows,
        mobileRows,
        inFrameElement,
        takeoverElement,
        hideWorkerSummary: isAdminStatusScope(scope),
      })}
    </>
  )
}
