'use client'
import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Search,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  Minus,
  FileText,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { useAssignedSops } from '@/hooks/useAssignedSops'
import { useSopSync } from '@/hooks/useSopSync'
import { db } from '@/lib/offline/db'
import { SopSearchInput } from '@/components/sop/SopSearchInput'
import { DepartmentBottomSheet, DepartmentSidebar } from '@/components/sop/CategoryBottomSheet'
import { createClient } from '@/lib/supabase/client'
import { selfAddSop, selfRemoveSop, requestRemoveAssignment, getUserSopAssignments } from '@/actions/assignments'
import { refresherDueDate, isRefresherDue as computeRefresherDue, isRefresherOverdue as computeRefresherOverdue } from '@/lib/competency/refresher'
import { categoryLabel } from '@/lib/sop-categories'
import { SopWorkerBrowser, type WorkerSop } from '@/components/sop/SopWorkerBrowser'
import type { Department } from '@/types/sop'

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

type Section = 'your-sops' | 'library'

/**
 * Sketch 005 variant C on the worker side. The admin scopes are about the
 * library's health (drafts, stuck, published); a worker's are about their own
 * training clock — what is overdue, what changed under them, what they have
 * never done. Same layout language, different questions.
 */
export type WorkerScope = 'all' | 'refresher' | 'updated' | 'not-done'

const WORKER_SCOPES: { key: WorkerScope; label: string }[] = [
  { key: 'all', label: 'All yours' },
  { key: 'refresher', label: 'Refresher due' },
  { key: 'updated', label: 'Updated' },
  { key: 'not-done', label: 'Never done' },
]

const SCOPE_LABEL: Record<WorkerScope, string> = {
  all: 'All yours',
  refresher: 'Refresher due',
  updated: 'Updated since you read them',
  'not-done': 'Never done',
}

