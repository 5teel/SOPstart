import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { RoleProvider } from '@/components/providers/RoleProvider'
import { OnlineStatusBanner } from '@/components/layout/OnlineStatusBanner'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { RouteTransition } from '@/components/layout/RouteTransition'
import { TopHeader } from '@/components/layout/TopHeader'

type HeaderRole = 'admin' | 'safety_manager' | 'supervisor' | 'worker' | null

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { userId, userEmail, role: memberRole } = await getSessionContext()

  if (!userId) {
    redirect('/login')
  }

  const role = (memberRole ?? null) as HeaderRole

  return (
    <QueryProvider>
      <RoleProvider role={role}>
        <div className="layout-shell h-dvh flex flex-col bg-[var(--paper)] overflow-hidden">
          <OnlineStatusBanner />
          <InstallPrompt />
          <TopHeader role={role} userEmail={userEmail} />
          <main className="flex-1 overflow-y-auto">
            <RouteTransition>{children}</RouteTransition>
          </main>
        </div>
      </RoleProvider>
    </QueryProvider>
  )
}
