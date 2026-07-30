'use client'

import { useState, useMemo } from 'react'
import { ClipboardList } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useSupervisorCompletions } from '@/hooks/useCompletions'
import type { FilterState } from '@/hooks/useCompletions'
import { CompletionSummaryCard } from '@/components/activity/CompletionSummaryCard'
import { ActivityFilter } from '@/components/activity/ActivityFilter'
import { RecordObservationModal } from '@/components/observations/RecordObservationModal'

interface SupervisorActivityViewProps {
  role: 'supervisor' | 'safety_manager' | 'admin'
}

interface WorkerProfile {
  user_id: string
}

function useWorkerProfiles(workerIds: string[]) {
  return useQuery<WorkerProfile[]>({
    queryKey: ['worker-profiles', workerIds.sort().join(',')],
    queryFn: async () => {
      if (workerIds.length === 0) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('organisation_members')
        .select('user_id')
        .in('user_id', workerIds)
      if (error) {
        console.error('useWorkerProfiles error:', error)
        return []
      }
      return (data ?? []) as WorkerProfile[]
    },
    enabled: workerIds.length > 0,
  })
}

interface ObserveState {
  worker: { id: string; name: string }
  presetSopId?: string
  presetCompletionId?: string
}

export function SupervisorActivityView({ role: _role }: SupervisorActivityViewProps) {
  const [filter, setFilter] = useState<FilterState>({ type: 'all' })
  const { data: completions = [], isLoading } = useSupervisorCompletions(filter)
  const [observe, setObserve] = useState<ObserveState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const workerIds = useMemo(
    () => [...new Set(completions.map((c) => c.worker_id))],
    [completions]
  )
  const { data: workerProfiles = [] } = useWorkerProfiles(workerIds)

  const workerMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of workerProfiles) {
      map.set(p.user_id, `Worker ${p.user_id.slice(0, 8)}`)
    }
    return map
  }, [workerProfiles])

  const pendingCount = completions.filter((c) => c.status === 'pending_sign_off').length

  const sopOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of completions) {
      if (!seen.has(c.sop_id)) seen.set(c.sop_id, c.sop_title ?? 'Untitled SOP')
    }
    return [...seen.entries()].map(([id, title]) => ({ id, title }))
  }, [completions])

  const workerOptions = useMemo(() => {
    return workerIds.map((id) => ({ id, name: workerMap.get(id) ?? 'Unknown Worker' }))
  }, [workerIds, workerMap])

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Sign-off</h1>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={workerOptions.length === 0}
            className="px-3 py-2 rounded text-xs font-bold uppercase tracking-wide bg-[var(--ink-900)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ＋ Record observation
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 max-h-56 overflow-y-auto bg-[var(--paper)] border border-[var(--ink-300)] rounded shadow-xl z-20">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] border-b border-[var(--ink-100)]">
                Select worker
              </p>
              {workerOptions.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setObserve({ worker: { id: w.id, name: w.name } })
                    setPickerOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {!isLoading && (
        <p className="text-sm text-[var(--ink-500)] mb-6">
          {pendingCount} completion{pendingCount !== 1 ? 's' : ''} awaiting review
        </p>
      )}
      {isLoading && <p className="text-sm text-[var(--ink-500)] mb-6">Loading...</p>}

      <div className="lg:flex lg:gap-8">
        {/* Sidebar filter (desktop) */}
        <div className="hidden lg:block w-[220px] flex-shrink-0">
          <p className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide mb-3">
            Filter
          </p>
          <ActivityFilter
            filter={filter}
            onChange={setFilter}
            sopOptions={sopOptions}
            workerOptions={workerOptions}
            desktop
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Mobile filter pills */}
          <div className="lg:hidden mb-4">
            <ActivityFilter
              filter={filter}
              onChange={setFilter}
              sopOptions={sopOptions}
              workerOptions={workerOptions}
            />
          </div>

          {!isLoading && completions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--paper-2)] border border-[var(--ink-100)] flex items-center justify-center">
                <ClipboardList size={28} className="text-[var(--ink-500)]" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--ink-700)]">
                  {filter.type === 'all' ? 'No completions yet' : 'No results for this filter'}
                </p>
                <p className="text-sm text-[var(--ink-500)] mt-1">
                  {filter.type === 'all'
                    ? 'Completions submitted by your workers will appear here.'
                    : 'Try a different filter to see completions.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {completions.map((completion) => (
                <CompletionSummaryCard
                  key={completion.id}
                  id={completion.id}
                  sopId={completion.sop_id}
                  sopTitle={completion.sop_title}
                  submittedAt={completion.submitted_at}
                  status={completion.status}
                  photoCount={completion.photo_count}
                  workerName={workerMap.get(completion.worker_id) ?? 'Unknown Worker'}
                  workerId={completion.worker_id}
                  onObserve={(ctx) =>
                    setObserve({
                      worker: { id: ctx.workerId, name: ctx.workerName },
                      presetSopId: ctx.sopId,
                      presetCompletionId: ctx.completionId,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {observe && (
        <RecordObservationModal
          open={!!observe}
          onClose={() => setObserve(null)}
          worker={observe.worker}
          presetSopId={observe.presetSopId}
          presetCompletionId={observe.presetCompletionId}
        />
      )}
    </div>
  )
}
