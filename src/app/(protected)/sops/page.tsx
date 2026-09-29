'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useAssignedSops } from '@/hooks/useAssignedSops'
import { useSopSync } from '@/hooks/useSopSync'
import { useWorkerSops } from '@/hooks/useWorkerSops'
import { db } from '@/lib/offline/db'
import { DepartmentBottomSheet } from '@/components/sop/CategoryBottomSheet'
import { createClient } from '@/lib/supabase/client'
import { selfAddSop, selfRemoveSop, requestRemoveAssignment } from '@/actions/assignments'
import { useIsAdmin } from '@/components/providers/RoleProvider'
import { useViewport } from '@/hooks/useViewport'
import dynamic from 'next/dynamic'
import type { WorkerSop, WorkerScope } from '@/lib/sop/worker-signal'
import type { Department } from '@/types/sop'
import { listSiteForWorker } from '@/actions/site-worker'
import type { WorkerSiteData } from '@/lib/validators/site'

/**
 * SB-LINE-06: /sops/[sopId]'s chunk set transitively includes /sops/page's own
 * route chunk, so ANY weight added to this page counts against the worker
 * detail route's bundle gate — measured, not assumed.
 *
 * Phase 54: the admin scope model, the three admin lenses and the Miller
 * frame are gone from this file entirely. An admin session mounts its own
 * table through ONE `next/dynamic({ ssr: false })` call gated on
 * `isAdmin && viewport === 'desktop'`; below that width an admin is a
 * worker (D-07) and takes the same path everyone else does. This file now
 * holds only the render gates and the slots each surface mounts into —
 * never the admin table's, the plant's, the phone home's, or the worker
 * list's own state, markup or camera logic.
 *
 * Phase 52 (D-01): the worker desktop home (PlantHome) is its own lazy
 * module for the same reason.
 *
 * Phase 53 (D-01): the phone home (PhoneHome) is a fourth lazy module — a
 * phone-width worker (or an admin on a phone) gets a different render seam
 * below the same shared site query.
 */
const WorkerSimpleList = dynamic(
  () => import('@/components/sop/WorkerSimpleList').then((m) => m.WorkerSimpleList),
  { ssr: false }
)
const AdminLibraryTable = dynamic(
  () => import('@/components/admin/AdminLibraryTable').then((m) => m.AdminLibraryTable),
  { ssr: false, loading: () => <div className="h-9 animate-pulse rounded bg-[var(--paper-2)]" /> }
)
const PlantHome = dynamic(
  () => import('@/components/sop/plant/PlantHome').then((m) => m.PlantHome),
  { ssr: false }
)
const PhoneHome = dynamic(
  () => import('@/components/sop/plant/PhoneHome').then((m) => m.PhoneHome),
  { ssr: false }
)

function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * A worker's scopes are about their own training clock — what is overdue,
 * what changed under them, what they have never done.
 *
 * `library` / `not-added` used to be a second top-level TAB, which forced the
 * worker to decide which of two pages a procedure lived on before they could
 * look for it. They are scopes of the same list instead.
 *
 * `always: false` scopes are only listed while they have something in them —
 * a column of zeros is noise, and on a fresh account it was most of the column.
 */
const WORKER_SCOPES: { key: WorkerScope; label: string; group: 'yours' | 'library'; always: boolean }[] = [
  { key: 'all', label: 'All yours', group: 'yours', always: true },
  { key: 'refresher', label: 'Refresher due', group: 'yours', always: false },
  { key: 'updated', label: 'Updated', group: 'yours', always: false },
  { key: 'not-done', label: 'Never done', group: 'yours', always: false },
  { key: 'library', label: 'Everything', group: 'library', always: true },
  { key: 'not-added', label: 'Not added yet', group: 'library', always: false },
]

const SCOPE_LABEL: Record<WorkerScope, string> = {
  all: 'All yours',
  refresher: 'Refresher due',
  updated: 'Updated since you read them',
  'not-done': 'Never done',
  library: 'Everything published',
  'not-added': 'Not added yet',
}

