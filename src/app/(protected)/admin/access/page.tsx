import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdminContext } from '@/lib/auth/guards'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { AdminAccessLens } from '@/components/sop/lenses/AdminAccessLens'

export const metadata: Metadata = { title: 'Access' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Phase 57 / Plan 57-07 (D-14) -- the Access bridge. The wiring screen is kept
 * exactly as it was; only its address changed. Phase 59 re-homes it.
 *
 * requireAdminContext() runs before anything renders (T-57-28);
 * listAdminAccessData self-guards as defence in depth. `?sop=` pins a SOP
 * only when it is a UUID (T-57-29) and the read stays org-scoped.
 */
export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ sop?: string }>
}) {
  const ctx = await requireAdminContext()
  if ('error' in ctx) {
    redirect(ctx.error === 'Not authenticated' ? '/login' : '/')
  }

  const { sop } = await searchParams
  const pinnedSopId = sop && UUID.test(sop) ? sop : undefined

  return (
    <AdminPageShell title="Access" description="Who can see which SOPs">
      <AdminAccessLens pinnedSopId={pinnedSopId} />
    </AdminPageShell>
  )
}
