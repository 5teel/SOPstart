'use client'

/**
 * Phase 54 Plan 04 (D-07/D-08) — the admin library: SOP · Machine · Status ·
 * Owner · Checks · Review, five 18px check circles per row, chips that
 * narrow the table, and the deep links Phase 33/41 already promised
 * (?departments= ?collection= ?status= ?owner=me). Loaded only through
 * `next/dynamic({ ssr:false })` from sops/page.tsx under `useIsAdmin()` —
 * `tests/lint/no-static-admin-lens-import.spec.ts` never sees this file
 * imported statically anywhere. The Access lens is a lazy takeover mounted
 * INSIDE this module (not a sibling of it) so `?view=access` keeps working
 * without page.tsx ever knowing the lens exists (T-54-04).
 *
 * Checks come from admin-health.ts and are never re-derived here (CLAUDE.md
 * 2026-09-27 — "a classifier written twice will drift"). Scope changes are
 * client state + `history.replaceState`, never a `router.push` or `<Link>`
 * (CLAUDE.md 2026-05-13 — a search-param push through the service worker is
 * the hot-path tax this file exists to avoid).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { listAdminSopRows } from '@/actions/admin-sop-list'
import {
  DEFAULT_LIBRARY_NAV,
  resolveLibraryNav,
  libraryNavToUrl,
  type LibraryNav,
} from '@/lib/sop-list/admin-rows'
import { deriveChecks, tableStatus, CHECK_ORDER, type CheckKey } from '@/lib/sop/admin-health'

function LensSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded bg-[var(--paper-2)]" />
      ))}
    </div>
  )
}

const AdminAccessLens = dynamic(
  () => import('@/components/sop/lenses/AdminAccessLens').then((m) => m.AdminAccessLens),
  { ssr: false, loading: LensSkeleton }
)

const CHECK_TITLE: Record<CheckKey, string> = {
  owner: 'Has an owner',
  review: 'Reviewed within 12 months',
  approved: 'Approved',
  assigned: 'Assigned to someone',
  converted: 'Converted cleanly',
}

const CHECK_GLYPH: Record<'ok' | 'warn' | 'bad', string> = { ok: '✓', warn: '!', bad: '×' }
const CHECK_STYLE: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'bg-accent-ok',
  warn: 'bg-accent-decision',
  bad: 'bg-accent-escalate',
}

const STATUS_STYLE: Record<'LIVE' | 'DRAFT' | 'STUCK', string> = {
  LIVE: 'bg-accent-ok/14 text-accent-ok',
  DRAFT: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  STUCK: 'bg-accent-escalate/12 text-accent-escalate',
}

function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export interface AdminLibraryTableProps {
  filter: string
  onTakeoverChange: (takeover: boolean) => void
}

export function AdminLibraryTable({ filter, onTakeoverChange }: AdminLibraryTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [nav, setNav] = useState<LibraryNav>(DEFAULT_LIBRARY_NAV)

  // Resolves the full URL once this chunk has loaded, and again on back/
  // forward or a same-route deep link arriving while mounted — never fires
  // from our own history.replaceState writes below (useSearchParams() only
  // observes next/navigation's own push/replace, CLAUDE.md 2026-05-13).
  useEffect(() => {
    const resolved = resolveLibraryNav(new URLSearchParams(searchParams.toString()))
    if (resolved === 'governance') {
      router.replace('/governance')
      return
    }
    setNav(resolved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  useEffect(() => {
    onTakeoverChange(nav.view === 'access')
  }, [nav.view, onTakeoverChange])

  function applyNav(next: LibraryNav) {
    setNav(next)
    window.history.replaceState(null, '', libraryNavToUrl(next))
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sop-rows', 'library', nav.owner === 'me', nav.departments ?? null, nav.collection ?? null],
    queryFn: () =>
      listAdminSopRows({
        owner: nav.owner === 'me' ? 'me' : undefined,
        departments: nav.departments,
        collection: nav.collection,
      }),
    staleTime: 60_000,
    enabled: nav.view === 'table',
  })

  const owners = useMemo(() => {
    if (!data || 'error' in data) return []
    const byId = new Map<string, string>()
    for (const sop of data.sops) {
      if (sop.ownerUserId && sop.ownerLabel) byId.set(sop.ownerUserId, sop.ownerLabel)
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const rows = useMemo(() => {
    if (!data || 'error' in data) return []
    const q = filter.trim().toLowerCase()
    return data.sops
      .map((sop) => ({ sop, checks: deriveChecks(sop), status: tableStatus(sop) }))
      .filter(({ sop, checks, status }) => {
        if (nav.status !== 'all' && status !== nav.status) return false
        if (nav.owner === 'none' && !sop.flags.includes('unowned')) return false
        if (nav.owner !== 'all' && nav.owner !== 'me' && nav.owner !== 'none' && sop.ownerUserId !== nav.owner) {
          return false
        }
        if (nav.checks === 'red' && !CHECK_ORDER.some((k) => checks[k] === 'bad')) return false
        if (nav.checks === 'amber' && !CHECK_ORDER.some((k) => checks[k] === 'warn')) return false
        if (q) {
          const hay = [sop.displayTitle, ...sop.machines, sop.ownerLabel ?? '', ...sop.departments]
            .join(' ')
            .toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
  }, [data, filter, nav])

  if (nav.view === 'access') {
    return <AdminAccessLens pinnedSopId={nav.sop} onBack={() => applyNav(DEFAULT_LIBRARY_NAV)} />
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded bg-[var(--paper-2)]" />
        ))}
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div className="py-12 text-center">
        <p className="mono mb-2 text-meta uppercase tracking-wider text-accent-escalate">ERROR</p>
        <p className="text-sm text-[var(--ink-500)]">{data.error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-[var(--ink-900)]">Library</h2>
        <span className="mono text-meta text-[var(--ink-500)]">{rows.length} SOPs</span>

        <select
          data-testid="lib-chip-where"
          value={nav.departments ?? ''}
          onChange={(e) => applyNav({ ...nav, departments: e.target.value || undefined, collection: undefined })}
          className="min-h-9 rounded-full border border-[var(--ink-200)] px-2.5 text-xs text-[var(--ink-700)]"
        >
          <option value="">Everywhere</option>
          {data.scopeDepartments.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.count})</option>
          ))}
          {data.noAudienceCount > 0 && <option value="none">No department ({data.noAudienceCount})</option>}
        </select>

        <select
          data-testid="lib-chip-status"
          value={nav.status}
          onChange={(e) => applyNav({ ...nav, status: e.target.value as LibraryNav['status'] })}
          className="min-h-9 rounded-full border border-[var(--ink-200)] px-2.5 text-xs text-[var(--ink-700)]"
        >
          <option value="all">All</option>
          <option value="LIVE">Live</option>
          <option value="DRAFT">Draft</option>
          <option value="STUCK">Stuck</option>
        </select>

        <select
          data-testid="lib-chip-owner"
          value={nav.owner}
          onChange={(e) => applyNav({ ...nav, owner: e.target.value })}
          className="min-h-9 rounded-full border border-[var(--ink-200)] px-2.5 text-xs text-[var(--ink-700)]"
        >
          <option value="all">Everyone</option>
          <option value="me">Me</option>
          <option value="none">No owner</option>
          {owners.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>

        <select
          data-testid="lib-chip-checks"
          value={nav.checks}
          onChange={(e) => applyNav({ ...nav, checks: e.target.value as LibraryNav['checks'] })}
          className="min-h-9 rounded-full border border-[var(--ink-200)] px-2.5 text-xs text-[var(--ink-700)]"
        >
          <option value="all">Any</option>
          <option value="red">Has a red</option>
          <option value="amber">Has an amber</option>
        </select>

        {nav.collection && (
          <button
            type="button"
            data-testid="lib-chip-collection"
            onClick={() => applyNav({ ...nav, collection: undefined })}
            className="min-h-9 rounded-full border border-[var(--ink-200)] px-2.5 text-xs text-[var(--ink-700)] underline"
          >
            In a collection ×
          </button>
        )}

        <button
          type="button"
          data-testid="lib-access"
          onClick={() => applyNav({ ...DEFAULT_LIBRARY_NAV, view: 'access' })}
          className="ml-auto min-h-9 rounded-full border border-[var(--ink-300)] px-2.5 text-xs font-medium text-[var(--ink-900)]"
        >
          Access map
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-[var(--ink-500)]">No SOPs match these filters.</p>
          <button
            type="button"
            onClick={() => applyNav(DEFAULT_LIBRARY_NAV)}
            className="min-h-9 rounded-lg border border-[var(--ink-300)] px-3 text-sm text-[var(--ink-900)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table data-testid="library-table" className="w-full border-collapse text-left">
            <thead>
              <tr className="mono border-b border-[var(--ink-200)] text-meta uppercase tracking-widest text-[var(--ink-500)]">
                <th className="px-2 py-2">SOP</th>
                <th className="px-2 py-2">Machine</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Owner</th>
                <th className="px-2 py-2">Checks</th>
                <th className="px-2 py-2">Review</th>
                <th className="px-2 py-2 sr-only">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sop, checks, status }) => (
                <tr key={sop.id} data-testid="lib-row" data-sop-id={sop.id} className="border-b border-[var(--ink-100)]">
                  <td className="px-2 py-2">
                    <Link
                      href={`/sops/${sop.id}`}
                      className={`text-sm font-semibold hover:underline ${sop.untitled ? 'italic text-[var(--ink-700)]' : 'text-[var(--ink-900)]'}`}
                    >
                      {sop.displayTitle}
                    </Link>
                  </td>
                  <td className="mono px-2 py-2 text-meta text-[var(--ink-500)]">{sop.machines.join(', ') || '—'}</td>
                  <td className="px-2 py-2">
                    <span data-testid="lib-status" data-status={status} className={`mono inline-block rounded px-1.5 py-0.5 text-meta ${STATUS_STYLE[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-sm">
                    {sop.ownerLabel ? (
                      sop.ownerLabel
                    ) : (
                      <span className="mono rounded bg-accent-escalate/12 px-1.5 py-0.5 text-meta text-accent-escalate">none</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {CHECK_ORDER.map((key) => (
                        <span
                          key={key}
                          data-testid="lib-check"
                          data-check={key}
                          data-state={checks[key]}
                          title={CHECK_TITLE[key]}
                          className={`grid h-4 w-4 place-items-center rounded-full text-micro font-extrabold text-white ${CHECK_STYLE[checks[key]]}`}
                        >
                          {CHECK_GLYPH[checks[key]]}
                          <span className="sr-only">{CHECK_TITLE[key]}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="mono px-2 py-2 text-meta text-[var(--ink-500)]">
                    {formatMonthYear(sop.lastReviewedAt) ?? '—'}
                  </td>
                  <td className="px-2 py-2">
                    <Link data-testid="lib-edit" href={`/admin/sops/builder/${sop.id}`} className="text-meta text-[var(--ink-500)] underline-offset-2 hover:text-[var(--ink-900)] hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-ui text-[var(--ink-500)]">
            Checks, left to right: has an owner · reviewed within 12 months · approved · assigned to someone · converted cleanly. Five greens means nothing to do.
          </p>
        </div>
      )}
    </div>
  )
}
