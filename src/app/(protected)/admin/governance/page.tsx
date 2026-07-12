import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseJwtPayload } from '@/lib/supabase/jwt'

/**
 * Phase 30 (UX-03, orchestrator decision #1) — redirect shim.
 *
 * The governance queue folded into /admin/sops as the "Needs attention" view.
 * This route survives only so legacy deep-links + bookmarks (GQ-04
 * /admin/governance?filter=X) keep working: it maps the legacy ?filter= param
 * onto the folded view's filter param. The approval-chain editor relocated to
 * /admin/settings. The admin guard stays IN FRONT of the redirect so an
 * unauthenticated/unauthorised hit never learns the destination shape.
 */
export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Org-aware membership lookup (LR-05): scope to the caller's JWT org so a
  // multi-org user resolves a single row and .maybeSingle() can't error on
  // duplicate memberships.
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const organisationId = claims['organisation_id'] as string | undefined

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organisation_id', organisationId ?? '')
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const filter = params.filter

  redirect(filter ? `/admin/sops?view=attention&filter=${filter}` : '/admin/sops?view=attention')
}
