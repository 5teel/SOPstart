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
      <div className="min-h-screen bg-steel-900">
        <OnlineStatusBanner />
        <InstallPrompt />
        <main className="pb-[calc(var(--min-tap-target)+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomTabBar />
      </div>
    </QueryProvider>
  )
}
