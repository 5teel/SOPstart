import { AlertTriangle } from 'lucide-react'
import { reviewSegment } from '@/lib/office/format'

/**
 * The one owner + review line under every admin SOP row (OFF-04, D-08).
 * `omit` drops the half an inbox chip already says.
 */
export function OwnerReviewMeta({
  ownerLabel,
  reviewDueAt,
  omit,
}: {
  ownerLabel: string | null
  reviewDueAt: string | null
  omit?: 'owner' | 'review'
}) {
  const review = reviewSegment(reviewDueAt)
  return (
    <p
      data-testid="owner-review-meta"
      data-owner={ownerLabel ? 'set' : 'none'}
      data-review={review.state}
      className="mono flex min-w-0 items-center gap-1 text-meta text-ink-500"
    >
      {omit !== 'owner' &&
        (ownerLabel ? (
          <span className="min-w-0 truncate">
            Owner · <span className="text-ink-700">{ownerLabel}</span>
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-accent-decision/10 px-2 py-1 font-semibold text-ink-900">
            <AlertTriangle className="size-3 text-accent-decision" aria-hidden />
            No owner
          </span>
        ))}
      {omit === undefined && <span className="shrink-0">·</span>}
      {omit !== 'review' &&
        (review.state === 'overdue' ? (
          <span className="shrink-0">
            {review.lead}
            <span className="font-semibold text-accent-escalate">{review.date}</span>
          </span>
        ) : (
          <span className="shrink-0">{review.text}</span>
        ))}
    </p>
  )
}
