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
  Upload,
  FileText,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { useAssignedSops } from '@/hooks/useAssignedSops'
import { useSopSync } from '@/hooks/useSopSync'
import { db } from '@/lib/offline/db'
import { SopLibraryCard } from '@/components/sop/SopLibraryCard'
import { SopSearchInput } from '@/components/sop/SopSearchInput'
import { DepartmentBottomSheet, DepartmentSidebar } from '@/components/sop/CategoryBottomSheet'
import { createClient } from '@/lib/supabase/client'
import { selfAddSop, selfRemoveSop, requestRemoveAssignment, getUserSopAssignments } from '@/actions/assignments'
import { PRODUCT_NAME } from '@/lib/constants'
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

  const { syncing } = useSopSync()

  const { data: assignedSops = [], isLoading: assignedLoading } = useAssignedSops()
  const { data: searchResults = [] } = useAssignedSops({ search: searchTerm || undefined })

  const { data: userRole } = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('organisation_members')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle() as { data: { role: string } | null }
      return data?.role ?? null
    },
    staleTime: 1000 * 60 * 10,
  })
  const isAdmin = userRole === 'admin' || userRole === 'safety_manager'

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

  // Client-side department filter applied on top of the RLS-gated assigned SOPs.
  // If no departments selected (and not allDepartments), show all.
  const filteredSops = (allDepartments || selectedDeptIds.length === 0)
    ? assignedSops
    : (assignedSops ?? []).filter(() => {
        // Department filtering is done at the RLS level (sops_visible_by_department).
        // The client-side filter here is a UI affordance to narrow what's shown.
        // Without sop_departments join in the hook result, we fall back to showing all.
        // TODO: extend useAssignedSops to accept departmentIds when backend support is ready.
        return true
      })

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
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-[var(--paper)] border-b border-[var(--ink-100)] px-4 flex items-center justify-between h-[56px]">
        <span className="mono text-sm font-semibold text-[var(--ink-900)] tracking-tight">{PRODUCT_NAME}</span>
        <button
          type="button"
          onClick={() => { setSearchTerm(''); setSearchOpen(true) }}
          aria-label="Search SOPs"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--paper-2)] transition-colors"
        >
          {syncing ? (
            <RefreshCw size={22} className="text-[var(--accent-measure)] animate-spin" />
          ) : (
            <Search size={22} className="text-[var(--ink-500)] hover:text-[var(--ink-900)]" />
          )}
        </button>
      </header>

      {/* Section tabs */}
      <nav className="flex border-b border-[var(--ink-100)] px-4 gap-1">
        {isAdmin && (
          <Link
            href="/admin/sops/upload"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors whitespace-nowrap"
          >
            <Upload size={16} />
            <span>Create SOP</span>
          </Link>
        )}
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
      </nav>

      {/* Desktop layout: sidebar + content */}
      <div className="flex flex-1">
        {activeSection === 'your-sops' && (
          <div className="hidden lg:block">
            <DepartmentSidebar
              departments={departments}
              selectedIds={selectedDeptIds}
              allDepartments={allDepartments}
              onSelect={handleDeptSelect}
            />
          </div>
        )}

        <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full lg:max-w-none lg:mx-0">
          {activeSection === 'your-sops' && (
            <YourSopsSection
              sops={filteredSops}
              isLoading={assignedLoading}
              lastSyncLabel={lastSyncLabel}
              activeDeptLabel={activeDeptLabel}
              onOpenDeptSheet={() => setDeptSheetOpen(true)}
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
}

function YourSopsSection({ sops = [], isLoading, lastSyncLabel, activeDeptLabel, onOpenDeptSheet }: YourSopsSectionProps) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  const { data: assignments = [] } = useQuery({
    queryKey: ['user-sop-assignments'],
    queryFn: getUserSopAssignments,
    staleTime: 1000 * 60 * 5,
  })

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

  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-1">Your SOPs</h1>
      <p className="text-sm text-[var(--ink-500)] mb-4">
        {isLoading ? 'Loading...' : `${sops.length} procedure${sops.length !== 1 ? 's' : ''}`}
        {' · '}{lastSyncLabel}
      </p>

      {/* Department filter pill — mobile */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={onOpenDeptSheet}
          className="inline-flex items-center gap-2 px-4 h-[44px] bg-white border border-[var(--ink-100)] rounded-xl text-sm font-medium text-[var(--ink-900)] hover:bg-[var(--paper-2)] transition-colors"
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
      ) : sops.length === 0 ? (
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
        <div className="flex flex-col gap-3">
          {sops.map((sop) => {
            const info = getAssignmentInfo(sop.id)
            const isSelf = info?.isSelfAssigned ?? false
            const alreadyRequested = requestedIds.has(sop.id)
            return (
              <div key={sop.id} className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <SopLibraryCard sop={sop} isCached={true} />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(sop.id)}
                  disabled={pending || alreadyRequested}
                  title={isSelf ? 'Remove from Your SOPs' : alreadyRequested ? 'Request sent' : 'Request removal'}
                  aria-label={isSelf ? 'Remove from Your SOPs' : 'Request removal from manager'}
                  className={[
                    'flex items-center justify-center w-10 rounded-xl transition-colors flex-shrink-0 border',
                    alreadyRequested
                      ? 'bg-[var(--paper-2)] border-[var(--ink-100)] text-[var(--ink-300)] cursor-default'
                      : isSelf
                        ? 'bg-white border-[var(--ink-100)] hover:bg-red-50 hover:border-red-300 text-[var(--ink-500)] hover:text-red-500'
                        : 'bg-white border-[var(--ink-100)] hover:bg-orange-50 hover:border-orange-300 text-[var(--ink-500)] hover:text-orange-500',
                  ].join(' ')}
                >
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <Minus size={16} />}
                </button>
              </div>
            )
          })}
        </div>
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
    category: string | null
    department: string | null
    status: string
  }

  const { data: librarySops = [], isLoading } = useQuery<LibrarySop[]>({
    queryKey: ['library-sops'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sops')
        .select('id, title, sop_number, category, department, status')
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
            const meta = [sop.category, sop.department].filter(Boolean).join(' · ')

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