export default function SopsPage() {
  const isAdmin = useIsAdmin()

  // Phase 52 (D-01): the plant replaces the worker list for a non-admin
  // session at >=1024px once the org has a drawn site with >=1 machine.
  // Loading/undefined/error/no-layout/zero-machines all resolve plantSite
  // to null -- the fallback list renders first and the plant only swaps in
  // once a site is known (D-04). No persister: the signed URLs stay in
  // memory for the session only (T-52-02); staleTime is well under the
  // scene URL's 1hr TTL.
  const viewport = useViewport()
  // Legacy `/sops?view=attention` is /governance now (Phase 54). Decide it
  // here, before any role/viewport slot mounts: the admin table used to own
  // this redirect, but once the org has a site the mobile-seeded first paint
  // starts the phone-home chunk and the table's later replace never lands
  // (caught by the deployed eval the day the real org got its site map).
  // Reading window inside an effect is hydration-safe (2026-06-08).
  const router = useRouter()
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'attention') router.replace('/governance')
  }, [router])

  const wantsPlant = !isAdmin && viewport === 'desktop'
  // Phase 53 (D-01): an admin on a phone is a worker (contract) -- the phone
  // home is not gated on isAdmin. useViewport() starts at 'mobile' on first
  // paint (SSR-safe seed), so a desktop admin's first render briefly wants
  // the phone too -- one unused site read before the real viewport resolves.
  // ponytail: a "viewport resolved" flag on useViewport is the upgrade if
  // that first-paint read ever matters.
  const wantsPhone = viewport === 'mobile'
  const { data: siteResult } = useQuery({
    queryKey: ['site-worker'],
    queryFn: () => listSiteForWorker(),
    enabled: wantsPlant || wantsPhone,
    staleTime: 30 * 60 * 1000,
  })
  const site: WorkerSiteData | null =
    siteResult && !('error' in siteResult) && siteResult.layout && siteResult.machines.length > 0 ? siteResult : null
  const plantSite: WorkerSiteData | null = wantsPlant ? site : null
  const phoneSite: WorkerSiteData | null = wantsPhone ? site : null

  // One inline search box filters whichever list is showing — no overlay, no
  // second results surface. Searching is narrowing the list you are looking at.
  const [query, setQuery] = useState('')
  // Phase 25: department-based filter replacing the old category filter.
  // selectedDeptIds / allDepartments are view filters only — actual visibility is
  // gated by sops_visible_by_department RLS (Plan 01, T-25-10 mitigated).
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
  const [allDepartments, setAllDepartments] = useState(false)
  const [deptSheetOpen, setDeptSheetOpen] = useState(false)

  // Phase 54: the worker scope and the admin table's takeover state
  // (reported by AdminLibraryTable when the Access lens opens) each live
  // here as their own plain state — no shared nav object, no admin deep-link
  // resolution in this file at all (that lives inside AdminLibraryTable.tsx).
  const [scope, setScope] = useState<WorkerScope>('all')
  const [takeover, setTakeover] = useState(false)

  function applyWorkerScope(next: WorkerScope) {
    setScope(next)
    window.history.replaceState(null, '', '/sops')
  }

  const { syncing } = useSopSync()

  const { data: assignedSops = [], isLoading: assignedLoading } = useAssignedSops()

  // Fetch departments from Supabase for the filter panel.
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('departments')
        .select('id, name, colour, code, icon, archived, organisation_id, owner_user_id, created_at, updated_at')
        .eq('archived', false)
        .order('name', { ascending: true })
      return (data ?? []) as Department[]
    },
    staleTime: 1000 * 60 * 5,
  })

  // Phase 30 UX-08: real client-side department filter (was a no-op placebo).
  // sop_departments has SELECT using(true) for authenticated (migration 00035,
  // live-verified 2026-07-12) so workers can read the junction directly. Actual
  // visibility is still gated by sops_visible_by_department RLS on sops itself.
  const { data: sopDeptMap = {} } = useQuery<Record<string, string[]>>({
    queryKey: ['sop-departments-map'],
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('sop_departments')
        .select('sop_id, department_id') as { data: Array<{ sop_id: string; department_id: string }> | null }
      const map: Record<string, string[]> = {}
      for (const row of data ?? []) {
        ;(map[row.sop_id] ??= []).push(row.department_id)
      }
      return map
    },
    staleTime: 1000 * 60 * 5,
  })

  const { data: lastSyncMeta } = useQuery({
    queryKey: ['sync-meta-last-sync'],
    queryFn: async () => db.syncMeta.get('lastSync'),
    networkMode: 'offlineFirst',
  })
  const lastSyncLabel = syncing
    ? 'Syncing…'
    : lastSyncMeta?.value
      ? `Offline copy · ${getRelativeTime(lastSyncMeta.value)}`
      : 'Not saved for offline yet'

  const activeDeptLabel = allDepartments
    ? '◇ All departments'
    : selectedDeptIds.length > 0
      ? departments.filter((d) => selectedDeptIds.includes(d.id)).map((d) => d.name).join(', ')
      : 'All departments'

  function handleDeptSelect(ids: string[], all: boolean) {
    setSelectedDeptIds(ids)
    setAllDepartments(all)
  }

  const deptMatches = (sopId: string) =>
    allDepartments || selectedDeptIds.length === 0
      ? true
      : (sopDeptMap[sopId] ?? []).some((id) => selectedDeptIds.includes(id))

  const sectionProps = {
    assignedSops,
    isLoading: assignedLoading,
    query,
    activeDeptLabel,
    onOpenDeptSheet: () => setDeptSheetOpen(true),
    scope,
    onScopeChange: applyWorkerScope,
    deptMatches,
  }

  return (
    <div className="flex flex-col flex-1 bg-[var(--paper)]">
      {/* Toolbar: title · offline state · search. One row on desktop; the
          search box drops to its own full-width row on a phone so it stays a
          glove-sized target. Creating a SOP stays in the header (UX-04: one
          create entry). */}
      <nav className="sticky top-0 z-20 bg-[var(--paper)] border-b border-[var(--ink-100)]">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-base font-semibold text-[var(--ink-900)]">SOPs</h1>
          <span className="mono hidden text-meta text-[var(--ink-500)] sm:inline">{lastSyncLabel}</span>
          {!takeover && !plantSite && !phoneSite && (
          <label className="relative order-last flex min-h-tap w-full items-center sm:ml-auto sm:min-h-9 sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 text-[var(--ink-500)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SOPs…"
              aria-label="Search SOPs"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-full w-full rounded-lg border border-[var(--ink-300)] bg-white pl-9 pr-9 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1 flex h-8 w-8 items-center justify-center rounded text-[var(--ink-500)] hover:text-[var(--ink-900)]"
              >
                <X size={14} />
              </button>
            )}
          </label>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto w-full px-4 py-4">
        {isAdmin && viewport === 'desktop' ? (
          <AdminLibraryTable filter={query} onTakeoverChange={setTakeover} />
        ) : (
          <SopsSection {...sectionProps} plant={plantSite} phone={phoneSite} onQueryChange={setQuery} />
        )}
      </div>

      <DepartmentBottomSheet
        departments={departments}
        selectedIds={selectedDeptIds}
        allDepartments={allDepartments}
        onSelect={handleDeptSelect}
        open={deptSheetOpen}
        onClose={() => setDeptSheetOpen(false)}
      />
    </div>
  )
}

