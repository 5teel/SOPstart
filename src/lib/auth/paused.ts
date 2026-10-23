/**
 * Phase 64 (MEMB-08, D-08): the sites a signed-in person has been suspended from or has left.
 * Plain module, no directive: the caller passes the SESSION user id only. A suspended person cannot
 * read their own row under RLS (00082), so this reads with the service role; it returns site names
 * and a state, nothing else.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export async function pausedMemberships(userId: string): Promise<Array<{ organisationName: string; status: 'suspended' | 'left' }>> {
  const { data, error } = await createAdminClient()
    .from('organisation_members')
    .select('status, organisations ( name )')
    .eq('user_id', userId)
    .neq('status', 'active')
  if (error) {
    console.error('[pausedMemberships] read error', error)
    return []
  }
  return (data ?? []).flatMap((m) => {
    const o = m.organisations as unknown as { name: string } | null
    return o?.name ? [{ organisationName: o.name, status: m.status as 'suspended' | 'left' }] : []
  })
}
