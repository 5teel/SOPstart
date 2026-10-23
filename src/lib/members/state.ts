/**
 * Phase 64 (MEMB-02, MEMB-03): the one membership state change. Plain module, no directive: no
 * client can call it, only a guarded server action can.
 *
 * Why the service role: after migration 00082 `status` is service-role-only (the authenticated
 * role may update `role` and nothing else on organisation_members). The caller has already passed
 * its role guard and passes the SESSION organisation, never a client value (CLAUDE.md 2026-06-15),
 * so a member id from another site changes nothing.
 *
 * The write is conditional on the state the caller saw (`from`), so a double click or a stale
 * screen matches zero rows and is reported as ok false, not a second change. Suspending or marking
 * someone as left then ends all their sessions (revoke_user_sessions, D-07); a failed revoke is
 * reported through signedOut and never rolled back: RLS already denies a non-active member.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppRole, MemberStatus } from '@/types/auth'

export async function changeMemberState(a: {
  memberId: string
  organisationId: string
  actorId: string
  from: MemberStatus[]
  to: MemberStatus
  /** Set on the same update; used by the invite reactivation. */
  role?: AppRole
  /** The role the caller checked; a role changed in the meantime matches zero rows (ME-01). */
  seenRole?: AppRole
}): Promise<{ ok: false; lastAdmin: boolean } | { ok: true; userId: string; role: string; signedOut: boolean }> {
  const { memberId, organisationId, actorId, from, to, role, seenRole } = a
  const admin = createAdminClient()
  let query = admin
    .from('organisation_members')
    .update({
      status: to,
      status_changed_at: new Date().toISOString(),
      status_changed_by: actorId,
      ...(role ? { role } : {}),
    })
    .eq('id', memberId)
    .eq('organisation_id', organisationId)
    .in('status', from)
  if (seenRole) query = query.eq('role', seenRole)
  const { data, error } = await query.select('user_id, role')

  if (error || !data?.length) {
    if (error) console.error('[changeMemberState] update error', error)
    // The 00083 trigger refuses to take away an organisation's last active admin.
    return { ok: false, lastAdmin: isLastAdminError(error) }
  }
  const { user_id: userId, role: newRole } = data[0]

  let signedOut = false
  if (to !== 'active') {
    const { error: revokeError } = await admin.rpc('revoke_user_sessions', { p_user_id: userId })
    if (revokeError) console.error('[changeMemberState] revoke error', revokeError)
    signedOut = !revokeError
  }
  return { ok: true, userId, role: newRole as string, signedOut }
}

/** The 00083 keep_one_active_admin trigger's refusal. */
export function isLastAdminError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes('last active admin'))
}
