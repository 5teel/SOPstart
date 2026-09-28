import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

/**
 * Phase 30 (UX-03) → Phase 54 (D-01) — redirect shim.
 *
 * The governance queue is now its own route, /governance, a real inbox of
 * one-action rows (not a `?view=` deep link onto /sops). This route
 * survives only so legacy deep-links + bookmarks (GQ-04 /admin/governance
 * ?filter=X) keep working: a bookmark lands on the whole inbox — the inbox
 * has no flag-filter param. The approval-chain editor relocated to
 * /admin/settings. The admin guard stays IN FRONT of the redirect so an
 * unauthenticated/unauthorised hit never learns the destination shape.
 */
export default async function GovernancePage() {
  // Org-aware membership lookup (LR-05) now lives inside getSessionContext:
  // the member query is scoped to the JWT organisation_id claim, so a
  // multi-org user resolves a single row.
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  redirect('/governance')
}
