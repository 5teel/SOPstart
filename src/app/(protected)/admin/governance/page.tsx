import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

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
  // Org-aware membership lookup (LR-05) now lives inside getSessionContext:
  // the member query is scoped to the JWT organisation_id claim, so a
  // multi-org user resolves a single row.
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const filter = params.filter

  redirect(filter ? `/admin/sops?view=attention&filter=${filter}` : '/admin/sops?view=attention')
}
