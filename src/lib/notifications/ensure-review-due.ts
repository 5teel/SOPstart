import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'
import { reviewDueTargets, type ReviewDueRow } from '@/lib/notifications/review-due'

/**
 * ADR-0002 (replaces the Phase 60 daily review-due sweep) -- on read.
 *
 * Loading the one screen materialises THIS user's due-review notifications so
 * the bell and the overview show them on that same load. Plain server module,
 * no directive: no browser can call it. The organisation and user come from the
 * caller's session; nobody else's reviews are written. Idempotent through the
 * existing dedupe key (SOP + due date), so a repeat load writes nothing new.
 * Never throws: it runs beside a read that matters more.
 */
// ponytail: one org's published rows, first 2000; page by id if an org ever outgrows it.
const MAX_ROWS = 2000

export async function ensureReviewDueNotifications(organisationId: string, userId: string, now = new Date()): Promise<number> {
  try {
    const { data, error } = await createAdminClient()
      .from('sops')
      .select('id, title, version, parent_sop_id, status, owner_user_id, review_due_at')
      .eq('organisation_id', organisationId)
      .eq('status', 'published')
      // every published row, not only mine: reviewDueTargets picks the latest per lineage FIRST, then
      // skips a missing date, so a superseded version this user owns is never flagged (WR-06)
      .limit(MAX_ROWS)
    if (error) throw error
    const mine = reviewDueTargets((data ?? []) as ReviewDueRow[], now).filter((t) => t.ownerId === userId)
    return await notify(
      organisationId,
      mine.map((t) => ({
        userId,
        kind: 'review_due' as const,
        title: notificationTitle({ kind: 'review_due', sop: t.title, dueAt: t.reviewDueAt }, now),
        place: notificationPlace('review_due'),
        subjectType: 'sop',
        subjectId: t.sopId,
        dedupeKey: dedupeKey({ kind: 'review_due', sopId: t.sopId, dueAt: t.reviewDueAt }),
      })),
    )
  } catch (err) {
    console.error('[ensureReviewDueNotifications] FAILED', err)
    return 0
  }
}
