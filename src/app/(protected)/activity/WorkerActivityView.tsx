'use client'

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { useWorkerCompletions } from '@/hooks/useCompletions'
import { CompletionHistoryCard } from '@/components/activity/CompletionHistoryCard'

export function WorkerActivityView() {
  const { data: completions = [], isLoading } = useWorkerCompletions()

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-1">My Completions</h1>
      {!isLoading && (
        <p className="text-sm text-[var(--ink-500)] mb-6">
          {completions.length} completed procedure{completions.length !== 1 ? 's' : ''}
        </p>
      )}
      {isLoading && (
        <p className="text-sm text-[var(--ink-500)] mb-6">Loading...</p>
      )}

      {!isLoading && completions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--paper-2)] border border-[var(--ink-100)] flex items-center justify-center">
            <ClipboardList size={28} className="text-[var(--ink-500)]" />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--ink-700)]">No completions yet</p>
            <p className="text-sm text-[var(--ink-500)] mt-1">
              Complete an SOP walkthrough to see your history here.
            </p>
          </div>
          <Link
            href="/sops"
            className="mt-2 px-6 h-[48px] flex items-center rounded-xl bg-[var(--ink-900)] text-[var(--paper)] font-semibold text-sm hover:opacity-80 transition-opacity"
          >
            Browse SOPs
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {completions.map((completion) => (
            <CompletionHistoryCard
              key={completion.id}
              id={completion.id}
              sopTitle={completion.sop_title}
              submittedAt={completion.submitted_at}
              status={completion.status}
              photoCount={completion.photo_count}
              rejectionReason={completion.sign_off?.reason}
            />
          ))}
        </div>
      )}
    </div>
  )
}
