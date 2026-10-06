import { DUE_SOON_WINDOW_DAYS } from '@/lib/governance/classify'
import { latestPublished, type LineageRow } from '@/lib/sop/lineage-current'

/**
 * Phase 60 (D-08 trigger 2) -- which SOPs an owner is told to review.
 * Plain pure module: the latest published version of each lineage, with an
 * owner, whose review date is on or before now plus the due-soon window.
 */
export interface ReviewDueRow extends LineageRow {
  title: string | null
  owner_user_id: string | null
  review_due_at: string | null
}

export interface ReviewDueTarget {
  sopId: string
  title: string
  ownerId: string
  reviewDueAt: string
  overdue: boolean
}

export function reviewDueTargets(rows: readonly ReviewDueRow[], now: Date): ReviewDueTarget[] {
  const edge = now.getTime() + DUE_SOON_WINDOW_DAYS * 86_400_000
  const out: ReviewDueTarget[] = []
  for (const r of latestPublished(rows)) {
    if (!r.owner_user_id || !r.review_due_at) continue
    const due = new Date(r.review_due_at).getTime()
    if (Number.isNaN(due) || due > edge) continue
    out.push({
      sopId: r.id,
      title: r.title ?? 'Untitled SOP',
      ownerId: r.owner_user_id,
      reviewDueAt: r.review_due_at,
      overdue: due < now.getTime(),
    })
  }
  return out
}
