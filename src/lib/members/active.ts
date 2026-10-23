/**
 * Phase 64 (MEMB-11): who counts as a member right now. Plain module, no directive: no client
 * can call it. Callers pass the SESSION organisation and only ids they already read under their
 * own guard, like labels.ts. Service role, so every read is scoped here by organisation_id.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { MemberStatus } from '@/types/auth'

/** The subset of userIds (or every member when omitted) whose membership is active. */
export async function activeMemberIds(organisationId: string, userIds?: string[]): Promise<Set<string>> {
  if (userIds && userIds.length === 0) return new Set()
  let q = createAdminClient()
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', organisationId)
    .eq('status', 'active')
  if (userIds) q = q.in('user_id', userIds)
  const { data } = await q
  return new Set((data ?? []).map((m) => m.user_id as string))
}

/** Status per user in this organisation; ids with no membership row are absent. */
export async function memberStatusMap(organisationId: string, userIds: string[]): Promise<Map<string, MemberStatus>> {
  const out = new Map<string, MemberStatus>()
  if (userIds.length === 0) return out
  const { data } = await createAdminClient()
    .from('organisation_members')
    .select('user_id, status')
    .eq('organisation_id', organisationId)
    .in('user_id', userIds)
  for (const m of data ?? []) out.set(m.user_id as string, m.status as MemberStatus)
  return out
}
