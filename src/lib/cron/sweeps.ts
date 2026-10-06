import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'
import { reviewDueTargets, type ReviewDueRow } from '@/lib/notifications/review-due'

/**
 * Phase 60 (A-08) -- the daily sweeps behind the cron routes.
 *
 * Plain server module, no directive: no browser can call it. There is no
 * session, so organisation ids come from the organisations read (or the
 * validated body behind the secret) and every query carries one. No sweep
 * writes the ledger: a notification and a request raised by the agent are not
 * decisions, and the ledger writer reads a session these routes never have.
 * Every sweep is idempotent: a repeat run writes nothing new.
 */
// ponytail: one cron run covers the first 50 organisations and 2000 rows each;
// add paging by id if the platform ever outgrows a single run.
const MAX_ORGS_PER_SWEEP = 50
const MAX_ROWS_PER_ORG = 2000

async function orgIds(only?: string): Promise<string[]> {
  if (only) return [only]
  const { data, error } = await createAdminClient().from('organisations').select('id').limit(MAX_ORGS_PER_SWEEP)
  if (error) {
    console.error('[cron] organisations read error', error)
    return []
  }
  return (data ?? []).map((o) => o.id as string)
}

export async function runReviewDueSweep(opts: { now?: Date; organisationId?: string } = {}): Promise<{ notified: number }> {
  const now = opts.now ?? new Date()
  const admin = createAdminClient()
  let notified = 0
  for (const org of await orgIds(opts.organisationId)) {
    const { data, error } = await admin
      .from('sops')
      .select('id, title, version, parent_sop_id, status, owner_user_id, review_due_at')
      .eq('organisation_id', org)
      .eq('status', 'published')
      .not('review_due_at', 'is', null)
      .limit(MAX_ROWS_PER_ORG)
    if (error) {
      console.error('[review-due] read error', error)
      continue
    }
    const targets = reviewDueTargets((data ?? []) as ReviewDueRow[], now)
    notified += await notify(
      org,
      targets.map((t) => ({
        userId: t.ownerId,
        kind: 'review_due' as const,
        title: notificationTitle({ kind: 'review_due', sop: t.title, dueAt: t.reviewDueAt }, now),
        place: notificationPlace('review_due'),
        subjectType: 'sop',
        subjectId: t.sopId,
        dedupeKey: dedupeKey({ kind: 'review_due', sopId: t.sopId, dueAt: t.reviewDueAt }),
      })),
    )
  }
  return { notified }
}
