/**
 * Phase 59 (A-01): the owner's way to mark their own SOP reviewed.
 *
 * Plain module, no directive: no client can call it. The caller passes the
 * session organisation and user; this re-checks that the user owns the SOP and
 * scopes every service-role read and write to that organisation (never to a
 * fetched row's own organisation).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCadenceMonths, computeReviewDueDate } from '@/lib/governance/cadences'

export async function markReviewedAsOwner(args: {
  sopId: string
  organisationId: string
  userId: string
}): Promise<{ reviewDueAt: string } | { error: string }> {
  const { sopId, organisationId, userId } = args
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: sop } = await admin
    .from('sops')
    .select('category_slug')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (!sop) return { error: 'Only the owner or an admin can mark this reviewed.' }

  const { data: cadenceRows, error: cadenceErr } = await admin
    .from('sop_review_cadences')
    .select('category, months')
    .eq('organisation_id', organisationId)
  if (cadenceErr) console.error('[markReviewedAsOwner] cadence read', cadenceErr)
  const cadences: Record<string, number> = {}
  for (const r of (cadenceRows ?? []) as Array<{ category: string; months: number }>) cadences[r.category] = r.months

  const now = new Date().toISOString()
  const reviewDueAt = computeReviewDueDate(now, resolveCadenceMonths(sop.category_slug, cadences))

  const { data: updated, error: updateErr } = await admin
    .from('sops')
    .update({ last_reviewed_at: now, review_due_at: reviewDueAt, last_reviewed_by: userId, updated_at: now })
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .eq('owner_user_id', userId)
    .select('id')
  if (updateErr) {
    console.error('[markReviewedAsOwner] update error', updateErr)
    return { error: updateErr.message }
  }
  if (!updated || updated.length === 0) return { error: 'SOP not found' }

  const { error: eventErr } = await admin.from('sop_review_events').insert({
    sop_id: sopId,
    organisation_id: organisationId,
    reviewed_by: userId,
    action: 'confirmed_current',
  })
  if (eventErr) {
    console.error('[markReviewedAsOwner] event insert error', eventErr)
    return { error: eventErr.message }
  }

  return { reviewDueAt }
}
