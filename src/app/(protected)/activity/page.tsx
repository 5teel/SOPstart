import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { roleHome } from '@/lib/auth/role-home'
import { WorkerActivityView } from './WorkerActivityView'
import { SupervisorActivityView } from './SupervisorActivityView'

export const metadata: Metadata = {
  title: 'Activity',
}

export default async function ActivityPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (role === 'worker') return <WorkerActivityView />
  if (role === 'supervisor' || role === 'safety_manager') {
    return <SupervisorActivityView role={role} />
  }

  // Admin / no-role fallthrough → real home (admin → /admin/sops, no role → /pending)
  redirect(roleHome(role))
}
