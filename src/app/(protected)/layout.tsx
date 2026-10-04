import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { ProtectedProviders, type AppRole } from '@/components/providers/ProtectedProviders'
import { RouteTransition } from '@/components/layout/RouteTransition'
import { BackToSite } from '@/components/layout/BackToSite'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { userId, role: memberRole } = await getSessionContext()

  if (!userId) {
    redirect('/login')
  }

  const role = (memberRole ?? null) as AppRole

  return (
    <ProtectedProviders role={role}>
      <div className="layout-shell h-dvh flex flex-col bg-[var(--paper)] overflow-hidden">
        <BackToSite />
        <main className="flex-1 overflow-y-auto">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </ProtectedProviders>
  )
}