/* ─── The one list ───────────────────────────────────────────────────────── */

interface SopsSectionProps {
  assignedSops: ReturnType<typeof useAssignedSops>['data']
  isLoading: boolean
  query: string
  activeDeptLabel: string
  onOpenDeptSheet: () => void
  scope: WorkerScope
  onScopeChange: (s: WorkerScope) => void
  deptMatches: (sopId: string) => boolean
  /** Phase 52 (D-01): worker-only. Present only for a desktop worker whose org has a drawn site. */
  plant?: WorkerSiteData | null
  /** Phase 53 (D-01): set below 1024px when the org has a site (admin sessions included -- an admin on a phone is a worker). */
  phone?: WorkerSiteData | null
  onQueryChange?: (q: string) => void
}

function SopsSection({
  assignedSops = [],
  isLoading,
  query,
  activeDeptLabel,
  onOpenDeptSheet,
  scope,
  onScopeChange,
  deptMatches,
  plant,
  phone,
  onQueryChange,
}: SopsSectionProps) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  // The worker's per-SOP list is derived in exactly one place now --
  // src/hooks/useWorkerSops.ts -- so this file and Phase 53's /m/[code] page
  // can never disagree about a badge (CLAUDE.md 2026-09-27).
  const { workerSops: allWorkerSops, assignments, libraryLoading } = useWorkerSops(assignedSops, requestedIds)

  function getAssignmentInfo(sopId: string) {
    return assignments.find((a) => a.sop_id === sopId)
  }

  function handleRemove(sopId: string) {
    const info = getAssignmentInfo(sopId)
    startTransition(async () => {
      if (info?.isSelfAssigned) {
        await selfRemoveSop(sopId)
      } else {
        await requestRemoveAssignment(sopId)
        setRequestedIds((prev) => new Set(prev).add(sopId))
      }
      queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assigned-sops'] })
    })
  }

  function handleAdd(sopId: string) {
    startTransition(async () => {
      await selfAddSop(sopId)
      queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assigned-sops'] })
    })
  }

  // The department filter is view state owned by this page, not the hook.
  const workerSops: WorkerSop[] = allWorkerSops.filter((s) => deptMatches(s.id))

  const inScope = (s: WorkerSop, sc: WorkerScope) => {
    if (sc === 'library') return true
    if (sc === 'not-added') return !s.isAssigned
    if (!s.isAssigned) return false
    if (sc === 'refresher') return s.isRefresherDue || s.isRefresherOverdue
    if (sc === 'updated') return s.hasNewerVersion
    if (sc === 'not-done') return s.lastCompletedAt === null
    return true
  }

  const q = query.trim().toLowerCase()
  const matchesQuery = (s: WorkerSop) =>
    !q ||
    [s.title, s.raw.sop_number, s.categoryLabel, s.raw.department]
      .some((v) => v?.toLowerCase().includes(q))

  const scoped = workerSops.filter((s) => inScope(s, scope) && matchesQuery(s))
  const counts = Object.fromEntries(
    WORKER_SCOPES.map((sc) => [sc.key, workerSops.filter((s) => inScope(s, sc.key)).length])
  ) as Record<WorkerScope, number>
  const visibleScopes = WORKER_SCOPES.filter((sc) => sc.always || counts[sc.key] > 0 || scope === sc.key)

  const loading = isLoading || libraryLoading

  // D-01: the plant replaces the worker list and receives the exact list the
  // list would have shown -- refresher state, lineage-rooted completion
  // clock, version currency, department filter all included.
  if (plant && onQueryChange) return <PlantHome site={plant} sops={workerSops} loading={loading} query={query} onQueryChange={onQueryChange} />

  // A worker with nothing assigned used to land on "Nothing in All yours" — a
  // dead end one click from the whole library. Hand them the door.
  const emptyAction =
    !q && scope === 'all' && counts.library > 0
      ? { label: `Browse the library (${counts.library})`, onClick: () => onScopeChange('library') }
      : undefined

  return (
    <>
      {phone && onQueryChange && (
        <PhoneHome site={phone} sops={workerSops} loading={loading} query={query} onQueryChange={onQueryChange} />
      )}

      <WorkerSimpleList
        sops={scoped}
        scopes={visibleScopes.map((sc) => ({ key: sc.key, label: sc.label, count: counts[sc.key] }))}
        scope={scope}
        onScopeChange={onScopeChange}
        scopeLabel={SCOPE_LABEL[scope]}
        activeDeptLabel={activeDeptLabel}
        onOpenDeptSheet={onOpenDeptSheet}
        query={q}
        emptyAction={emptyAction}
        loading={loading}
        noSops={workerSops.length === 0}
        onAdd={handleAdd}
        onRemove={handleRemove}
        actionPending={pending}
      />
    </>
  )
}
