import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { OnlineStatusBanner } from '@/components/layout/OnlineStatusBanner'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { InstallPrompt } from '@/components/layout/InstallPrompt'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return (
    <QueryProvider>
      <div className="layout-shell h-dvh flex flex-col bg-steel-900 overflow-hidden">
        <OnlineStatusBanner />
        <InstallPrompt />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <BottomTabBar />
      </div>
    </QueryProvider>
  )
}
