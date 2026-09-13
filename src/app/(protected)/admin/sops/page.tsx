import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

/**
 * Phase 41 (SUR-01, orchestrator decision D-01) — redirect shim.
 *
 * `/admin/sops` folded into the merged SOP surface at `/sops` (see
 * AdminSopSurface.tsx for the Admin scope group of lenses). This route
 * survives only so legacy deep-links + bookmarks keep working: it maps the
 * seven legacy query params onto the merged surface's own scopes. The admin
 * guard stays IN FRONT of the destination redirect so an unauthenticated or
 * unauthorised hit never learns the destination shape (T-41-03b).
 */
export default async function AdminSopsShimPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    status?: string
    owner?: string
    filter?: string
    departments?: string
    collection?: string
    sop?: string
  }>
}) {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const qp = new URLSearchParams()
  if (params.view) qp.set('view', params.view)
  if (params.status) qp.set('status', params.status)
  if (params.owner) qp.set('owner', params.owner)
  if (params.filter) qp.set('filter', params.filter)
  if (params.departments) qp.set('departments', params.departments)
  if (params.collection) qp.set('collection', params.collection)
  if (params.sop) qp.set('sop', params.sop)

  const qs = qp.toString()
  redirect(qs ? `/sops?${qs}` : '/sops')
}
