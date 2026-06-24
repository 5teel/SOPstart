import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { RoleProvider } from '@/components/providers/RoleProvider'
import { OnlineStatusBanner } from '@/components/layout/OnlineStatusBanner'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { RouteTransition } from '@/components/layout/RouteTransition'
import { TopHeader } from '@/components/layout/TopHeader'

type HeaderRole = 'admin' | 'safety_manager' | 'supervisor' | 'worker' | null

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = (member?.role ?? null) as HeaderRole

  return (
    <QueryProvider>
      <RoleProvider role={role}>
        <div className="layout-shell h-dvh flex flex-col bg-[var(--paper)] overflow-hidden">
          <OnlineStatusBanner />
          <InstallPrompt />
          <TopHeader role={role} userEmail={user.email ?? null} />
          <main className="flex-1 overflow-y-auto">
            <RouteTransition>{children}</RouteTransition>
          </main>
          <BottomTabBar />
        </div>
      </RoleProvider>
    </QueryProvider>
  )
}
