import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { roleHome } from '@/lib/auth/role-home'
import { WorkerActivityView } from './WorkerActivityView'
import { SupervisorActivityView } from './SupervisorActivityView'

export const metadata: Metadata = {
  title: 'Sign-off',
}

export default async function ActivityPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (role === 'worker') return <WorkerActivityView />
  if (role === 'supervisor' || role === 'safety_manager' || role === 'admin') {
    return <SupervisorActivityView role={role} />
  }

  // No-role fallthrough → /pending
  redirect(roleHome(role))
}
