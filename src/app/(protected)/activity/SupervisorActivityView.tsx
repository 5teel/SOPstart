'use client'

import { useState, useMemo } from 'react'
import { ClipboardList } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useSupervisorCompletions } from '@/hooks/useCompletions'
import type { FilterState } from '@/hooks/useCompletions'
import { CompletionSummaryCard } from '@/components/activity/CompletionSummaryCard'
import { ActivityFilter } from '@/components/activity/ActivityFilter'

interface SupervisorActivityViewProps {
  role: 'supervisor' | 'safety_manager'
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

export function SupervisorActivityView({ role: _role }: SupervisorActivityViewProps) {
  const [filter, setFilter] = useState<FilterState>({ type: 'all' })
  const { data: completions = [], isLoading } = useSupervisorCompletions(filter)

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
      <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-1">Activity</h1>
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
                  sopTitle={completion.sop_title}
                  submittedAt={completion.submitted_at}
                  status={completion.status}
                  photoCount={completion.photo_count}
                  workerName={workerMap.get(completion.worker_id) ?? 'Unknown Worker'}
                  workerId={completion.worker_id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
