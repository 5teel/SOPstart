/**
 * Phase 59 (A-07): the one place a person gets a name. Plain module, no
 * directive: no client can call it. Callers pass only ids they already read
 * under their own guard (T-59-15); it returns email / name and nothing else.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface UserLabel {
  email: string | null
  fullName: string | null
}

export async function userLabels(userIds: string[]): Promise<Map<string, UserLabel>> {
  const out = new Map<string, UserLabel>()
  if (userIds.length === 0) return out
  const wanted = new Set(userIds)
  // ponytail: first 1000 auth users only (same ceiling as getTeamMembersWithEmails); page it if an org outgrows that.
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    console.error('[userLabels] listUsers', error)
    return out
  }
  for (const u of data.users) {
    if (!wanted.has(u.id)) continue
    const name = u.user_metadata?.full_name
    out.set(u.id, { email: u.email ?? null, fullName: typeof name === 'string' && name.trim() ? name.trim() : null })
  }
  return out
}

export function memberLabel(entry: UserLabel | null | undefined): string {
  return entry?.fullName ?? entry?.email ?? 'someone who has left'
}
