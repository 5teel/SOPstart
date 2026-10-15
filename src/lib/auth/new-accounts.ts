import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WaitingPerson } from '@/app/(protected)/admin/approvals/ApprovalRow'

/**
 * ADR-0018: accounts waiting for (or turned down by) a platform admin, across every site by
 * design. Callers must have passed requirePlatformAdmin() first.
 */
export async function listNewAccounts(): Promise<WaitingPerson[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: rows } = await admin
    .from('user_approvals')
    .select('user_id, status, created_at')
    .in('status', ['pending', 'declined'])
    .order('created_at', { ascending: false })
    .limit(100)
  const list = (rows ?? []) as Array<{ user_id: string; status: 'pending' | 'declined'; created_at: string }>

  const users = await Promise.all(list.map((r) => admin.auth.admin.getUserById(r.user_id).then((x: { data: { user: { email?: string; user_metadata?: Record<string, unknown> } | null } }) => x.data.user)))
  const orgIds = [...new Set(users.map((u) => u?.user_metadata?.['organisation_id']).filter((x): x is string => typeof x === 'string'))]
  const { data: orgs } = orgIds.length ? await admin.from('organisations').select('id, name').in('id', orgIds) : { data: [] }
  const orgName = new Map(((orgs ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]))

  return list.map((r, i) => {
    const meta = users[i]?.user_metadata ?? {}
    const site = typeof meta['organisation_id'] === 'string' ? (orgName.get(meta['organisation_id']) ?? null) : null
    return {
      userId: r.user_id,
      email: users[i]?.email ?? '(no email)',
      status: r.status,
      createdAt: r.created_at,
      site,
      role: typeof meta['invited_role'] === 'string' ? meta['invited_role'] : null,
    }
  })
}
