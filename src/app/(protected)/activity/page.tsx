import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { roleHome } from '@/lib/auth/role-home'
import { CompletionList } from '@/components/home/sections/CompletionList'

export const metadata: Metadata = {
  title: 'Sign-off',
}

// Every role sees their own record here until Phase 61 moves it to the Smoko room.
// Supervisors and admins sign off from the Office inbox (Phase 59), not from a page of their own.
export default async function ActivityPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (role === 'worker' || role === 'supervisor' || role === 'safety_manager' || role === 'admin') {
    return (
      <div className="px-4 py-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--ink-900)] mb-1">My sign-offs</h1>
        <CompletionList />
      </div>
    )
  }

  // No-role fallthrough → /pending
  redirect(roleHome(role))
}
