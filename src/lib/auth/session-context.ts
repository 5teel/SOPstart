import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { needsSecondStep } from '@/lib/auth/elevated'

export interface SessionContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string | null
  userEmail: string | null
  /**
   * The role every app check reads. Phase 66 (ADR-0028): an admin or safety manager whose
   * session is not aal2 yet is reported as 'worker' here, so admin screens and actions refuse
   * them until /verify; their real role is memberRole.
   */
  role: string | null
  /** The membership row's role, whatever the session's assurance level. */
  memberRole: string | null
  /** The access token's aal claim ('aal1' | 'aal2'). */
  aal: string | null
  /** memberRole is elevated and the session has not proved the second step. */
  needsSecondStep: boolean
  /** Phase 67 / ADR-0029: signed in with a code and has not set a new password yet (app_metadata). */
  mustSetPassword: boolean
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
    return { supabase, userId: null, userEmail: null, role: null, memberRole: null, aal: null, needsSecondStep: false, mustSetPassword: false, organisationId: null }
  }

  // Org-aware membership lookup (LR-05): scope to the caller's JWT org when
  // the claim is present so a multi-org user resolves a single row and
  // .maybeSingle() can't error on duplicate memberships.
  const orgClaim = (claims as Record<string, unknown>)['organisation_id'] as string | undefined
  let memberQuery = supabase
    .from('organisation_members')
    .select('role, organisation_id')
    .eq('user_id', claims.sub)
    // RLS already hides a non-active row (00082 helpers); this keeps the app's answer identical:
    // a suspended or departed caller has no role and no organisation, so / sends them to /pending.
    .eq('status', 'active')
  if (orgClaim) memberQuery = memberQuery.eq('organisation_id', orgClaim)
  const { data: member } = await memberQuery.maybeSingle()

  const memberRole = member?.role ?? null
  const aal = ((claims as Record<string, unknown>)['aal'] as string | undefined) ?? null
  const secondStep = needsSecondStep(memberRole, aal)
  return {
    supabase,
    userId: claims.sub,
    userEmail: (claims.email as string | undefined) ?? null,
    role: secondStep ? 'worker' : memberRole,
    memberRole,
    aal,
    needsSecondStep: secondStep,
    mustSetPassword: (claims as { app_metadata?: Record<string, unknown> }).app_metadata?.['must_set_password'] === true,
    organisationId: member?.organisation_id ?? null,
  }
})
