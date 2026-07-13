import { getSessionContext } from './session-context'
import type { SessionContext } from './session-context'

export interface AdminContext {
  supabase: SessionContext['supabase']
  user: { id: string }
  role: string
  organisationId: string | null
}

/**
 * Shared admin guard for server actions and API routes. Replaces the
 * per-file getUser() + getSession() + JWT-parse copies: getSessionContext()
 * verifies the JWT locally (ES256 JWKS — no auth round-trip) and reads the
 * member role from organisation_members, the same table the access-token
 * hook mints the user_role claim from, so the value is equal or fresher
 * than the old claim read.
 */
export async function requireAdminContext(): Promise<AdminContext | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  return { supabase, user: { id: userId }, role, organisationId }
}
