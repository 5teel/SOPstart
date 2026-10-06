import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSafePlace, notificationPlace } from '@/lib/notifications/places'
import { dedupeKey, notificationTitle, type NotificationKind } from '@/lib/notifications/kinds'
import type { ChainStep } from '@/lib/governance/approvals'

/**
 * Phase 60 (D-07) -- the one notification writer.
 *
 * Why service role: notifications has no authenticated INSERT policy by design;
 * a person may only mark their own row read. The caller has already done the
 * primary write and passes the SESSION organisation; this module keeps a row
 * only for a member of that organisation and only with a safe place.
 *
 * Why fail-soft: it runs after the write that matters. Any error is logged and
 * the count returned is 0; it never throws into the calling action.
 */
export interface NotifyRow {
  userId: string
  kind: NotificationKind
  title: string
  place: string
  subjectType: string
  subjectId: string
  dedupeKey: string
  decisionId?: string | null
}

export async function notify(organisationId: string, rows: NotifyRow[]): Promise<number> {
  try {
    const safe = rows.filter((r) => isSafePlace(r.place) && r.title.length > 0)
    if (safe.length === 0) return 0
    const admin = createAdminClient()
    const { data: members, error: memberError } = await admin
      .from('organisation_members')
      .select('user_id')
      .eq('organisation_id', organisationId)
      .in('user_id', [...new Set(safe.map((r) => r.userId))])
    if (memberError) throw memberError
    const inOrg = new Set((members ?? []).map((m) => m.user_id as string))
    const keep = safe.filter((r) => inOrg.has(r.userId))
    if (keep.length === 0) return 0
    const { error } = await admin.from('notifications').upsert(
      keep.map((r) => ({
        organisation_id: organisationId,
        user_id: r.userId,
        kind: r.kind,
        title: r.title,
        place: r.place,
        subject_type: r.subjectType,
        subject_id: r.subjectId,
        decision_id: r.decisionId ?? null,
        dedupe_key: r.dedupeKey,
      })),
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    )
    if (error) throw error
    return keep.length
  } catch (err) {
    console.error('[notify] FAILED', err)
    return 0
  }
}

/**
 * D-08 trigger 1: tell whoever the chain step names that it is their turn.
 * The caller passes the SESSION org and the actor (never told of their own act).
 * Never throws; returns the number written.
 */
export async function notifyNextApprover(a: {
  organisationId: string
  sopId: string
  sopTitle: string
  version: number
  stepIndex: number
  step: ChainStep | undefined
  actorId: string
}): Promise<number> {
  try {
    if (!a.step) return 0
    const ids = a.step.userId ? [a.step.userId] : a.step.role ? await membersWithRole(a.organisationId, a.step.role) : []
    const title = notificationTitle({ kind: 'approve_next', sop: a.sopTitle })
    const place = notificationPlace('approve_next')
    const key = dedupeKey({ kind: 'approve_next', sopId: a.sopId, version: a.version, step: a.stepIndex })
    return await notify(
      a.organisationId,
      [...new Set(ids)]
        .filter((id) => id !== a.actorId)
        .map((userId) => ({ userId, kind: 'approve_next' as const, title, place, subjectType: 'sop', subjectId: a.sopId, dedupeKey: key })),
    )
  } catch (err) {
    console.error('[notifyNextApprover] FAILED', err)
    return 0
  }
}

/** User ids holding a role in the organisation (for the triggers that notify a role). */
export async function membersWithRole(organisationId: string, role: 'worker' | 'supervisor' | 'admin' | 'safety_manager'): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', organisationId)
    .eq('role', role)
  if (error) {
    console.error('[membersWithRole] read error', error)
    return []
  }
  return (data ?? []).map((m) => m.user_id as string)
}