export default function SopsPage() {
  const [activeSection, setActiveSection] = useState<Section>('your-sops')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // Phase 25: department-based filter replacing the old category filter.
  // selectedDeptIds / allDepartments are view filters only — actual visibility is
  // gated by sops_visible_by_department RLS (Plan 01, T-25-10 mitigated).
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
  const [allDepartments, setAllDepartments] = useState(false)
  const [deptSheetOpen, setDeptSheetOpen] = useState(false)
  const [workerScope, setWorkerScope] = useState<WorkerScope>('all')

  const { syncing } = useSopSync()

  const { data: assignedSops = [], isLoading: assignedLoading } = useAssignedSops()
  const { data: searchResults = [] } = useAssignedSops({ search: searchTerm || undefined })

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

  // If no departments selected (and not allDepartments), show all.
  const filteredSops = (allDepartments || selectedDeptIds.length === 0)
    ? assignedSops
    : assignedSops.filter((sop) => (sopDeptMap[sop.id] ?? []).some((id) => selectedDeptIds.includes(id)))

  const { data: lastSyncMeta } = useQuery({
    queryKey: ['sync-meta-last-sync'],
    queryFn: async () => db.syncMeta.get('lastSync'),
    networkMode: 'offlineFirst',
  })
  const lastSyncLabel = lastSyncMeta?.value
    ? `Synced ${getRelativeTime(lastSyncMeta.value)}`
    : syncing ? 'Syncing...' : 'Not yet synced'

  const activeDeptLabel = allDepartments
    ? '◇ All departments'
    : selectedDeptIds.length > 0
      ? departments.filter((d) => selectedDeptIds.includes(d.id)).map((d) => d.name).join(', ')
      : 'All departments'

  function handleDeptSelect(ids: string[], all: boolean) {
    setSelectedDeptIds(ids)
    setAllDepartments(all)
  }

  return (
    <div className="flex flex-col flex-1 bg-[var(--paper)]">
      {/* Section tabs + search — UX-04: no worker-side create entry (admins create via admin nav) */}
      <nav className="sticky top-0 z-20 bg-[var(--paper)] border-b border-[var(--ink-100)]">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveSection('your-sops')}
          className={[
            'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
            activeSection === 'your-sops'
              ? 'border-b-2 border-[var(--ink-900)] text-[var(--ink-900)]'
              : 'text-[var(--ink-500)] hover:text-[var(--ink-900)]',
          ].join(' ')}
        >
          <FileText size={16} />
          <span>Your SOPs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('library')}
          className={[
            'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
            activeSection === 'library'
              ? 'border-b-2 border-[var(--ink-900)] text-[var(--ink-900)]'
              : 'text-[var(--ink-500)] hover:text-[var(--ink-900)]',
          ].join(' ')}
        >
          <BookOpen size={16} />
          <span>SOP Library</span>
        </button>
        <button
          type="button"
          onClick={() => { setSearchTerm(''); setSearchOpen(true) }}
          aria-label="Search SOPs"
          className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--paper-2)] transition-colors"
        >
          {syncing ? (
            <RefreshCw size={20} className="text-[var(--accent-measure)] animate-spin" />
          ) : (
            <Search size={20} className="text-[var(--ink-500)] hover:text-[var(--ink-900)]" />
          )}
        </button>
        </div>
      </nav>

      {/* Desktop layout: sidebar + content, on the shared 5xl rail */}
      <div className="flex flex-1 max-w-5xl mx-auto w-full">
        {activeSection === 'your-sops' && (
          <nav aria-label="Scope" data-testid="worker-miller-scope" className="hidden w-[150px] flex-shrink-0 px-2 py-6 lg:block">
            <p className="mono mb-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-400)]">Your SOPs</p>
            <ul className="mb-4">
              {WORKER_SCOPES.map((sc) => (
                <li key={sc.key}>
                  <button
                    type="button"
                    onClick={() => setWorkerScope(sc.key)}
                    data-active={workerScope === sc.key ? 'true' : undefined}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                      workerScope === sc.key
                        ? 'bg-[var(--ink-900)] font-semibold text-white'
                        : 'text-[var(--ink-700)] hover:bg-[var(--paper-2)]'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{sc.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            {/* The department filter keeps its own component — it already owns
                the selection model and the mobile bottom-sheet twin. */}
            <p className="mono mb-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-400)]">By department</p>
            <DepartmentSidebar
              departments={departments}
              selectedIds={selectedDeptIds}
              allDepartments={allDepartments}
              onSelect={handleDeptSelect}
            />
          </nav>
        )}

        <div className="flex-1 px-4 py-6 min-w-0">
          {activeSection === 'your-sops' && (
            <YourSopsSection
              sops={filteredSops}
              isLoading={assignedLoading}
              lastSyncLabel={lastSyncLabel}
              activeDeptLabel={activeDeptLabel}
              onOpenDeptSheet={() => setDeptSheetOpen(true)}
              scope={workerScope}
              onScopeChange={setWorkerScope}
              scopeLabel={SCOPE_LABEL[workerScope]}
            />
          )}
          {activeSection === 'library' && <LibrarySection />}
        </div>
      </div>

      {/* Mobile department bottom sheet */}
      {activeSection === 'your-sops' && (
        <DepartmentBottomSheet
          departments={departments}
          selectedIds={selectedDeptIds}
          allDepartments={allDepartments}
          onSelect={handleDeptSelect}
          open={deptSheetOpen}
          onClose={() => setDeptSheetOpen(false)}
        />
      )}

      {/* Search overlay */}
      {searchOpen && (
        <SopSearchInput
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          onClose={() => { setSearchOpen(false); setSearchTerm('') }}
          results={searchResults}
        />
      )}
    </div>
  )
}

/* ─── Your SOPs Section ──────────────────────────────────────────────────── */

interface YourSopsSectionProps {
  sops: ReturnType<typeof useAssignedSops>['data']
  isLoading: boolean
  lastSyncLabel: string
  activeDeptLabel: string
  onOpenDeptSheet: () => void
  /** Sketch 005 variant C — which worker scope the left column has selected. */
  scope: WorkerScope
  onScopeChange: (s: WorkerScope) => void
  scopeLabel: string
}

function YourSopsSection({ sops = [], isLoading, lastSyncLabel, activeDeptLabel, onOpenDeptSheet, scope, onScopeChange, scopeLabel }: YourSopsSectionProps) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  const { data: assignments = [] } = useQuery({
    queryKey: ['user-sop-assignments'],
    queryFn: getUserSopAssignments,
    staleTime: 1000 * 60 * 5,
  })

  // AFL-VER-04 / D-08: fetch the worker's most recent completion submitted_at per SOP.
  // Compares sops.published_at (on the CachedSop) vs MAX(sop_completions.submitted_at).
  // Any newer published version triggers the "Updated" badge — no material-change
  // classification (D-08). WR-02: RLS alone is NOT a self-scope here —
  // admins/safety managers read org-wide completions and supervisors read
  // their assigned workers', so without an explicit worker_id filter those
  // roles' refresher chips and "Updated" badges render from OTHER people's
  // training clocks. Filter to the current user explicitly.
  const { data: lastCompletionMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['worker-last-completions'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('sop_completions')
        .select('sop_id, submitted_at')
        .eq('worker_id', user?.id ?? '')
        .order('submitted_at', { ascending: false }) as {
          data: Array<{ sop_id: string; submitted_at: string }> | null
        }
      // Build a map: sop_id → most recent submitted_at
      // (the query returns newest-first so first match per sop_id wins)
      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        if (!map[row.sop_id]) map[row.sop_id] = row.submitted_at
      }
      return map
    },
    staleTime: 1000 * 60 * 2,
  })

  // Phase 36 REF-01 / D-08: per-SOP refresher interval + lineage root, read
  // from `sops` directly (RLS-scoped to what the worker can see via
  // org_members_can_view_sops — superseded rows included). Still no server
  // action, no competency classifier call (T-36-08-01/03 accepted).
  const { data: sopMetaMap = {} } = useQuery<Record<string, { root: string; interval: number | null }>>({
    queryKey: ['sop-refresher-intervals'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sops')
        .select('id, parent_sop_id, refresher_interval_months') as {
          data: Array<{ id: string; parent_sop_id: string | null; refresher_interval_months: number | null }> | null
        }
      const map: Record<string, { root: string; interval: number | null }> = {}
      for (const row of data ?? []) {
        map[row.id] = { root: row.parent_sop_id ?? row.id, interval: row.refresher_interval_months }
      }
      return map
    },
    staleTime: 1000 * 60 * 5,
  })

  // WR-03: after a supersede, notifyAssignedWorkers repoints the assignment
  // to the NEW sop id while the worker's completions stay on the OLD id — so
  // an exact-sop_id lookup silently reset the refresher clock (and killed the
  // "Updated" badge) the moment a SOP was republished. Key the completion
  // clock by lineage ROOT (parent_sop_id ?? id), mirroring the server-side
  // CMP-03 lineage widening. Lineage is flat, one level deep.
  const rootOf = (sopId: string): string => sopMetaMap[sopId]?.root ?? sopId
  const lastCompletionByRoot: Record<string, string> = {}
  for (const [sopId, submittedAt] of Object.entries(lastCompletionMap)) {
    const root = rootOf(sopId)
    if (!lastCompletionByRoot[root] || submittedAt > lastCompletionByRoot[root]) {
      lastCompletionByRoot[root] = submittedAt
    }
  }

  function getAssignmentInfo(sopId: string) {
    return assignments.find((a) => a.sop_id === sopId)
  }

  /**
   * Phase 36 REF-01 / D-08: derives the two informational refresher chip
   * booleans from the worker's last completion + this SOP's interval. A
   * missing interval or missing completion yields null due date → no chip
   * (D-02 zero-noise default). WR-04: "due" now has a real lead-in window
   * (REFRESHER_DUE_WINDOW_DAYS before the due date) so the "Refresher due"
   * label is reachable before it escalates to "Refresher overdue". `now` is
   * computed once per call, never hoisted to module scope (CLAUDE.md
   * 2026-06-08 hydration-mismatch class).
   */
  function refresherState(sop: (typeof sops)[number]): { isRefresherDue: boolean; isRefresherOverdue: boolean } {
    const now = new Date().toISOString()
    const due = refresherDueDate(lastCompletionByRoot[rootOf(sop.id)] ?? null, sopMetaMap[sop.id]?.interval ?? null)
    return { isRefresherDue: computeRefresherDue(due, now), isRefresherOverdue: computeRefresherOverdue(due, now) }
  }

  /**
   * AFL-VER-04 / D-08: Returns true if the SOP's published_at is newer than
   * the worker's last completion submitted_at for this SOP.
   * Triggers on ANY newer published version — no material-change classification.
   */
  function hasNewerVersion(sop: (typeof sops)[number]): boolean {
    const publishedAt = sop.published_at
    if (!publishedAt) return false
    const lastCompleted = lastCompletionByRoot[rootOf(sop.id)]
    if (!lastCompleted) return false // never completed → no "updated" signal
    return new Date(publishedAt) > new Date(lastCompleted)
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

  // Sketch 005 variant C: a worker row carries ONE signal and the training
  // clock moves to the detail pane. Everything is derived here — the browser
  // renders what it is handed and owns no data logic.
  const workerSops: WorkerSop[] = sops.map((sop) => {
    const refresher = refresherState(sop)
    const info = getAssignmentInfo(sop.id)
    return {
      id: sop.id,
      title: sop.title ?? 'Untitled SOP',
      categoryLabel: categoryLabel((sop as { category_slug?: string | null }).category_slug ?? null),
      lastCompletedAt: lastCompletionByRoot[rootOf(sop.id)] ?? null,
      isRefresherDue: refresher.isRefresherDue,
      isRefresherOverdue: refresher.isRefresherOverdue,
      hasNewerVersion: hasNewerVersion(sop),
      isSelfAssigned: info?.isSelfAssigned ?? false,
      removalRequested: requestedIds.has(sop.id),
      raw: sop,
    }
  })

  const scoped = workerSops.filter((s) => {
    if (scope === 'refresher') return s.isRefresherDue || s.isRefresherOverdue
    if (scope === 'updated') return s.hasNewerVersion
    if (scope === 'not-done') return s.lastCompletedAt === null
    return true
  })

  const counts: Record<WorkerScope, number> = {
    all: workerSops.length,
    refresher: workerSops.filter((s) => s.isRefresherDue || s.isRefresherOverdue).length,
    updated: workerSops.filter((s) => s.hasNewerVersion).length,
    'not-done': workerSops.filter((s) => s.lastCompletedAt === null).length,
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-1">Your SOPs</h1>
      <p className="text-sm text-[var(--ink-500)] mb-4">
        {isLoading ? 'Loading...' : `${workerSops.length} procedure${workerSops.length !== 1 ? 's' : ''}`}
        {' · '}{lastSyncLabel}
      </p>

      {/* Scope strip — below lg the left column has nowhere to go, so the
          same scopes ride here rather than disappearing. */}
      <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-1">
        {WORKER_SCOPES.map((sc) => (
          <button
            key={sc.key}
            type="button"
            onClick={() => onScopeChange(sc.key)}
            className={`flex-shrink-0 min-h-11 rounded-xl border px-3 text-sm font-medium ${
              scope === sc.key
                ? 'border-[var(--ink-900)] bg-[var(--ink-900)] text-white'
                : 'border-[var(--ink-100)] bg-white text-[var(--ink-700)]'
            }`}
          >
            {sc.label}
            <span className="mono ml-1 text-[11px] opacity-70">{counts[sc.key]}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenDeptSheet}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 min-h-11 bg-white border border-[var(--ink-100)] rounded-xl text-sm font-medium text-[var(--ink-900)]"
        >
          <span>{activeDeptLabel}</span>
          <ChevronDown size={16} className="text-[var(--ink-500)]" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[88px] bg-[var(--paper-2)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : workerSops.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
          <ClipboardList size={48} className="text-[var(--ink-300)]" />
          <div>
            <p className="text-xl font-semibold text-[var(--ink-900)]">No SOPs yet</p>
            <p className="text-sm text-[var(--ink-500)] max-w-xs mx-auto mt-2">
              Browse the SOP Library to add procedures, or ask your admin to assign some.
            </p>
          </div>
        </div>
      ) : (
        <SopWorkerBrowser
          sops={scoped}
          scopeLabel={scopeLabel}
          onRemove={handleRemove}
          removePending={pending}
        />
      )}
    </>
  )
}

/* ─── SOP Library Section ────────────────────────────────────────────────── */

function LibrarySection() {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  interface LibrarySop {
    id: string
    title: string | null
    sop_number: string | null
    category_slug: string | null
    department: string | null
    status: string
  }

  const { data: librarySops = [], isLoading } = useQuery<LibrarySop[]>({
    queryKey: ['library-sops'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sops')
        .select('id, title, sop_number, category_slug, department, status')
        .eq('status', 'published')
        .order('title', { ascending: true }) as { data: LibrarySop[] | null }
      return data ?? []
    },
    staleTime: 1000 * 60 * 2,
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['user-sop-assignments'],
    queryFn: getUserSopAssignments,
    staleTime: 1000 * 60 * 5,
  })

  function isAssigned(sopId: string) {
    return assignments.some((a) => a.sop_id === sopId)
  }

  function isSelfAssigned(sopId: string) {
    return assignments.some((a) => a.sop_id === sopId && a.isSelfAssigned)
  }

  function handleToggle(sopId: string) {
    startTransition(async () => {
      if (isSelfAssigned(sopId)) {
        await selfRemoveSop(sopId)
      } else if (!isAssigned(sopId)) {
        await selfAddSop(sopId)
      }
      queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assigned-sops'] })
    })
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-1">SOP Library</h1>
      <p className="text-sm text-[var(--ink-500)] mb-4">
        {isLoading ? 'Loading...' : `${librarySops.length} published procedure${librarySops.length !== 1 ? 's' : ''}`}
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[72px] bg-[var(--paper-2)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : librarySops.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
          <BookOpen size={48} className="text-[var(--ink-300)]" />
          <p className="text-xl font-semibold text-[var(--ink-900)]">No SOPs published yet</p>
          <p className="text-sm text-[var(--ink-500)]">Your admin hasn&apos;t published any SOPs yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {librarySops.map((sop) => {
            const assigned = isAssigned(sop.id)
            const selfAdded = isSelfAssigned(sop.id)
            const meta = [categoryLabel(sop.category_slug), sop.department].filter(Boolean).join(' · ')

            return (
              <div key={sop.id} className="flex items-stretch gap-2">
                <Link
                  href={`/sops/${sop.id}`}
                  className="flex items-center gap-4 px-4 py-3 bg-white border border-[var(--ink-100)] rounded-xl hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] transition-colors flex-1 min-w-0 min-h-[72px]"
                >
                  <FileText size={24} className="text-[var(--ink-500)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink-900)] truncate">
                      {sop.title ?? 'Untitled SOP'}
                    </p>
                    {meta && <p className="text-xs text-[var(--ink-500)] mt-0.5">{meta}</p>}
                    {sop.sop_number && <p className="mono text-xs text-[var(--ink-500)]">{sop.sop_number}</p>}
                  </div>
                  {assigned && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-[var(--accent-signoff)]/10 text-[var(--accent-signoff)] text-xs font-semibold rounded flex-shrink-0">
                      {selfAdded ? 'Added' : 'Assigned'}
                    </span>
                  )}
                  <ChevronRight size={18} className="text-[var(--ink-300)] flex-shrink-0" />
                </Link>

                <button
                  type="button"
                  onClick={() => handleToggle(sop.id)}
                  disabled={pending || (assigned && !selfAdded)}
                  title={
                    assigned
                      ? selfAdded ? 'Remove from Your SOPs' : 'Assigned by manager'
                      : 'Add to Your SOPs'
                  }
                  aria-label={assigned ? 'Remove from Your SOPs' : 'Add to Your SOPs'}
                  className={[
                    'flex items-center justify-center w-10 rounded-xl transition-colors flex-shrink-0 border',
                    assigned && !selfAdded
                      ? 'bg-[var(--paper-2)] border-[var(--ink-100)] text-[var(--ink-300)] cursor-default'
                      : assigned && selfAdded
                        ? 'bg-white border-[var(--ink-100)] hover:bg-red-50 hover:border-red-300 text-[var(--accent-signoff)] hover:text-red-500'
                        : 'bg-white border-[var(--ink-100)] hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] text-[var(--ink-500)] hover:text-[var(--ink-900)]',
                  ].join(' ')}
                >
                  {pending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : assigned ? (
                    <Minus size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
