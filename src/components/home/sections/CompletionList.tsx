'use client'

/**
 * Phase 63 (HOME-04) -- the person's own completions and who signed them off. Moved from the
 * activity page so My record and /activity (until 63-14 retires it) show the same list.
 */
import { useWorkerCompletions } from '@/hooks/useCompletions'
import { CompletionHistoryCard } from '@/components/activity/CompletionHistoryCard'
import { HOME, type HomeState } from '@/lib/shell/home-state'

export function CompletionList({ onHome }: { onHome(state: HomeState): void }) {
  const { data: completions = [], isLoading } = useWorkerCompletions()

  return (
    <div>
      <p className="mono mb-6 text-meta text-ink-600">{isLoading ? 'Loading…' : `${completions.length} finished`}</p>

      {!isLoading && completions.length === 0 ? (
        // The empty state shows the shape of what will land here, not an icon in a circle.
        <div className="flex flex-col items-start gap-4">
          <div aria-hidden="true" className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-ink-300 p-4">
            <span className="h-2.5 w-1/2 rounded bg-ink-100" />
            <span className="text-ui text-ink-700">Your first finished SOP lands here, with who signed it off.</span>
          </div>
          <button
            type="button"
            onClick={() => onHome(HOME)}
            className="flex min-h-tap items-center rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
          >
            Find a SOP
          </button>
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
