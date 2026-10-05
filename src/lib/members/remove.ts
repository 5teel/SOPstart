/**
 * Phase 59 (OFF-05): the one membership delete. Plain module, no directive: no
 * client can call it, only a guarded server action can.
 *
 * Why the service role: organisation_members has no DELETE policy (migrations
 * 00002 / 00062 define select, insert and update only), so a session-client
 * delete matches zero rows and reports no error. The caller has already passed
 * its role guard; the session organisation id is the scope here (CLAUDE.md
 * 2026-06-15), so a member id from another site deletes nothing.
 *
 * Returns how many rows were deleted; 0 means nothing matched.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteOrgMember({
  memberId,
  organisationId,
}: {
  memberId: string
  organisationId: string
}): Promise<number> {
  const { data, error } = await createAdminClient()
    .from('organisation_members')
    .delete()
    .eq('id', memberId)
    .eq('organisation_id', organisationId)
    .select('id')

  if (error) {
    console.error('[deleteOrgMember] delete error', error)
    return 0
  }
  return data?.length ?? 0
}
