'use client'

/**
 * Phase 28 Plan 05 — admin library owner + review-state cell (REV-02/REV-04/OWN-01).
 * Overdue badge lives ONLY here (admin library) — worker routes never gate on
 * review_due_at (D28-07). Confirm-current is a real wired call, mirroring
 * GovernanceQueueRow's handleConfirmCurrent.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmSopCurrent } from '@/actions/governance'

function formatDate(iso: string | null): string {
  if (!iso) return 'No date set'
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function LibraryReviewCell({
  sopId,
  ownerLabel,
  reviewDueAt,
}: {
  sopId: string
  ownerLabel: string | null
  reviewDueAt: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Admin-library-only overdue signal (D28-07: this guard must never appear on a worker route).
  const isOverdue = !!reviewDueAt && new Date(reviewDueAt) < new Date()

  function handleConfirmCurrent() {
    setError(null)
    startTransition(async () => {
      const result = await confirmSopCurrent(sopId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-[var(--ink-100)]">
      <span className="mono text-[11px] text-[var(--ink-500)]">Owner: {ownerLabel ?? 'No owner'}</span>
      {isOverdue ? (
        <span className="mono text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600">
          Review overdue
        </span>
      ) : (
        <span className="mono text-[11px] text-[var(--ink-500)]">Review due {formatDate(reviewDueAt)}</span>
      )}
      <button
        type="button"
        onClick={handleConfirmCurrent}
        disabled={isPending}
        className="evidence-btn !min-h-[28px] !py-1 text-xs ml-auto"
      >
        {isPending ? 'Confirming…' : 'Confirm current'}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  )
}
