import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { roleHome } from '@/lib/auth/role-home'
import { WorkerActivityView } from './WorkerActivityView'

export const metadata: Metadata = {
  title: 'Sign-off',
}

// Every role sees their own record here until Phase 61 moves it to the Smoko room.
// Supervisors and admins sign off from the Office inbox (Phase 59), not from a page of their own.
export default async function ActivityPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (role === 'worker' || role === 'supervisor' || role === 'safety_manager' || role === 'admin') {
    return <WorkerActivityView />
  }

  // No-role fallthrough → /pending
  redirect(roleHome(role))
}
