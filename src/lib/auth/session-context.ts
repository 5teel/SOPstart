import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface SessionContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string | null
  userEmail: string | null
  role: string | null
  organisationId: string | null
}

/**
 * Per-request session context shared by the (protected) layout and server
 * pages. React cache() means the JWT verify + member-role query run at most
 * once per request no matter how many segments call this.
 *
 * Uses getClaims() instead of getUser(): the project has asymmetric JWT
 * signing keys (ES256 in JWKS, verified live 2026-07-13), so the token is
 * verified locally via Web Crypto — no network round-trip. Tokens are
 * refreshed by the middleware before any server component runs, and
 * getClaims() rejects expired/invalid tokens, so a null userId here means
 * "not signed in" exactly like the old getUser() pattern.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) {
    return { supabase, userId: null, userEmail: null, role: null, organisationId: null }
  }

  // Org-aware membership lookup (LR-05): scope to the caller's JWT org when
  // the claim is present so a multi-org user resolves a single row and
  // .maybeSingle() can't error on duplicate memberships.
  const orgClaim = (claims as Record<string, unknown>)['organisation_id'] as string | undefined
  let memberQuery = supabase
    .from('organisation_members')
    .select('role, organisation_id')
    .eq('user_id', claims.sub)
  if (orgClaim) memberQuery = memberQuery.eq('organisation_id', orgClaim)
  const { data: member } = await memberQuery.maybeSingle()

  return {
    supabase,
    userId: claims.sub,
    userEmail: (claims.email as string | undefined) ?? null,
    role: member?.role ?? null,
    organisationId: member?.organisation_id ?? null,
  }
})
